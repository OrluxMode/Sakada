-- Extends Phase 8: notify every driver the moment a new delivery is
-- created and still pending (i.e. actually available to accept), rather
-- than requiring drivers to keep manually checking Available Deliveries.
--
-- Runs on INSERT, separately from 0008's UPDATE trigger — a brand new
-- delivery is a different event from a status change on an existing one,
-- and this one fans out to many recipients (every driver) instead of one
-- (the requester), so it's kept as its own function rather than merged in.

create or replace function notify_drivers_new_delivery()
returns trigger as $$
declare
  driver_row record;
  msg text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  msg := 'New delivery available: ' || new.pickup_address || ' → ' || new.dropoff_address || ' (' || new.delivery_code || ').';

  for driver_row in select id from profiles where role = 'driver' loop
    insert into notifications (user_id, delivery_id, message)
    values (driver_row.id, new.id, msg);
  end loop;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notify_drivers_new_delivery
  after insert on deliveries
  for each row execute function notify_drivers_new_delivery();