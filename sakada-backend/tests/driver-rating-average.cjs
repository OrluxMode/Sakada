// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/driver-rating-average.cjs
// Fixture setup bypasses RLS; requester reads run as authenticated.
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
      grant usage on schema auth, public to authenticated, anon;
      grant execute on all functions in schema auth to authenticated;
    `);
    const dir = join(__dirname, '../supabase/migrations');
    const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[0-3])_.*\.sql$/.test(f)).sort();
    assert.equal(files.length, 23);
    for (const file of files.slice(0, 22)) await db.exec(readFileSync(join(dir, file), 'utf8'));

    async function user(role, name) {
      const id = randomUUID();
      await db.query('insert into auth.users values ($1,$2,$3)',
        [id, `${id}@example.com`, JSON.stringify({ role, full_name: name })]);
      return id;
    }
    const farmer = await user('farmer', 'Farmer A');
    const vendor = await user('vendor', 'Vendor B');
    const rated = await user('driver', 'Rated Driver');
    const unrated = await user('driver', 'New Driver');
    const privateDriver = await user('driver', 'Private Driver');
    await db.query('update driver_profiles set vehicle_type=$1, vehicle_plate=$2 where id=$3',
      ['Truck', 'ABC-123', rated]);

    async function book(requester, driver) {
      return (await db.query(`insert into deliveries
        (requester_id, driver_id, status, pickup_address, dropoff_address,
         goods_description, distance_km)
        values ($1,$2,$3,'Pickup town','Dropoff town','Mangoes',1) returning id`,
      [requester, driver, driver ? 'delivered' : 'pending'])).rows[0].id;
    }
    async function rate(delivery, by, target, rating) {
      await db.query(`insert into ratings (delivery_id,rated_by,rated_user_id,rating,comment)
        values ($1,$2,$3,$4,'Private feedback')`, [delivery, by, target, rating]);
    }
    const ownRated = await book(farmer, rated);
    const ownRatedAgain = await book(farmer, rated);
    const otherRated = await book(vendor, rated);
    const otherRatedAgain = await book(vendor, rated);
    const ownUnrated = await book(farmer, unrated);
    const otherPrivate = await book(vendor, privateDriver);
    await book(farmer, null);
    await rate(ownRated, farmer, rated, 5);
    await rate(otherRated, vendor, rated, 4);
    await rate(otherRatedAgain, vendor, rated, 4);
    await rate(ownRated, rated, farmer, 1);
    await rate(ownUnrated, unrated, farmer, 2);
    await rate(otherPrivate, vendor, privateDriver, 5);

    // Supabase supplies these base privileges outside the migrations.
    await db.exec('grant select on profiles, driver_profiles, deliveries, ratings to authenticated');
    async function actAs(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']);
      await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
      await db.exec('set role authenticated');
      const role = (await db.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user')).rows[0];
      assert.equal(role.rolsuper, false);
      assert.equal(role.rolbypassrls, false);
    }
    const drivers = async () => (await db.query('select * from get_my_delivery_drivers() order by delivery_id')).rows;
    const oldColumns = ['delivery_id', 'driver_name', 'vehicle_type', 'vehicle_plate'];
    const original = new Map();
    for (const id of [farmer, vendor]) {
      await actAs(id);
      original.set(id, await drivers());
    }
    await db.exec('reset role');
    const migration = readFileSync(join(dir, files[22]), 'utf8');
    await db.exec(migration);
    await actAs(farmer);
    const firstRun = await drivers();
    await db.exec('reset role');
    await db.exec(migration);
    await actAs(farmer);
    assert.deepEqual(await drivers(), firstRun);
    console.log('PASS migrations 0001–0023 apply in order; 0023 reruns without changing results');

    for (const id of [farmer, vendor]) {
      await actAs(id);
      const rows = await drivers();
      assert.deepEqual(rows.map(row => Object.fromEntries(oldColumns.map(key => [key, row[key]]))), original.get(id));
      for (const row of rows) assert.deepEqual(Object.keys(row), [...oldColumns, 'rating_avg', 'rating_count']);
    }
    console.log('PASS original four columns, order, values and delivery visibility remain unchanged');

    await actAs(farmer);
    const rows = await drivers();
    assert.equal(rows.length, 3);
    for (const delivery of [ownRated, ownRatedAgain]) {
      const row = rows.find(r => r.delivery_id === delivery);
      assert.deepEqual(row, { delivery_id: delivery, driver_name: 'Rated Driver',
        vehicle_type: 'Truck', vehicle_plate: 'ABC-123', rating_avg: '4.3', rating_count: 3 });
    }
    assert.deepEqual(rows.find(r => r.delivery_id === ownUnrated), {
      delivery_id: ownUnrated, driver_name: 'New Driver', vehicle_type: null,
      vehicle_plate: null, rating_avg: null, rating_count: 0 });
    console.log('PASS 5/4/4 averages to 4.3 with count 3 across requesters; repeated deliveries do not multiply ratings');
    console.log('PASS unrated driver returns NULL/0; ratings drivers gave requesters do not count');

    const visibleRatings = (await db.query('select delivery_id from ratings')).rows;
    assert.equal(visibleRatings.length, 3);
    assert(visibleRatings.every(r => [ownRated, ownUnrated].includes(r.delivery_id)));
    assert.equal((await db.query('select id from profiles where id=$1', [rated])).rows.length, 0);
    assert.equal((await db.query('select id from driver_profiles where id=$1', [rated])).rows.length, 0);
    assert(!rows.some(r => r.delivery_id === otherPrivate || r.driver_name === 'Private Driver'));
    await actAs(vendor);
    const vendorRows = await drivers();
    assert.equal(vendorRows.length, 3);
    assert.equal(vendorRows.find(r => r.delivery_id === otherPrivate).rating_count, 1);
    assert(!vendorRows.some(r => r.delivery_id === ownUnrated));
    await actAs(rated);
    assert.deepEqual(await drivers(), []);
    await actAs(null);
    assert.deepEqual(await drivers(), []);
    console.log('PASS real RLS preserves private ratings/profiles; RPC reveals only caller-owned assigned deliveries');

    await db.exec('reset role');
    const fn = (await db.query(`select p.prosecdef, p.provolatile, p.proconfig,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      exists (select 1 from aclexplode(p.proacl) a where a.grantee=0
        and a.privilege_type='EXECUTE') as public_execute
      from pg_proc p where p.oid='public.get_my_delivery_drivers()'::regprocedure`)).rows[0];
    assert.deepEqual(fn, { prosecdef: true, provolatile: 's', proconfig: ['search_path=public'],
      authenticated_execute: true, anon_execute: false, public_execute: false });
    await db.exec('set role anon');
    await assert.rejects(drivers, error => error.code === '42501');
    console.log('PASS stable SECURITY DEFINER, fixed search_path, authenticated-only EXECUTE; anon denied');
    console.log('PASS all driver-rating-average tests');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
