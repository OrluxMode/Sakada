-- Phase 8: notifications generated from real status changes, not from
-- front-end code remembering to call an API. Runs alongside the existing
-- status-history trigger (0002) — same event, two different purposes:
-- history is a full audit trail, this is a human-readable message for
-- exactly one person (whoever requested the delivery).
--
-- Deliberately targets only `requester_id` for now. Every event a driver
-- causes (accepted, picked up, in transit, delivered) is something the
-- farmer/vendor genuinely needs to know. Nothing in the current feature
-- set produces an event a driver needs to be notified about after they've
-- already accepted — a requester can only cancel while still `pending`,
-- before any driver is involved. If that changes later (e.g. a requester
-- cancels after assignment), this trigger is the place to extend.

create or replace function notify_on_status_change()
returns trigger as $$
declare
  msg text;
begin
  if new.status = old.status then
    return new;
  end if;

  msg := case new.status
    when 'driver_assigned' then 'A driver accepted your delivery ' || new.delivery_code || '.'
    when 'picked_up' then 'Your delivery ' || new.delivery_code || ' has been picked up.'
    when 'in_transit' then 'Your delivery ' || new.delivery_code || ' is in transit.'
    when 'delivered' then 'Your delivery ' || new.delivery_code || ' has been delivered.'
    when 'cancelled' then 'Your delivery ' || new.delivery_code || ' was cancelled.'
    else null
  end;

  if msg is not null then
    insert into notifications (user_id, delivery_id, message)
    values (new.requester_id, new.id, msg);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notify_on_status_change
  after update on deliveries
  for each row execute function notify_on_status_change();