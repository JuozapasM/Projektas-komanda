import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationDirectory = path.join(__dirname, '../supabase/migrations');
const migrations = fs.readdirSync(migrationDirectory).filter(name => /^\d+_.+\.sql$/.test(name)).sort();

test('SQL migration protects private records, reservation ownership, and durable winners', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'auksinis-protas-test-'));
  let db = new PGlite(directory);
  const query = async (sql, params = []) => (await db.query(sql, params)).rows;
  const asRole = async (role, operation) => {
    await db.exec(`set role ${role}`);
    try { return await operation(); } finally { await db.exec('reset role'); }
  };
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    for (const name of migrations) {
      let sql = fs.readFileSync(path.join(migrationDirectory, name), 'utf8');
      // PGlite lacks pgcrypto. The legacy migrations only enable it;
      // the security migration and all its functions are executed unchanged.
      sql = sql.replace(/^create extension if not exists pgcrypto;\s*/gm, '');
      await db.exec(sql);
    }
    const admin = (await query("select id, password_hash from public.users where role = 'admin'"))[0];
    const users = await query("insert into public.users (name, password_hash) select 'Test ' || n, 'test-only' from generate_series(1, 20) n returning id");
    const game = (await query('select id from public.game_dates order by starts_at limit 1'))[0].id;

    await t.test('the exposed initial admin password is disabled', async () => {
      assert.ok(admin.password_hash.startsWith('!disabled:'));
    });

    await t.test('browser roles cannot read credentials/sessions/history or mutate reservations/results', async () => {
      for (const role of ['anon', 'authenticated']) {
        await asRole(role, async () => {
          for (const table of ['users', 'reservations', 'reservation_events', 'app_sessions', 'auth_attempts']) {
            await assert.rejects(query(`select * from public.${table}`), (error) => error.code === '42501');
          }
          for (const table of ['users', 'reservations', 'reservation_events', 'app_sessions', 'auth_attempts', 'game_dates', 'seats', 'winner_results', 'all_time_winners']) {
            await assert.rejects(query(`delete from public.${table}`), (error) => error.code === '42501');
          }
          assert.equal((await query('select count(*)::int as n from public.game_dates'))[0].n, 3);
          assert.equal((await query('select count(*)::int as n from public.winner_results'))[0].n, 1);
          for (const signature of [
            'take_auth_attempt(text,integer)', 'create_game_date_secure(uuid,timestamp with time zone)',
            'reserve_game_seat(uuid,uuid)', 'cancel_game_seat(uuid,uuid)', 'reject_game_reservation(uuid,uuid)',
          ]) {
            const result = await query('select has_function_privilege(current_user, $1, $2) as allowed', [`public.${signature}`, 'execute']);
            assert.equal(result[0].allowed, false, `${role} cannot execute ${signature}`);
          }
        });
      }
      assert.equal((await query("select to_regprocedure('public.create_game_date(timestamptz)') as old"))[0].old, null);
    });

    await t.test('login names cannot bypass uniqueness through case or whitespace', async () => {
      await assert.rejects(query("insert into public.users (name, password_hash) values ('  tEsT   1 ', 'x')"), (error) => error.code === '23505');
    });

    await t.test('reservation and audit are atomic; only the owner cancels and only admin rejects', async () => {
      await asRole('service_role', async () => {
        const seat = (await query('select public.reserve_game_seat($1, $2) as seat', [users[0].id, game]))[0].seat;
        assert.ok(seat.id);
        const reservation = (await query('select id from public.reservations where user_id = $1 and status = $2', [users[0].id, 'active']))[0];
        assert.equal((await query('select count(*)::int as n from public.reservation_events where reservation_id = $1', [reservation.id]))[0].n, 1);
        await assert.rejects(query('select public.reserve_game_seat($1, $2)', [users[0].id, game]), (error) => error.code === '23505');
        await assert.rejects(query('select public.cancel_game_seat($1, $2)', [users[1].id, game]), /NOT_FOUND/);
        await assert.rejects(query('select public.reject_game_reservation($1, $2)', [users[1].id, reservation.id]), /FORBIDDEN/);
        assert.equal((await query('select status from public.reservations where id = $1', [reservation.id]))[0].status, 'active');
        await query('select public.reject_game_reservation($1, $2)', [admin.id, reservation.id]);
        assert.equal((await query('select status from public.reservations where id = $1', [reservation.id]))[0].status, 'rejected');
        await query('select public.reserve_game_seat($1, $2)', [users[0].id, game]);
        await query('select public.cancel_game_seat($1, $2)', [users[0].id, game]);
        assert.equal((await query("select count(*)::int as n from public.reservations where user_id = $1 and status = 'active'", [users[0].id]))[0].n, 0);
      });
    });

    await t.test('a failed audit insert rolls back the corresponding reservation', async () => {
      const fresh = (await asRole('service_role', () => query("select public.create_game_date_secure($1, '2026-12-01T19:00:00+02') as id", [admin.id])))[0].id;
      await db.exec("alter table public.reservation_events add constraint test_audit_failure check (action <> 'reserved') not valid");
      await asRole('service_role', async () => {
        await assert.rejects(query('select public.reserve_game_seat($1, $2)', [users[0].id, fresh]), (error) => error.code === '23514');
        assert.equal((await query('select count(*)::int as n from public.reservations where game_date_id = $1', [fresh]))[0].n, 0);
      });
      await db.exec('alter table public.reservation_events drop constraint test_audit_failure');
    });

    await t.test('participants cannot create dates; capacity and closed games are enforced', async () => {
      await asRole('service_role', async () => {
        await assert.rejects(query("select public.create_game_date_secure($1, '2026-12-02T19:00:00+02')", [users[0].id]), /FORBIDDEN/);
        const fresh = (await query("select public.create_game_date_secure($1, '2026-12-02T19:00:00+02') as id", [admin.id]))[0].id;
        for (const user of users.slice(0, 16)) await query('select public.reserve_game_seat($1, $2)', [user.id, fresh]);
        const count = (await query('select count(*)::int as total, count(distinct seat_id)::int as seats from public.reservations where game_date_id = $1', [fresh]))[0];
        assert.deepEqual(count, {total: 16, seats: 16});
        await assert.rejects(query('select public.reserve_game_seat($1, $2)', [users[16].id, fresh]), /NO_SEATS/);
        await query('update public.game_dates set is_open = false where id = $1', [fresh]);
        await assert.rejects(query('select public.reserve_game_seat($1, $2)', [users[17].id, fresh]), /GAME_CLOSED/);
      });
    });

    await t.test('rate limits persist and reset after their time window', async () => {
      await asRole('service_role', async () => {
        const key = 'a'.repeat(64);
        assert.equal((await query('select public.take_auth_attempt($1, 2) as allowed', [key]))[0].allowed, true);
        assert.equal((await query('select public.take_auth_attempt($1, 2) as allowed', [key]))[0].allowed, true);
        assert.equal((await query('select public.take_auth_attempt($1, 2) as allowed', [key]))[0].allowed, false);
        await query("update public.auth_attempts set expires_at = now() - interval '1 second' where bucket = $1", [key]);
        assert.equal((await query('select public.take_auth_attempt($1, 2) as allowed', [key]))[0].allowed, true);
      });
    });

    await t.test('saved winner changes survive a database restart and are public read-only', async () => {
      const teams = (await query('select teams from public.winner_results where id = 1'))[0].teams;
      teams[0].players = ['Atnaujintas žaidėjas'];
      teams[0].points = 99;
      await asRole('service_role', () => query('update public.winner_results set teams = $1 where id = 1', [JSON.stringify(teams)]));
      await db.close();
      db = new PGlite(directory);
      await asRole('anon', async () => {
        const saved = (await query('select teams from public.winner_results where id = 1'))[0].teams;
        assert.equal(saved[0].points, 99);
        assert.deepEqual(saved[0].players, ['Atnaujintas žaidėjas']);
      });
    });
  } finally {
    await db.close();
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
