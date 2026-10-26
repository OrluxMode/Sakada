// npm install --prefix /tmp/sakada-text-limits-test @electric-sql/pglite
// NODE_PATH=/tmp/sakada-text-limits-test/node_modules node sakada-backend/tests/language-and-push.cjs
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
      grant execute on all functions in schema auth to authenticated, anon;
      -- Storage DDL only, as in saved-addresses.cjs.
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable
        as $$ select string_to_array($1, '/') $$;
    `);
    const dir = join(__dirname, '../supabase/migrations');
    const files = readdirSync(dir).filter(f => /^00(0[1-9]|1[0-9]|2[0-8])_.*\.sql$/.test(f)).sort();
    assert.equal(files.length, 28);
    // Check the existing-profile default/backfill too.
    for (const file of files.slice(0, 26)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    const a = randomUUID(), b = randomUUID();
    for (const id of [a, b]) await db.query('insert into auth.users values ($1,$2,$3)',
      [id, `${id}@example.com`, JSON.stringify({ role: 'farmer', full_name: 'Test Person' })]);
    for (const file of files.slice(26)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual((await db.query('select language from profiles')).rows.map(r => r.language), ['en', 'en']);
    for (const file of files.slice(26)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    console.log('PASS migrations 0001–0028; 0027/0028 rerun; existing profiles default to en');
    await db.exec('grant select on profiles to authenticated'); // Hosted base grant.
    async function actAs(id, role = 'authenticated') {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
      await db.query("select set_config('request.jwt.claim.role',$1,false)", [role]);
      await db.exec(`set role ${role}`);
      const result = (await db.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user')).rows[0];
      assert.equal(result.rolsuper, false); assert.equal(result.rolbypassrls, false);
    }
    const fail = (action, code) => assert.rejects(action, e => e.code === code);
    const save = (endpoint, key = 'key', auth = 'auth', agent = null) =>
      db.query('select save_push_subscription($1,$2,$3,$4)', [endpoint, key, auth, agent]);
    const remove = endpoint => db.query('select delete_push_subscription($1)', [endpoint]);
    await actAs(a);
    for (const language of ['fil', 'taglish']) {
      await db.query('update profiles set language=$1 where id=$2', [language, a]);
      assert.equal((await db.query('select language from profiles where id=$1', [a])).rows[0].language, language);
    }
    await fail(() => db.query("update profiles set language='es' where id=$1", [a]), '23514');
    await fail(() => db.query('update profiles set language=null where id=$1', [a]), '23502');
    assert.equal((await db.query("update profiles set language='fil' where id=$1 returning id", [b])).rows.length, 0);
    await fail(() => db.query("update profiles set role='admin' where id=$1", [a]), '42501');
    console.log('PASS owner language updates, invalid values and foreign profile/role protection');
    const shared = 'https://push.example/shared';
    await save(shared, 'first', 'auth', 'Test browser');
    await save(shared, 'second');
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 1);
    assert.equal((await db.query('select * from push_subscriptions')).rows[0].p256dh, 'second');
    await actAs(b);
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 0);
    await remove(shared);
    assert.equal((await db.query('delete from push_subscriptions where endpoint=$1 returning id', [shared])).rows.length, 0);
    await save(shared, 'new-owner');
    assert.equal((await db.query('select * from push_subscriptions')).rows[0].user_id, b);
    await actAs(a);
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 0);
    await remove(shared);
    console.log('PASS endpoint re-save, shared-phone transfer, private SELECT and foreign DELETE protection');
    await save('https://push.example/oldest');
    await db.exec('reset role');
    await db.query("update push_subscriptions set created_at='2000-01-01' where user_id=$1", [a]);
    await actAs(a);
    for (let i = 1; i <= 10; i++) await save(`https://push.example/phone-${i}`);
    let rows = (await db.query('select * from push_subscriptions')).rows;
    assert.equal(rows.length, 10);
    assert(!rows.some(r => r.endpoint.endsWith('/oldest')));
    assert(rows.some(r => r.endpoint.endsWith('/phone-10')));
    for (const args of [
      ['http://push.example/insecure'], ['https://' + 'x'.repeat(993)],
      [null], ['https://push.example/key', 'x'.repeat(201)],
      ['https://push.example/auth', 'key', 'x'.repeat(201)],
      ['https://push.example/agent', 'key', 'auth', 'x'.repeat(301)],
      ['https://push.example/empty-key', ''], ['https://push.example/empty-auth', 'key', ''],
    ]) await fail(() => save(...args), args[0] === null ? '23502' : '23514');
    await fail(() => db.query("insert into push_subscriptions(user_id,endpoint,p256dh,auth) values ($1,'https://push.example/direct','k','a')", [a]), '42501');
    await fail(() => db.query('update push_subscriptions set user_id=$1', [b]), '42501');
    await fail(() => db.query('update push_subscriptions set last_sent_at=now()'), '42501');
    await remove('https://push.example/phone-10');
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 9);
    const owned = (await db.query('select endpoint from push_subscriptions limit 1')).rows[0].endpoint;
    assert.equal((await db.query('delete from push_subscriptions where endpoint=$1 returning id', [owned])).rows.length, 1);
    await actAs(b);
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 1);
    console.log('PASS ten-phone cap/oldest eviction, validation, no direct writes, owner RPC/direct deletes');
    await actAs(a);
    await save('https://' + 'x'.repeat(992), 'x'.repeat(200), 'x'.repeat(200), 'x'.repeat(300));
    await save('https://push.example/fill-cap');
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 10);
    await save(shared);
    rows = (await db.query('select * from push_subscriptions')).rows;
    assert.equal(rows.length, 10);
    assert(rows.some(r => r.endpoint === shared));
    await actAs(b);
    assert.equal((await db.query('select * from push_subscriptions')).rows.length, 0);
    await save(shared);
    console.log('PASS exact maximum input sizes and endpoint transfer into a full receiving account');
    // A second rerun preserves saved data and chosen languages.
    await db.exec('reset role');
    const before = (await db.query('select * from push_subscriptions order by id')).rows;
    for (const file of files.slice(26)) await db.exec(readFileSync(join(dir, file), 'utf8'));
    assert.deepEqual((await db.query('select * from push_subscriptions order by id')).rows, before);
    assert.equal((await db.query('select language from profiles where id=$1', [a])).rows[0].language, 'taglish');
    await actAs(null);
    await fail(() => save('https://push.example/no-user'), '42501');
    await fail(() => remove(shared), '42501');
    await actAs(null, 'anon');
    await fail(() => save('https://push.example/anon'), '42501');
    await fail(() => remove(shared), '42501');
    await fail(() => db.query('select * from push_subscriptions'), '42501');
    console.log('PASS populated reruns preserve data; missing auth and anon cannot call either RPC');
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [b]);
    assert.equal((await db.query('select * from push_subscriptions where user_id=$1', [b])).rows.length, 0);
    console.log('PASS account deletion cascades subscriptions; all language/push database checks passed');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
