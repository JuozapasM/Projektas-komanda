import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { buildSupabaseBundle } from '../scripts/build-supabase-bundle.mjs';

test('SQL Editor installation is atomic, protects existing databases, and passes the deployment verification', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    // PGlite has built-in UUID generation but does not include pgcrypto.
    const sql = (await buildSupabaseBundle()).replace(/^create extension if not exists pgcrypto;\s*/gm, '');
    await db.exec('create table public.seats (id int)');
    await assert.rejects(db.exec(sql), /already exists/);
    await db.exec('rollback');
    assert.equal((await db.query("select to_regclass('public.users') as table_name")).rows[0].table_name,null);
    await db.exec('drop table public.seats');
    await db.exec(sql);
    const verification = await readFile(new URL('../supabase/verify.sql', import.meta.url), 'utf8');
    await db.exec(verification);
    assert.equal((await db.query('select count(*)::int as n from public.seats')).rows[0].n,84);
    await assert.rejects(db.exec(sql), /APP_ALREADY_EXISTS/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as n from public.seats')).rows[0].n,84);
    await db.exec('grant select on public.users to anon');
    await assert.rejects(db.exec(verification), /PRIVATE_TABLE_EXPOSED/);
  } finally { await db.close(); }
});
