// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/recipient-and-pickup-window.cjs
// Runs real RLS via SET ROLE authenticated; only fixture setup bypasses RLS.
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
    `);
    const dir = join(__dirname, '../supabase/migrations');
    const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[0-4])_.*\.sql$/.test(f)).sort();
    assert.equal(files.length, 24);
    for (const file of files.slice(0, 23)) await db.exec(readFileSync(join(dir, file), 'utf8'));

    async function user(role) {
      const id = randomUUID();
      await db.query('insert into auth.users values ($1,$2,$3)',
        [id, `${id}@example.com`, JSON.stringify({ role, full_name: 'Test Person' })]);
      if (role === 'admin') await db.query("update profiles set role='admin' where id=$1", [id]);
      return id;
    }
    const farmer = await user('farmer');
    const vendor = await user('vendor');
    const driver = await user('driver');
    const admin = await user('admin');
    const today = (await db.query(`select
      (now() at time zone 'Asia/Manila')::date::text || 'T00:00:00Z' as date`)).rows[0].date;
    async function book(requester = farmer, extras = {}) {
      const row = { requester_id: requester, scheduled_pickup_at: today,
        pickup_address: 'Pickup town', dropoff_address: 'Dropoff town', goods_description: 'Mangoes',
        pickup_lat: 14.5, pickup_lng: 121, dropoff_lat: 14.5, dropoff_lng: 121, distance_km: 1, ...extras };
      return (await db.query(`insert into deliveries (${Object.keys(row).join(',')})
        values (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(row))).rows[0];
    }
    const legacy = await book();
    const functions = async () => (await db.query(`select proname, pg_get_functiondef(oid) as definition
      from pg_proc where pronamespace='public'::regnamespace order by oid`)).rows;
    const originalFunctions = await functions();

    // Supabase supplies base privileges outside the migrations. Grant them
    // BEFORE adding the columns to verify that no new column grants are needed.
    await db.exec(`grant select on profiles, deliveries to authenticated;
      grant insert, update on deliveries to authenticated;
      grant usage, select on sequence delivery_code_seq to authenticated;`);
    const migration = readFileSync(join(dir, files[23]), 'utf8');
    await db.exec(migration);
    const migrated = (await db.query('select * from deliveries where id=$1', [legacy.id])).rows[0];
    assert.deepEqual(migrated, { ...legacy, recipient_name: null, pickup_window: null });
    assert.deepEqual(await functions(), originalFunctions);
    console.log('PASS migrations 0001–0024 apply; legacy row stays blank; existing functions and date rules unchanged');

    async function actAs(id) {
      await db.exec('reset role');
      await db.exec('delete from rate_limits');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
      await db.exec('set role authenticated');
      const role = (await db.query(`select rolsuper, rolbypassrls from pg_roles
        where rolname=current_user`)).rows[0];
      assert.deepEqual(role, { rolsuper: false, rolbypassrls: false });
    }
    const fields = async id => (await db.query(`select recipient_name, pickup_window
      from deliveries where id=$1`, [id])).rows[0];
    const original = { recipient_name: 'Maria Santos', pickup_window: '08-10' };
    await actAs(farmer);
    const booking = await book(farmer, original);
    assert.deepEqual(await fields(booking.id), original);
    const oldStyle = await book();
    assert.deepEqual(await fields(oldStyle.id), { recipient_name: null, pickup_window: null });
    console.log('PASS authenticated requester inserts and reads both fields; old-style insert still succeeds with NULLs');

    for (const [extras, constraint] of [
      [{ recipient_name: ' A ' }, 'deliveries_recipient_name_len'],
      [{ recipient_name: 'A'.repeat(81) }, 'deliveries_recipient_name_len'],
      [{ recipient_name: '   ' }, 'deliveries_recipient_name_len'],
      [{ pickup_window: '09-11' }, 'deliveries_pickup_window_valid'],
      [{ pickup_window: ' 08-10 ' }, 'deliveries_pickup_window_valid'],
    ]) {
      await actAs(farmer);
      await assert.rejects(() => book(farmer, extras), e => e.code === '23514' && e.constraint === constraint);
    }
    for (const [name, window] of [[' AB ', '10-12'], ['A'.repeat(80), '13-15']]) {
      await actAs(vendor);
      const row = await book(vendor, { recipient_name: name, pickup_window: window });
      assert.deepEqual(await fields(row.id), { recipient_name: name, pickup_window: window });
    }
    console.log('PASS trimmed name bounds 2–80, all three window codes, invalid names/windows rejected under RLS');

    const update = (id, extras) => db.query(`update deliveries set
      ${Object.keys(extras).map((key, i) => `${key}=$${i + 2}`).join(',')}
      where id=$1 returning id`, [id, ...Object.values(extras)]);
    const blocked = extras => assert.rejects(() => update(booking.id, extras),
      e => e.code === 'P0001' && e.message === 'You are not allowed to make this change to the delivery.');
    await actAs(farmer);
    await blocked({ recipient_name: 'Other Recipient' });
    await blocked({ pickup_window: '10-12' });
    await blocked({ status: 'cancelled', recipient_name: 'Other Recipient' });
    await blocked({ status: 'cancelled', pickup_window: '10-12' });
    assert.deepEqual(await fields(booking.id), original);
    console.log('PASS requester cannot edit either field, including with an otherwise allowed cancellation');

    await actAs(driver);
    await blocked({ driver_id: driver, status: 'driver_assigned', recipient_name: 'Other Recipient' });
    await blocked({ driver_id: driver, status: 'driver_assigned', pickup_window: '10-12' });
    assert.equal((await update(booking.id, { driver_id: driver, status: 'driver_assigned' })).rows.length, 1);
    assert.deepEqual(await fields(booking.id), original);
    await blocked({ recipient_name: 'Other Recipient' });
    await blocked({ pickup_window: '13-15' });
    await blocked({ status: 'picked_up', recipient_name: 'Other Recipient' });
    await blocked({ current_lat: 14.6, pickup_window: '13-15' });
    assert.deepEqual(await fields(booking.id), original);
    console.log('PASS assigned driver reads both fields; edits blocked alone, during acceptance, status and location updates');

    await actAs(admin);
    const corrected = { recipient_name: 'Ana Santos', pickup_window: '13-15' };
    assert.equal((await update(booking.id, corrected)).rows.length, 1);
    assert.deepEqual(await fields(booking.id), corrected);
    await assert.rejects(() => update(booking.id, { recipient_name: ' A ' }),
      e => e.code === '23514' && e.constraint === 'deliveries_recipient_name_len');
    await assert.rejects(() => update(booking.id, { pickup_window: '09-11' }),
      e => e.code === '23514' && e.constraint === 'deliveries_pickup_window_valid');
    console.log('PASS admin edits both fields under RLS; constraints still enforced');

    await db.exec('reset role');
    const beforeRerun = (await db.query('select * from deliveries order by id')).rows;
    await db.exec(migration);
    assert.deepEqual((await db.query('select * from deliveries order by id')).rows, beforeRerun);
    assert.deepEqual(await functions(), originalFunctions);
    const checks = (await db.query(`select conname, convalidated from pg_constraint
      where conrelid='public.deliveries'::regclass
      and conname in ('deliveries_recipient_name_len','deliveries_pickup_window_valid')`)).rows;
    assert.equal(checks.length, 2);
    assert(checks.every(c => c.convalidated));
    await actAs(driver);
    assert.deepEqual(await fields(booking.id), corrected);
    await blocked({ pickup_window: '08-10' });
    console.log('PASS 0024 reruns with populated rows unchanged; validated checks, grants and guards preserved');
    console.log('PASS all recipient-and-pickup-window tests, including authenticated-role RLS');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
