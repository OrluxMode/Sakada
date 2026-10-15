-- 0020: driver rules confirmed by the owner (2026-10-15).
--   1. A driver holds at most 2 active jobs (accepted, picked up or in
--      transit). The database refuses a third accept, even from a direct
--      API call or two taps at the same moment.
--   2. A driver can mark a delivery Delivered even if the receiver didn't
--      pay. The job closes on delivery, not payment. With that step the
--      driver records payment_status = 'paid' or 'unpaid'; unpaid ones are
--      flagged on the admin dashboard so Sakada can follow up.
--   3. status_changed_at: when the status last changed, for lines like
--      "Picked up 9:20 AM". updated_at can't be used: it also moves with
--      every location push.
--
-- Safe to run before or after the website update: the old driver page
-- leaves payment_status empty, which is allowed.

-- 1. New columns ---------------------------------------------------------
alter table deliveries
  add column if not exists payment_status text,
  add column if not exists status_changed_at timestamptz;

alter table deliveries drop constraint if exists deliveries_payment_status_check;
alter table deliveries add constraint deliveries_payment_status_check
  check (payment_status is null or payment_status in ('paid', 'unpaid'));

update deliveries set status_changed_at = updated_at where status_changed_at is null;
alter table deliveries alter column status_changed_at set default now();

create index if not exists idx_deliveries_unpaid
  on deliveries (updated_at desc) where payment_status = 'unpaid';

-- 2. Stamp status_changed_at on every status change ----------------------
create or replace function stamp_status_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  elsif new.status_changed_at is distinct from old.status_changed_at then
    new.status_changed_at := old.status_changed_at; -- nobody sets it by hand
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_stamp_status_change on deliveries;
create trigger trg_stamp_status_change
  before insert or update on deliveries
  for each row execute function stamp_status_change();

-- 3. At most 2 active jobs per driver -------------------------------------
create or replace function enforce_driver_job_cap()
returns trigger as $$
declare
  active_count int;
begin
  if new.driver_id is not null
     and new.status = 'driver_assigned'
     and (old.driver_id is distinct from new.driver_id or old.status is distinct from new.status)
  then
    -- One accept at a time per driver, so two quick taps can't both pass.
    perform pg_advisory_xact_lock(hashtext('sakada-driver-jobs:' || new.driver_id::text));
    select count(*) into active_count
      from deliveries
     where driver_id = new.driver_id
       and id <> new.id
       and status in ('driver_assigned', 'picked_up', 'in_transit');
    if active_count >= 2 then
      raise exception 'You already have 2 active jobs. Finish one to accept more.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_enforce_driver_job_cap on deliveries;
create trigger trg_enforce_driver_job_cap
  before update on deliveries
  for each row execute function enforce_driver_job_cap();

-- 4. The assigned driver may record payment, only with the Delivered step --
-- Same as 0016's guard, plus payment_status in rule 2.
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

  -- 2. The assigned driver moving status (0007 validates the step),
  --    pushing their live location, or saying whether the receiver paid
  --    (only together with in_transit -> delivered, and only once).
  if old.driver_id = uid and new.driver_id = uid
     and changed <@ array['status', 'current_lat', 'current_lng', 'payment_status']
     and (
       not ('payment_status' = any(changed))
       or (old.status = 'in_transit' and new.status = 'delivered'
           and old.payment_status is null
           and new.payment_status in ('paid', 'unpaid'))
     )
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

-- New deliveries start with no payment recorded.
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
  new.payment_status := null;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
