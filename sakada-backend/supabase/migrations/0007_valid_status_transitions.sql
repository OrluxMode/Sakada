-- Phase 6: enforce the real delivery lifecycle at the database level, not
-- just in the UI. Even if someone calls the API directly (bypassing the
-- driver dashboard buttons entirely), the database itself refuses an
-- invalid jump like pending -> delivered.

create or replace function validate_status_transition()
returns trigger as $$
begin
  -- No status change on this update (e.g. only current_lat/lng changed
  -- during Phase 7 tracking) — nothing to validate.
  if new.status = old.status then
    return new;
  end if;

  if (old.status = 'pending' and new.status in ('driver_assigned', 'cancelled'))
     or (old.status = 'driver_assigned' and new.status in ('picked_up', 'cancelled'))
     or (old.status = 'picked_up' and new.status = 'in_transit')
     or (old.status = 'in_transit' and new.status = 'delivered')
  then
    return new;
  end if;

  raise exception 'Invalid delivery status change: % -> %', old.status, new.status;
end;
$$ language plpgsql;

create trigger trg_validate_status_transition
  before update on deliveries
  for each row execute function validate_status_transition();