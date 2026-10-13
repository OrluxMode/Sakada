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
