# OpenCode task: security migrations 0015–0018 (database only)

You are writing 4 new Supabase SQL migration files for Sakada Logistics. They fix security findings N1, N3–N7, N9 and N21 from `claude read and analyze.md`, plus the database half of N2. The full SQL is given below. **Create the files with exactly this content.** Don't "improve", reorder or shorten the SQL. If you believe something is wrong, keep it as written and mention it in your report.

**Do NOT run these against any database.** Don't run `supabase db push`, and don't connect to Supabase at all. The owner applies them by hand, in a specific order, after review. Don't commit.

## Files to create (in `sakada-backend/supabase/migrations/`)
- `0015_contact_columns.sql`
- `0016_rls_hardening.sql`
- `0017_delivery_distance.sql`
- `0018_server_pricing_rate_limits_initial_role.sql`

Also update `sakada-backend/Readme.md`: wherever it lists or counts the migrations ("through 0013" etc.), make it list 0001–0018. Add a one-line description for each new file (use the header comment of each file). Change nothing else in the Readme.

Touch nothing else. No JS, HTML or CSS changes in this task.

---

## `0015_contact_columns.sql`
```sql
-- 0015: contact form columns (fixes N1).
-- js/contact.js inserts phone, role and purpose, but 0014 only created
-- name, email and message, so every submit was rejected.
-- This table accepts anonymous inserts, so every column also gets a
-- size/shape limit. NOT VALID = enforce on new rows without re-checking
-- any rows that already exist.

alter table contact_submissions
  add column if not exists phone   text,
  add column if not exists role    text,
  add column if not exists purpose text;

alter table contact_submissions
  drop constraint if exists contact_name_len,
  drop constraint if exists contact_email_len,
  drop constraint if exists contact_phone_len,
  drop constraint if exists contact_role_valid,
  drop constraint if exists contact_purpose_valid,
  drop constraint if exists contact_message_len;

alter table contact_submissions
  add constraint contact_name_len
    check (char_length(name) between 1 and 120) not valid,
  add constraint contact_email_len
    check (char_length(email) between 3 and 254) not valid,
  add constraint contact_phone_len
    check (phone is null or char_length(phone) <= 40) not valid,
  add constraint contact_role_valid
    check (role is null or role in ('farmer', 'vendor', 'driver', 'partner')) not valid,
  add constraint contact_purpose_valid
    check (purpose is null or purpose in ('booking', 'driver', 'vendor', 'support', 'other')) not valid,
  add constraint contact_message_len
    check (char_length(message) between 1 and 5000) not valid;
```

