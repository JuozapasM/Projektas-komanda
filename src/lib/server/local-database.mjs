import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// This adapter is internal to the development server. It opens no HTTP endpoint.
const columns = {
  users: ['id', 'name', 'password_hash', 'role', 'created_at'],
  app_sessions: ['token_hash', 'user_id', 'expires_at', 'created_at'],
  game_dates: ['id', 'title', 'starts_at', 'is_open', 'created_at'],
  seats: ['id', 'game_date_id', 'table_number', 'seat_number'],
  reservations: ['id', 'game_date_id', 'seat_id', 'user_id', 'status', 'reserved_at', 'cancelled_at'],
  reservation_events: ['id', 'reservation_id', 'game_date_id', 'user_name', 'table_number', 'seat_number', 'action', 'occurred_at'],
  winner_results: ['id', 'teams', 'updated_at'],
  all_time_winners: ['name', 'points', 'games_played'],
};
const functions = {
  take_auth_attempt: ['bucket_key', 'max_attempts'],
  create_game_date_secure: ['actor_id', 'date_time'],
  reserve_game_seat: ['actor_id', 'game_id'],
  cancel_game_seat: ['actor_id', 'game_id'],
  reject_game_reservation: ['actor_id', 'reservation_id'],
};
const identifier = (value) => `"${value}"`;
function column(table, name) {
  if (!columns[table]?.includes(name)) throw new Error('Unsupported local column');
  return identifier(name);
}
function selections(value) {
  const result = []; let depth = 0; let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) { result.push(value.slice(start, i)); start = i + 1; }
  }
  result.push(value.slice(start));
  return result;
}
function projection(table, select) {
  return selections(select).map((field) => {
    if (field === '*') return 't.*';
    if (table === 'seats' && ['reservations(user_id,status,users(name))', 'reservations(id,user_id,status,users(name))'].includes(field.replaceAll(' ', ''))) {
      const reservationId = field.replaceAll(' ', '').startsWith('reservations(id,') ? "'id', r.id," : '';
      return `coalesce((select jsonb_agg(jsonb_build_object(${reservationId} 'user_id', r.user_id, 'status', r.status,
        'users', (select jsonb_build_object('name', u.name) from public.users u where u.id = r.user_id)))
        from public.reservations r where r.seat_id = t.id), '[]'::jsonb) as reservations`;
    }
    if (table === 'reservation_events' && field === 'game_dates(starts_at)') {
      return `(select jsonb_build_object('starts_at', g.starts_at) from public.game_dates g where g.id = t.game_date_id) as game_dates`;
    }
    if (table === 'reservation_events' && field === 'reservations(status)') {
      return `(select jsonb_build_object('status', r.status) from public.reservations r where r.id = t.reservation_id) as reservations`;
    }
    return `t.${column(table, field)}`;
  }).join(', ');
}
function filters(table, params, values) {
  const clauses = [];
  for (const [key, expression] of params) {
    if (['select', 'order', 'limit', 'on_conflict'].includes(key)) continue;
    const match = /^(eq|gt|lt|ilike)\.(.*)$/s.exec(expression);
    if (!match) throw new Error('Unsupported local filter');
    const operator = { eq: '=', gt: '>', lt: '<', ilike: 'ilike' }[match[1]];
    values.push(match[2]);
    clauses.push(`t.${column(table, key)} ${operator} $${values.length}`);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

async function initialize(db, directory) {
  await db.exec(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
    end $$;
    grant usage on schema public to anon, authenticated, service_role;
    create schema if not exists local_runtime;
    create table if not exists local_runtime.migrations (name text primary key);
  `);
  const migrationDirectory = path.join(process.cwd(), 'supabase', 'migrations');
  for (const name of (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort()) {
    const applied = await db.query('select 1 from local_runtime.migrations where name = $1', [name]);
    if (applied.rows.length) continue;
    // These migrations only enable pgcrypto; UUIDs and bcrypt do not need it here.
    const sql = (await readFile(path.join(migrationDirectory, name), 'utf8'))
      .replace(/^create extension if not exists pgcrypto;\s*/m, '')
      .replace(/^begin;\s*/m, '').replace(/^commit;\s*/m, '');
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into local_runtime.migrations (name) values ($1)', [name]);
    });
  }
  const admins = await db.query("select id, name from public.users where role = 'admin' and password_hash like '!disabled:%'");
  if (admins.rows.length) {
    const password = randomBytes(24).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    // Store development access privately on disk, never in UI, logs, or Git.
    await writeFile(path.join(directory, 'admin-credentials.txt'),
      `Vietinės peržiūros administratorius\nVardas: ${admins.rows[0].name}\nSlaptažodis: ${password}\n`, { mode: 0o600 });
    await db.query('update public.users set password_hash = $1 where id = $2', [hash, admins.rows[0].id]);
  }
}

export function createLocalDatabase(directory) {
  let db;
  const ready = (async () => {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    db = new PGlite(path.join(directory, 'postgres'));
    await initialize(db, directory);
    return db;
  })();
  // Handle initialization errors on the first request without an unhandled promise.
  ready.catch(() => {});
  const fetch = async (input, init) => {
    try {
      const database = await ready;
      const request = new Request(input, init);
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/rest\/v1\//, '');
      const body = request.method === 'GET' || request.method === 'DELETE' ? null : await request.json();
      let rows;
      if (route.startsWith('rpc/')) {
        const name = route.slice(4);
        const args = functions[name];
        if (!args || !body || args.some((arg) => !(arg in body))) throw new Error('Unsupported local function');
        const result = await database.query(`select public.${identifier(name)}(${args.map((arg, i) => `${identifier(arg)} => $${i + 1}`).join(', ')}) as result`, args.map((arg) => body[arg]));
        return Response.json(result.rows[0].result);
      }
      if (!columns[route]) throw new Error('Unsupported local table');
      const table = `public.${identifier(route)}`;
      const values = [];
      const select = projection(route, url.searchParams.get('select') ?? '*');
      if (request.method === 'GET') {
        let sql = `select ${select} from ${table} t${filters(route, url.searchParams, values)}`;
        const order = url.searchParams.get('order');
        if (order) sql += ` order by ${order.split(',').map((part) => {
          const [name, direction = 'asc'] = part.split('.');
          if (!['asc', 'desc'].includes(direction)) throw new Error('Unsupported local order');
          return `t.${column(route, name)} ${direction}`;
        }).join(', ')}`;
        const limit = url.searchParams.get('limit');
        if (limit !== null) {
          if (!/^\d+$/.test(limit) || Number(limit) > 10000) throw new Error('Unsupported local limit');
          values.push(Number(limit)); sql += ` limit $${values.length}`;
        }
        rows = (await database.query(sql, values)).rows;
      } else if (request.method === 'POST' || request.method === 'PATCH') {
        if (!body || Array.isArray(body)) throw new Error('Unsupported local payload');
        const keys = Object.keys(body);
        const names = keys.map((key) => column(route, key));
        values.push(...keys.map((key) => typeof body[key] === 'object' && body[key] !== null ? JSON.stringify(body[key]) : body[key]));
        let sql;
        if (request.method === 'PATCH') {
          sql = `update ${table} t set ${names.map((name, i) => `${name} = $${i + 1}`).join(', ')}${filters(route, url.searchParams, values)} returning ${select}`;
        } else {
          sql = `insert into ${table} as t (${names.join(', ')}) values (${names.map((_, i) => `$${i + 1}`).join(', ')})`;
          if (request.headers.get('Prefer')?.includes('resolution=merge-duplicates')) {
            const primary = route === 'app_sessions' ? 'token_hash' : route === 'all_time_winners' ? 'name' : 'id';
            sql += ` on conflict (${column(route, primary)}) do update set ${names.map((name) => `${name} = excluded.${name}`).join(', ')}`;
          }
          sql += ` returning ${select}`;
        }
        rows = (await database.query(sql, values)).rows;
      } else if (request.method === 'DELETE') {
        rows = (await database.query(`delete from ${table} t${filters(route, url.searchParams, values)} returning ${select}`, values)).rows;
      } else throw new Error('Unsupported local method');
      if (request.headers.get('Accept')?.includes('application/vnd.pgrst.object+json')) {
        if (rows.length !== 1) return Response.json({ code: 'PGRST116', message: 'Expected one row', details: `The result contains ${rows.length} rows` }, {status: 406});
        return Response.json(rows[0]);
      }
      return Response.json(rows);
    } catch (error) {
      // Raw database details stay within the server's Supabase-compatible client.
      return Response.json({ code: error.code ?? 'LOCAL_DB_ERROR', message: error.message, details: null, hint: null }, {status: 400});
    }
  };
  const client = createClient('http://local-database.invalid', 'local-server-only', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  return { client, ready, async close() { await ready; await db.close(); } };
}

const registry = Symbol.for('auksinis-protas.local-database');
export function localDatabase() {
  const directory = path.join(process.cwd(), '.local-data');
  globalThis[registry] ??= createLocalDatabase(directory);
  return globalThis[registry].client;
}
