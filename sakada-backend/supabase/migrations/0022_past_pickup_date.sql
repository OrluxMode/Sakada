-- 0022: expired pending requests leave the driver's open-jobs list.
-- Read-only preflight (run before applying; these requests will be hidden):
-- select count(*) as past_date_open_requests
-- from public.deliveries
-- where status = 'pending' and driver_id is null
--   and (scheduled_pickup_at at time zone 'UTC')::date
--       < (now() at time zone 'Asia/Manila')::date;
-- Existing rows are not modified or cancelled.

-- The website stores the selected calendar date at UTC midnight. Compare
-- that UTC date to TODAY IN MANILA, independent of the session time zone.
-- The optional today argument permits deterministic boundary tests; all
-- production callers below use the default, never a client-supplied date.
create or replace function public.pickup_date_passed(
  ts timestamptz,
  today date default (now() at time zone 'Asia/Manila')::date
) returns boolean
language sql stable
set search_path = public
as $$
  select coalesce((ts at time zone 'UTC')::date < today, false);
$$;

create or replace function public.guard_pickup_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Preserve trusted SQL/service-role and admin inserts, like 0018/0020.
    -- RLS permits ordinary booking inserts only from farmers/vendors.
    if auth.uid() is not null and not public.is_admin()
       and public.pickup_date_passed(new.scheduled_pickup_at) then
      raise exception 'Pick today or a later date.';
    end if;
  elsif old.status = 'pending' and new.status = 'driver_assigned'
        and public.pickup_date_passed(old.scheduled_pickup_at) then
    raise exception 'This pickup date has passed. The farmer or vendor needs to book a new date.';
  end if;
  return new;
end;
$$;

-- Alphabetical BEFORE-trigger order checks the date before the job cap.
-- All 0020 functions, including its cap/locking and update guard, stay intact.
drop trigger if exists trg_check_pickup_date on public.deliveries;
create trigger trg_check_pickup_date
  before insert or update on public.deliveries
  for each row execute function public.guard_pickup_date();

drop policy if exists "drivers can view unassigned pending deliveries" on public.deliveries;
create policy "drivers can view unassigned pending deliveries"
  on public.deliveries for select
  using (
    status = 'pending' and driver_id is null
    and not public.pickup_date_passed(scheduled_pickup_at)
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'driver'
    )
  );
-- Requester, assigned-driver and admin policies are deliberately unchanged.
-- With RLS, an UPDATE of an already-hidden row may affect zero rows before
-- any trigger runs; callers must also handle a zero-row acceptance result.
