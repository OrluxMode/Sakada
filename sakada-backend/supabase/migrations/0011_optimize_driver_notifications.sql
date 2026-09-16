-- Optimize the driver notification fan-out (migration 0009).
--
-- Problem: Every new pending delivery inserts a notification row for
-- EVERY driver in the system. At 10,000 drivers, one delivery creates
-- 10,000 notification rows. Most drivers never see them.
--
-- Solution: Only notify drivers who have logged in within the last 7
-- days. This requires a `last_login_at` column on profiles, updated
-- by the frontend on each dashboard visit. Drivers who haven't logged
-- in for a week are considered inactive and are skipped.

-- 1. Add last_login_at column to profiles
alter table profiles add column last_login_at timestamptz default now();

-- Backfill existing rows so they aren't immediately skipped
update profiles set last_login_at = created_at where last_login_at is null;

-- 2. Function for the frontend to call after login / page load
-- SECURITY DEFINER so any authenticated user can update their own row.
create or replace function update_my_last_login()
returns void as $$
begin
  update profiles
  set last_login_at = now()
  where id = auth.uid();
end;
$$ language plpgsql security definer set search_path = public;

-- 3. Replace the per-driver INSERT loop with an active-driver-only loop
create or replace function notify_drivers_new_delivery()
returns trigger as $$
declare
  driver_row record;
  msg text;
  cutoff timestamptz := now() - interval '7 days';
begin
  if new.status <> 'pending' then
    return new;
  end if;

  msg := 'New delivery available: ' || new.pickup_address || ' → ' || new.dropoff_address || ' (' || new.delivery_code || ').';

  for driver_row in
    select id from profiles
    where role = 'driver'
      and last_login_at >= cutoff
  loop
    insert into notifications (user_id, delivery_id, message)
    values (driver_row.id, new.id, msg);
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger stays the same (already created in 0009)
-- The function body above replaces it in-place.