## `0016_rls_hardening.sql`
```sql
-- 0016: RLS hardening (fixes N3, N4, N7, N9, N21).
--   N9  SECURITY DEFINER / trigger functions get a fixed search_path.
--   N7  profiles and driver_profiles are no longer readable by every
--       signed-in user (phone numbers, license numbers, live location).
--       The app only ever reads the caller's own profile, and admins read all.
--   N4  a delivery can only be changed in the ways the app actually uses:
--       a driver accepting it, the assigned driver moving status/location,
--       and the requester cancelling while it is still pending.
--   N21 only real drivers can accept, and nobody can accept their own request.
--   N3  a rating must be about the OTHER party on that delivery.
--   Plus: inserts can't pre-set a driver or status, notifications can
--   only have is_read changed, and profiles can only have
--   full_name/phone/avatar_url changed by their owner.

-- N9 -------------------------------------------------------------------
alter function public.log_delivery_status_change() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.cleanup_rate_limits() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.validate_status_transition() set search_path = public;

-- N7 -------------------------------------------------------------------
drop policy if exists "profiles viewable by any signed-in user" on profiles;
drop policy if exists "users can view their own profile" on profiles;
drop policy if exists "admins can view all profiles" on profiles;
create policy "users can view their own profile"
  on profiles for select using (auth.uid() = id);
create policy "admins can view all profiles"
  on profiles for select using (is_admin());

drop policy if exists "any signed-in user can view driver profile" on driver_profiles;
drop policy if exists "owner or admin can view driver profile" on driver_profiles;
create policy "owner or admin can view driver profile"
  on driver_profiles for select using (auth.uid() = id or is_admin());

-- Owners may only edit harmless profile fields (role, created_at,
-- last_login_at etc. stay server-controlled).
revoke update on profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on profiles to authenticated;

-- N21: accept policy now requires the caller to be a driver --------------
drop policy if exists "driver can accept an unassigned pending delivery" on deliveries;
create policy "driver can accept an unassigned pending delivery"
  on deliveries for update
  using (
    status = 'pending' and driver_id is null
    and exists (select 1 from profiles where id = auth.uid() and role = 'driver')
  )
  with check (driver_id = auth.uid() and status = 'driver_assigned');

-- N4 + N21: column-level guard for every non-admin delivery update -----
create or replace function guard_delivery_update()
returns trigger as $$
declare
  uid uuid := auth.uid();
  changed text[];
begin
  -- Service role / SQL editor (no auth.uid()) and admins are trusted.
  if uid is null or is_admin() then
    return new;
  end if;

  select coalesce(array_agg(n.key), '{}')
    into changed
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value
    and n.key <> 'updated_at';

  if cardinality(changed) = 0 then
    return new;
  end if;

  -- 1. A driver accepting an unassigned pending delivery.
  if old.status = 'pending' and old.driver_id is null
     and new.driver_id = uid and new.status = 'driver_assigned'
     and uid <> old.requester_id
     and changed <@ array['driver_id', 'status']
     and exists (select 1 from profiles where id = uid and role = 'driver')
  then
    return new;
  end if;

  -- 2. The assigned driver moving status (0007 validates the step) or
  --    pushing their live location.
  if old.driver_id = uid and new.driver_id = uid
     and changed <@ array['status', 'current_lat', 'current_lng']
  then
    return new;
  end if;

  -- 3. The requester cancelling while it's still pending.
  if old.requester_id = uid and old.status = 'pending'
     and new.status = 'cancelled'
     and changed <@ array['status']
  then
    return new;
  end if;

  raise exception 'You are not allowed to make this change to the delivery.';
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_delivery_update on deliveries;
create trigger trg_guard_delivery_update
  before update on deliveries
  for each row execute function guard_delivery_update();

-- New deliveries always start clean: no driver, pending, no location.
create or replace function guard_delivery_insert()
returns trigger as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  new.status := 'pending';
  new.driver_id := null;
  new.current_lat := null;
  new.current_lng := null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_delivery_insert on deliveries;
create trigger trg_guard_delivery_insert
  before insert on deliveries
  for each row execute function guard_delivery_insert();

-- N3: you can only rate the other party on a delivered delivery ---------
drop policy if exists "involved party can rate the other side once delivered" on ratings;
create policy "involved party can rate the other side once delivered"
  on ratings for insert
  with check (
    auth.uid() = rated_by
    and rated_user_id <> auth.uid()
    and exists (
      select 1 from deliveries d
      where d.id = delivery_id
        and d.status = 'delivered'
        and (
          (d.requester_id = auth.uid() and d.driver_id = rated_user_id)
          or (d.driver_id = auth.uid() and d.requester_id = rated_user_id)
        )
    )
  );

-- Notifications: users may only flip is_read ----------------------------
revoke update on notifications from anon, authenticated;
grant update (is_read) on notifications to authenticated;
```

## `0017_delivery_distance.sql`
```sql
-- 0017: store the route distance the fare was computed from (prep for N5).
-- Added on its own so the website can start sending it before 0018
-- starts requiring it. Safe to run any time; nothing reads it yet.

alter table deliveries
  add column if not exists distance_km numeric;
```

