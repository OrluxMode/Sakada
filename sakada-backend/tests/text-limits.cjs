// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/text-limits.cjs
// Auth stub + superuser: exercises migrations/triggers/checks, not Supabase RLS.
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

const dir = join(__dirname, '../supabase/migrations');
const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[01])_.*\.sql$/.test(f)).sort();
assert.equal(files.length, 21);
const migration = readFileSync(join(dir, files[20]), 'utf8');
const checks = [
  'deliveries_pickup_address_len', 'deliveries_dropoff_address_len',
  'deliveries_goods_description_len', 'deliveries_notes_len',
  'deliveries_quantity_kg_range', 'profiles_full_name_len',
];

async function signup(db, name, email = 'farmer@example.com', role) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',
    [id, email, JSON.stringify({ full_name: name, ...(role ? { role } : {}) })]);
  return (await db.query('select * from profiles where id=$1', [id])).rows[0];
}

async function delivery(db, requester, overrides = {}) {
  const row = { requester_id: requester, pickup_address: 'Pickup town',
    dropoff_address: 'Dropoff town', goods_description: 'Mangoes', ...overrides };
  return db.query(`insert into deliveries (${Object.keys(row).join(',')})
    values (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(row));
}

async function rejected(action, constraint) {
  await assert.rejects(action, error => error.code === '23514' && error.constraint === constraint);
}

async function main() {
  for (const scenario of ['clean', 'legacy-all', 'legacy-mixed']) {
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
      `);
      for (const file of files.slice(0, 20)) await db.exec(readFileSync(join(dir, file), 'utf8'));
      const owner = await signup(db, 'Test Farmer', 'farmer@example.com', 'farmer');
      let before;
      if (scenario !== 'clean') {
        await db.query('update profiles set full_name=$1 where id=$2', ['X', owner.id]);
        await delivery(db, owner.id, scenario === 'legacy-all'
          ? { pickup_address: 'X', dropoff_address: 'X', goods_description: 'X', notes: 'X'.repeat(501), quantity_kg: 100001 }
          : { pickup_address: 'X' });
        before = (await db.query(`select
          (select jsonb_agg(to_jsonb(p)) from profiles p) as profiles,
          (select jsonb_agg(to_jsonb(d)) from deliveries d) as deliveries`)).rows;
      }
      await db.exec(migration);
      console.log(`PASS ${scenario}: migrations 0001–0021 apply in order`);
      const state = (await db.query(`select conname, convalidated from pg_constraint
        where conname = any($1::text[]) order by conname`, [checks])).rows;
      assert.equal(state.length, 6);
      for (const c of state) {
        const safe = scenario === 'clean' || (scenario === 'legacy-mixed'
          && !['deliveries_pickup_address_len', 'profiles_full_name_len'].includes(c.conname));
        assert.equal(c.convalidated, safe, c.conname);
      }
      if (before) {
        assert.deepEqual((await db.query(`select
          (select jsonb_agg(to_jsonb(p)) from profiles p) as profiles,
          (select jsonb_agg(to_jsonb(d)) from deliveries d) as deliveries`)).rows, before);
        // Header count query is runnable and reports the seeded violations.
        const preflight = migration.slice(migration.indexOf('-- select '), migration.indexOf(';\n--\n'))
          .split('\n').map(line => line.replace(/^-- ?/, '')).join('\n');
        const counts = (await db.query(preflight)).rows;
        assert.equal(counts.length, 6);
        for (const row of counts) assert.equal(Number(row.violations),
          scenario === 'legacy-all' || ['deliveries.pickup_address', 'profiles.full_name'].includes(row.column_name) ? 1 : 0);
        console.log(`PASS ${scenario}: old rows unchanged; only safe checks validated; header counts correct`);
      }
      // New invalid writes are rejected even with legacy checks NOT VALID.
      await rejected(() => delivery(db, owner.id, { pickup_address: 'abcd' }), checks[0]);
      if (scenario !== 'clean') continue;

      for (const [column, min, max, constraint] of [
        ['pickup_address', 5, 200, checks[0]], ['dropoff_address', 5, 200, checks[1]],
        ['goods_description', 2, 120, checks[2]], ['notes', 0, 500, checks[3]],
      ]) {
        for (const length of [min, max]) await delivery(db, owner.id, { [column]: 'a'.repeat(length) });
        await delivery(db, owner.id, { [column]: `  ${'a'.repeat(max)}  ` });
        await rejected(() => delivery(db, owner.id, { [column]: 'a'.repeat(max + 1) }), constraint);
        if (min) await rejected(() => delivery(db, owner.id, { [column]: `  ${'a'.repeat(min - 1)}  ` }), constraint);
        console.log(`PASS ${column}: exact boundaries, trimmed padding, over/under limits (23514)`);
      }
      for (const kg of [null, 1, 100000]) await delivery(db, owner.id, { quantity_kg: kg });
      for (const kg of [0, 100001]) await rejected(() => delivery(db, owner.id, { quantity_kg: kg }), checks[4]);
      const nullable = (await delivery(db, owner.id)).rows[0];
      assert.equal(nullable.notes, null);
      assert.equal(nullable.quantity_kg, null);
      assert.equal(nullable.estimated_cost, null);
      console.log('PASS weight: null/1/100000 accepted, 0/100001 rejected (23514); fare stays nullable');

      // Direct profile inserts bypass the signup normalizer, proving the CHECK itself.
      for (const [length, succeeds] of [[2, true], [120, true], [1, false], [121, false]]) {
        const account = await signup(db, 'Valid Name');
        await db.query('delete from profiles where id=$1', [account.id]);
        const insert = () => db.query('insert into profiles(id,role,full_name) values ($1,$2,$3)',
          [account.id, 'farmer', 'a'.repeat(length)]);
        if (succeeds) await insert(); else await rejected(insert, checks[5]);
      }
      console.log('PASS profile name: exact 2/120 accepted; 1/121 rejected (23514)');

      for (const [name, email, expected] of [
        ['X', 'google.person@example.com', 'google.person'],
        ['a'.repeat(300), 'google.person@example.com', 'a'.repeat(120)],
        ['  Google Person  ', 'google.person@example.com', 'Google Person'],
        ['', 'x@example.com', 'User'], [null, null, 'User'],
        ['X', `${'e'.repeat(300)}@example.com`, 'e'.repeat(120)],
      ]) {
        const profile = await signup(db, name, email);
        assert.equal(profile.full_name, expected);
        assert.equal(profile.role, 'farmer');
        assert.equal(profile.role_confirmed_at, null);
        assert.equal((await db.query('select id from farmer_profiles where id=$1', [profile.id])).rows.length, 1);
      }
      for (const role of ['farmer', 'vendor', 'driver', 'admin']) {
        const p = await signup(db, 'Valid Name', 'user@example.com', role);
        assert.equal(p.role, role === 'admin' ? 'farmer' : role);
        assert.equal(p.role_confirmed_at !== null, role !== 'admin');
        assert.equal((await db.query(`select id from ${p.role}_profiles where id=$1`, [p.id])).rows.length, 1);
      }
      console.log('PASS signup: Google 1/300-char names, trimming, fallback edge cases, role/confirmation behavior');
      await db.exec(migration);
      console.log('PASS migration 0021 rerun');
    } finally {
      await db.close();
    }
  }
  console.log('PASS all text-limit migration tests (PGlite; RLS not exercised)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
