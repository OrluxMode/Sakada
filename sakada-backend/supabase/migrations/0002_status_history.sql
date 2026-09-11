-- Delivery status history — Phase 6 (real status lifecycle) + Phase 9 (history)
-- Every status a delivery ever passed through, who caused it, and when.
-- This is what "delivery history" actually reads from, not just the
-- current status on the deliveries row.

create table delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  status delivery_status not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

create index idx_status_history_delivery on delivery_status_history(delivery_id);

-- Auto-log every insert and every status change — nobody has to remember
-- to write to this table manually from the front end.
create or replace function log_delivery_status_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (old.status is distinct from new.status) then
    insert into delivery_status_history (delivery_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_status_insert after insert on deliveries
  for each row execute function log_delivery_status_change();

create trigger trg_log_status_update after update on deliveries
  for each row execute function log_delivery_status_change();