# Security rollout: step by step

Do the steps **in this order**. After each step, run its check query in the Supabase **SQL Editor** and compare the result. If anything doesn't match, **stop** and send me the result.

---

## Step 0: Back up
Supabase dashboard → **Database → Backups**. Make sure a recent backup exists, or create one.

---

## Step 1: Run `0015_contact_columns.sql`
Open `sakada-backend/supabase/migrations/0015_contact_columns.sql`, copy the whole file into the SQL Editor, and click **Run**.

**Check:**
```sql
select column_name from information_schema.columns
where table_name = 'contact_submissions' order by column_name;
```
✅ Expect 8 rows: `created_at, email, id, message, name, phone, purpose, role`

---

## Step 2: Run `0016_rls_hardening.sql`
Copy, paste, **Run**.

**Check A: the new triggers exist**
```sql
select tgname from pg_trigger
where tgrelid = 'deliveries'::regclass and not tgisinternal
order by tgname;
```
✅ The list includes `trg_guard_delivery_insert` and `trg_guard_delivery_update`.

**Check B: a normal user can only see their own profile.** This pretends to be one of your farmers, then undoes everything:
```sql
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from profiles where role = 'farmer' limit 1),
                    'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as profiles_visible from profiles;
rollback;
```
✅ Expect `profiles_visible = 1` (before this step it was the total number of users).

---

## Step 3: Run `0017_delivery_distance.sql`
Copy, paste, **Run**.

**Check:**
```sql
select column_name from information_schema.columns
where table_name = 'deliveries' and column_name = 'distance_km';
```
✅ Expect 1 row: `distance_km`

---

## Step 4: Push the website
Commit and push as usual. Wait until Vercel shows the deploy as **Ready**.

**Check on the live site:**
1. **Contact page:** send a test message. ✅ You get the success message (this was failing before).
2. **Farmer account:** get a quote and book a delivery. ✅ The booking works.
3. **Driver account:** accept that delivery and move it one step. ✅ Works.
4. **Security headers:** open the browser DevTools → Network → click the page request → Response Headers. ✅ You see `x-frame-options: DENY` and `referrer-policy`.

---

## Step 5: Run `0018_server_pricing_rate_limits_initial_role.sql`
Copy, paste, **Run**. (Only after step 4 is live.)

**Check A: the triggers and functions exist**
```sql
select tgname from pg_trigger
where tgrelid = 'deliveries'::regclass and not tgisinternal
order by tgname;
```
✅ The list now also includes `trg_price_delivery` and `trg_rate_limit_deliveries`.

**Check B: every existing account keeps its role**
```sql
select count(*) as unconfirmed from profiles where role_confirmed_at is null;
```
✅ Expect `0`.

**Check C, on the live site:**
1. **Booking:** as a farmer, book a delivery. ✅ It works, and the price matches the quote.
2. **Rate limit:** book 4 deliveries within one minute. ✅ The 4th one shows "Too many requests. Please wait a minute and try again." Cancel the test bookings afterwards with your admin account.
3. **Google sign-up (optional):** sign up with a **new** Google account, choosing **Driver**. ✅ You land on the driver dashboard.

---

## If something goes wrong
- **Step 1–3 failed:** nothing on the live site depends on these changes yet. Send me the error.
- **Bookings fail after step 5:** send me the error message shown on the dashboard. Quick undo (removes only the new price and rate-limit checks):
  ```sql
  drop trigger if exists trg_price_delivery on deliveries;
  drop trigger if exists trg_rate_limit_deliveries on deliveries;
  ```
