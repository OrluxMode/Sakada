// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/past-pickup-date.cjs
// Runs real RLS via SET ROLE authenticated; only fixture setup bypasses RLS.
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const expiredMessage = 'This pickup date has passed. The farmer or vendor needs to book a new date.';

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
    const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[0-2])_.*\.sql$/.test(f)).sort();
    assert.equal(files.length, 22);
    for (const file of files.slice(0, 21)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    const originalFunctions = async () => (await db.query(`select proname, pg_get_functiondef(oid) as definition
      from pg_proc where pronamespace='public'::regnamespace and proname in
      ('enforce_driver_job_cap','guard_delivery_update','guard_delivery_insert','stamp_status_change')
      order by proname`)).rows;
    const original = await originalFunctions();
    async function user(role) {
      const id = randomUUID();
      await db.query('insert into auth.users values ($1,$2,$3)',
        [id, `${role}@example.com`, JSON.stringify({ role, full_name: 'Test Person' })]);
      if (role === 'admin') await db.query("update profiles set role='admin' where id=$1", [id]);
      return id;
    }
    const farmer = await user('farmer');
    const vendor = await user('vendor');
    const driver = await user('driver');
    const otherDriver = await user('driver');
    const admin = await user('admin');
    const dates = (await db.query(`select
      (((now() at time zone 'Asia/Manila')::date - 1)::text || 'T00:00:00Z') as yesterday,
      (((now() at time zone 'Asia/Manila')::date)::text || 'T00:00:00Z') as today,
      (((now() at time zone 'Asia/Manila')::date + 1)::text || 'T00:00:00Z') as future`)).rows[0];
    async function book(date, requester = farmer, extras = {}) {
      const row = { requester_id: requester, scheduled_pickup_at: date,
        pickup_address: 'Pickup town', dropoff_address: 'Dropoff town', goods_description: 'Mangoes',
        pickup_lat: 14.5, pickup_lng: 121, dropoff_lat: 14.5, dropoff_lng: 121, distance_km: 1, ...extras };
      return (await db.query(`insert into deliveries (${Object.keys(row).join(',')})
        values (${Object.keys(row).map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(row))).rows[0];
    }
    const expired = await book(dates.yesterday);
    const cancelMe = await book(dates.yesterday);
    const today = await book(dates.today);
    const future = await book(dates.future);
    const undated = await book(null);
    const capTarget = await book(dates.today);
    const assigned = await book(dates.yesterday, farmer, { status: 'driver_assigned', driver_id: otherDriver });
    const history = await book(dates.yesterday, farmer, { status: 'delivered', driver_id: otherDriver });
    const snapshot = async () => (await db.query('select * from deliveries order by id')).rows;
    const before = await snapshot();
    const migration = readFileSync(join(dir, files[21]), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual(await originalFunctions(), original);
    console.log('PASS migrations 0001–0022 apply; 0022 reruns; existing rows and 0020 functions unchanged');
    const preflight = migration.slice(migration.indexOf('-- select '), migration.indexOf(';\n-- Existing'))
      .split('\n').map(line => line.replace(/^-- ?/, '')).join('\n');
    assert.equal(Number((await db.query(preflight)).rows[0].past_date_open_requests), 2);
    console.log('PASS read-only preflight counts only expired, pending, unassigned requests');

    for (const zone of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
      await db.query("select set_config('TimeZone',$1,false)", [zone]);
      for (const [instant, expected] of [['2026-10-20T15:30:00Z', false], ['2026-10-20T16:30:00Z', true]]) {
        const result = await db.query(`select public.pickup_date_passed('2026-10-20T00:00:00Z',
          ($1::timestamptz at time zone 'Asia/Manila')::date) as passed`, [instant]);
        assert.equal(result.rows[0].passed, expected);
      }
      assert.equal((await db.query('select pickup_date_passed(null) as passed')).rows[0].passed, false);
      assert.equal((await db.query('select pickup_date_passed($1) as passed', [dates.today])).rows[0].passed, false);
      assert.equal((await db.query('select pickup_date_passed($1) as passed', [dates.yesterday])).rows[0].passed, true);
    }
    console.log('PASS Manila 23:30/00:30 boundary, null dates, default today; independent of session time zone');

    // Supabase supplies base table privileges outside the migration history.
    // These grants reproduce the privileges needed to exercise real RLS.
    await db.exec(`grant select on profiles, deliveries to authenticated;
      grant insert, update on deliveries to authenticated;
      grant usage, select on sequence delivery_code_seq to authenticated;`);
    async function actAs(id, rls = true) {
      await db.exec('reset role');
      await db.exec('delete from rate_limits');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claim.role','authenticated',false)");
      if (rls) {
        await db.exec('set role authenticated');
        assert.equal((await db.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user')).rows[0].rolsuper, false);
      }
    }
    const accept = (job, id) => db.query("update deliveries set driver_id=$1,status='driver_assigned' where id=$2 returning id", [id, job.id]);
    const fails = (action, message) => assert.rejects(action, e => e.code === 'P0001' && e.message === message);

    // A privileged read with driver JWT reaches the trigger despite hidden-row RLS.
    await actAs(driver, false);
    await fails(() => accept(expired, driver), expiredMessage);
    console.log('PASS expired accept trigger returns the exact required error');

    await actAs(driver);
    const visible = (await db.query('select id from deliveries')).rows.map(r => r.id);
    assert(!visible.includes(expired.id));
    assert(!visible.includes(assigned.id));
    for (const job of [today, future, undated]) assert(visible.includes(job.id));
    assert.equal((await accept(expired, driver)).rows.length, 0);
    assert.equal((await accept(today, driver)).rows.length, 1);
    assert.equal((await accept(future, driver)).rows.length, 1);
    await fails(() => accept(capTarget, driver), 'You already have 2 active jobs. Finish one to accept more.');
    console.log('PASS real driver RLS hides expired open rows; today/future accept; two-job cap keeps its exact message');

    await actAs(otherDriver);
    assert.equal((await accept(undated, otherDriver)).rows.length, 1);
    const own = (await db.query('select id from deliveries')).rows.map(r => r.id);
    assert(own.includes(assigned.id));
    assert(own.includes(history.id));
    assert(!own.includes(expired.id));
    // Existing past-date assignment may still progress normally.
    assert.equal((await db.query("update deliveries set status='picked_up' where id=$1 returning id", [assigned.id])).rows.length, 1);
    console.log('PASS null pickup accepts; real RLS preserves own past-date assigned/history jobs and status progression');

    await actAs(farmer);
    assert.equal((await db.query('select id from deliveries where id=$1', [expired.id])).rows.length, 1);
    assert.equal((await db.query("update deliveries set status='cancelled' where id=$1 returning id", [cancelMe.id])).rows.length, 1);
    console.log('PASS real requester RLS preserves expired request visibility and cancellation');

    for (const id of [farmer, vendor]) {
      await actAs(id);
      await fails(() => book(dates.yesterday, id), 'Pick today or a later date.');
      for (const date of [dates.today, dates.future, null]) await book(date, id);
    }
    console.log('PASS farmer/vendor inserts: past rejected with exact message; today/future/null accepted under RLS');

    await actAs(admin);
    assert.equal((await db.query('select id from deliveries where id=$1', [expired.id])).rows.length, 1);
    await book(dates.yesterday);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await book(dates.yesterday);
    console.log('PASS admin visibility/inserts and trusted SQL inserts retain existing behavior');
    console.log('PASS all past-pickup-date tests, including authenticated-role RLS');
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