## `0018_server_pricing_rate_limits_initial_role.sql`
```sql
-- 0018: server-side pricing (N5), enforced rate limits (N6), and the
-- first-login role choice for Google sign-ups (N2).
-- Run this only AFTER the website version that sends distance_km and
-- calls set_initial_role is live.

-- N5: the database computes the fare -----------------------------------
create or replace function haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$ language sql immutable set search_path = public;

create or replace function price_delivery()
returns trigger as $$
declare
  straight double precision;
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.pickup_lat is null or new.pickup_lng is null
     or new.dropoff_lat is null or new.dropoff_lng is null
     or new.distance_km is null then
    raise exception 'Pickup, drop-off and route distance are required to price a delivery.';
  end if;

  if new.quantity_kg is not null and new.quantity_kg <= 0 then
    raise exception 'Load must be more than 0 kg.';
  end if;

  -- A driving route can't be shorter than the straight line, and is
  -- rarely more than about 3x longer.
  straight := haversine_km(new.pickup_lat, new.pickup_lng, new.dropoff_lat, new.dropoff_lng);
  if new.distance_km < straight * 0.95 or new.distance_km > straight * 3 + 10 then
    raise exception 'The route distance does not match the pickup and drop-off locations.';
  end if;

  -- Same formula as js/mapbox-client.js estimateCost():
  -- ₱150 base + ₱15 per km + ₱2 per kg, rounded to the peso.
  new.estimated_cost := round(150 + 15 * new.distance_km + 2 * coalesce(new.quantity_kg, 0));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_price_delivery on deliveries;
create trigger trg_price_delivery
  before insert on deliveries
  for each row execute function price_delivery();

-- N6: rate limits enforced by the database, with fixed limits -----------
create or replace function enforce_rate_limit(
  p_operation text, p_max int, p_window_seconds int
) returns void as $$
declare
  uid uuid := auth.uid();
  recent int;
begin
  if uid is null then
    return;
  end if;
  delete from rate_limits
   where user_id = uid and operation = p_operation
     and performed_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into recent
    from rate_limits
   where user_id = uid and operation = p_operation;
  if recent >= p_max then
    raise exception 'Too many requests. Please wait a minute and try again.';
  end if;
  insert into rate_limits (user_id, operation) values (uid, p_operation);
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function enforce_rate_limit(text, int, int) from public, anon, authenticated;

create or replace function rate_limit_deliveries()
returns trigger as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    perform enforce_rate_limit('create_delivery', 3, 60);
  elsif new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'driver_assigned' then
      perform enforce_rate_limit('accept_delivery', 3, 60);
    else
      perform enforce_rate_limit('update_status', 5, 60);
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_rate_limit_deliveries on deliveries;
create trigger trg_rate_limit_deliveries
  before insert or update on deliveries
  for each row execute function rate_limit_deliveries();

-- The old client-called check is now a harmless no-op, so any old
-- browser tab that still calls it keeps working.
drop function if exists check_rate_limit(text, int, int);
create function check_rate_limit(
  p_operation text,
  p_max_per_window int default 3,
  p_window_seconds int default 60
) returns boolean as $$
  select true;
$$ language sql stable set search_path = public;
grant execute on function check_rate_limit(text, int, int) to authenticated;

-- Old rows from the client-side limiter are no longer needed.
delete from rate_limits where performed_at < now() - interval '1 hour';

-- N2: let a brand-new Google account pick its role once ----------------
alter table profiles add column if not exists role_confirmed_at timestamptz;
-- Every existing account keeps the role it has now.
update profiles set role_confirmed_at = created_at where role_confirmed_at is null;

-- Email sign-ups choose a role up front, so confirm it at creation.
-- Google sign-ups arrive without one, so they stay unconfirmed.
create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  chosen_role user_role;
  confirmed boolean := false;
begin
  if requested_role is null or requested_role = 'admin'
     or requested_role not in ('farmer', 'vendor', 'driver') then
    chosen_role := 'farmer';
  else
    chosen_role := requested_role::user_role;
    confirmed := true;
  end if;

  insert into public.profiles (id, role, full_name, role_confirmed_at)
  values (
    new.id,
    chosen_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when confirmed then now() else null end
  );

  if chosen_role = 'farmer' then
    insert into public.farmer_profiles (id) values (new.id);
  elsif chosen_role = 'vendor' then
    insert into public.vendor_profiles (id) values (new.id);
  elsif chosen_role = 'driver' then
    insert into public.driver_profiles (id) values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- The role-escalation guard lets set_initial_role() through, and nothing else.
create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if current_setting('sakada.initial_role_change', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'You are not allowed to change your own role.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function set_initial_role(p_role user_role)
returns void as $$
declare
  uid uuid := auth.uid();
  p profiles%rowtype;
begin
  if uid is null then
    raise exception 'Not signed in.';
  end if;
  if p_role not in ('farmer', 'vendor', 'driver') then
    raise exception 'Invalid role.';
  end if;

  select * into p from profiles where id = uid for update;
  if not found then
    raise exception 'Profile not found.';
  end if;
  if p.role_confirmed_at is not null then
    raise exception 'Your role is already set.';
  end if;
  if p.created_at < now() - interval '15 minutes' then
    raise exception 'The role can only be chosen right after sign-up.';
  end if;
  if exists (select 1 from deliveries where requester_id = uid or driver_id = uid) then
    raise exception 'The role can no longer be changed for this account.';
  end if;

  if p_role <> p.role then
    delete from farmer_profiles where id = uid;
    delete from vendor_profiles where id = uid;
    delete from driver_profiles where id = uid;

    perform set_config('sakada.initial_role_change', 'on', true);
    update profiles set role = p_role where id = uid;
    perform set_config('sakada.initial_role_change', 'off', true);

    if p_role = 'farmer' then
      insert into farmer_profiles (id) values (uid);
    elsif p_role = 'vendor' then
      insert into vendor_profiles (id) values (uid);
    else
      insert into driver_profiles (id) values (uid);
    end if;
  end if;

  update profiles set role_confirmed_at = now() where id = uid;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function set_initial_role(user_role) from public, anon;
grant execute on function set_initial_role(user_role) to authenticated;
```

---

## When you're done
Reply with:
- the 4 file names you created
- the Readme lines you changed
- anything in the SQL you think is wrong (but keep it as written)

Don't run anything against Supabase.
