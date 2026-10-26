// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/saved-addresses.cjs
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create function auth.role() returns text language sql stable as $$
        select nullif(current_setting('request.jwt.claim.role', true), '') $$;
      grant usage on schema auth, public to authenticated;
      grant execute on all functions in schema auth to authenticated;
      -- DDL-only storage stand-in: does not test Supabase Storage behavior.
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable
        as $$ select string_to_array($1, '/') $$;
    `);
    const dir = join(__dirname, '../supabase/migrations');
    const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[0-6])_.*\.sql$/.test(f)).sort();
    assert.equal(files.length, 26);
    for (const file of files) await db.exec(readFileSync(join(dir, file), 'utf8'));
    for (const file of files.slice(24)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    console.log('PASS migrations 0001–0026 apply; 0025 and 0026 rerun (storage DDL stub only)');
    const a = randomUUID(), b = randomUUID();
    for (const id of [a, b]) await db.query('insert into auth.users values ($1,$2,$3)',
      [id, `${id}@example.com`, JSON.stringify({ role: 'farmer', full_name: 'Test Person' })]);
    // Hosted Supabase supplies base SELECT grants on existing tables.
    await db.exec('grant select on profiles to authenticated');
    async function actAs(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
      await db.exec('set role authenticated');
      const role = (await db.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user')).rows[0];
      assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false);
    }
    const fail = (action, code) => assert.rejects(action, e => e.code === code);
    async function add(label, extras = {}) {
      const row = { label, address: 'Farm road', lat: 14.5, lng: 121, ...extras };
      return (await db.query(`insert into saved_addresses (${Object.keys(row).join(',')})
        values (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(row))).rows[0];
    }
    await actAs(a);
    const first = await add('My farm');
    assert.equal(first.user_id, a);
    assert.equal((await db.query('select * from saved_addresses')).rows.length, 1);
    const edited = (await db.query("update saved_addresses set city='Davao', label='Home farm' where id=$1 returning *", [first.id])).rows[0];
    assert.equal(edited.city, 'Davao'); assert(edited.updated_at >= first.updated_at);
    await db.query("update saved_addresses set label='My farm' where id=$1", [first.id]);
    await fail(() => add(' my farm '), '23505');
    for (const extras of [{lat: 91}, {lat: -91}, {lng: 181}, {lng: -181},
      {lat: NaN}, {lng: Infinity}, {address: ' '}, {city: 'x'.repeat(121)}]) {
      await fail(() => add('Invalid', extras), '23514');
    }
    for (const label of [' ', 'x'.repeat(41)]) await fail(() => add(label), '23514');
    await fail(() => add('Spoofed', {user_id: b}), '42501');
    await fail(() => db.query('update saved_addresses set user_id=$1 where id=$2', [b, first.id]), '42501');
    console.log('PASS owner create/read/edit, normalized unique labels, input bounds and ownership protections');
    await actAs(b);
    assert.equal((await db.query('select * from saved_addresses')).rows.length, 0);
    for (const sql of ["update saved_addresses set label='Stolen' where id=$1 returning id",
      'delete from saved_addresses where id=$1 returning id']) {
      assert.equal((await db.query(sql, [first.id])).rows.length, 0);
    }
    await add('My farm');
    console.log('PASS user B cannot read/update/delete A; same label allowed for different users');
    await actAs(a);
    for (let i = 1; i < 10; i++) await add(`Address ${i}`);
    await assert.rejects(() => add('Eleventh'), e => e.code === 'P0001' && e.message === 'saved address limit reached');
    assert.equal((await db.query('select * from saved_addresses')).rows.length, 10);
    assert.equal((await db.query('delete from saved_addresses where id=$1 returning id', [first.id])).rows.length, 1);
    await add('Replacement');
    console.log('PASS ten-address cap, exact error, owner delete and replacement');
    const prefix = 'https://aeeniueayubeugvooyqj.supabase.co/storage/v1/object/public/avatars/';
    async function avatar(value) { await db.query('update profiles set avatar_url=$1 where id=$2', [value, a]); }
    await avatar(null); await avatar(`${prefix}${a}/123.webp`);
    for (const value of [`${prefix}${b}/123.webp`, 'https://example.com/avatar.png',
      `https://evil.example/storage/v1/object/public/avatars/${a}/123.webp`]) {
      await fail(() => avatar(value), '23514');
    }
    console.log('PASS avatar NULL/own project path accepted; foreign owner and outside URLs rejected');
    await db.exec('reset role; set role anon');
    for (const sql of ['select * from saved_addresses', "insert into saved_addresses(label,address,lat,lng) values ('A','AB',0,0)"])
      await fail(() => db.exec(sql), '42501');
    console.log('PASS anon has no saved-address privileges');
    console.log('PASS all saved-address and profile-avatar tests');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
