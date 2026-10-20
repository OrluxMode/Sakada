-- 0021: enforce booking/profile text limits even for direct API writes.
-- Preflight: run this to count existing violations per column (no data changes):
-- select 'deliveries.pickup_address' as column_name, count(*) as violations
--   from public.deliveries where char_length(btrim(pickup_address)) not between 5 and 200
-- union all select 'deliveries.dropoff_address', count(*)
--   from public.deliveries where char_length(btrim(dropoff_address)) not between 5 and 200
-- union all select 'deliveries.goods_description', count(*)
--   from public.deliveries where char_length(btrim(goods_description)) not between 2 and 120
-- union all select 'deliveries.notes', count(*)
--   from public.deliveries where char_length(btrim(notes)) > 500
-- union all select 'deliveries.quantity_kg', count(*)
--   from public.deliveries where quantity_kg not between 1 and 100000
-- union all select 'profiles.full_name', count(*)
--   from public.profiles where char_length(btrim(full_name)) not between 2 and 120;
--
-- Old rows are never rewritten. Each check starts NOT VALID (it still
-- enforces new inserts/updates), then is validated only if no old row fails.
-- A legacy row violating a check must be corrected before it can be updated.
-- Notes use trimmed length, matching checkNotes in js/validators.js.

-- Preserve 0018's role selection/confirmation while making auth metadata
-- safe for the name check. Google names can be short, blank or very long.
create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  chosen_role user_role;
  confirmed boolean := false;
  chosen_name text := btrim(coalesce(new.raw_user_meta_data->>'full_name', ''));
begin
  if requested_role is null or requested_role = 'admin'
     or requested_role not in ('farmer', 'vendor', 'driver') then
    chosen_role := 'farmer';
  else
    chosen_role := requested_role::user_role;
    confirmed := true;
  end if;

  chosen_name := btrim(left(chosen_name, 120));
  if char_length(chosen_name) < 2 then
    chosen_name := btrim(left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 120));
  end if;
  if char_length(chosen_name) < 2 then
    chosen_name := 'User';
  end if;

  insert into public.profiles (id, role, full_name, role_confirmed_at)
  values (new.id, chosen_role, chosen_name,
          case when confirmed then now() else null end);

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

alter table public.deliveries
  drop constraint if exists deliveries_pickup_address_len,
  drop constraint if exists deliveries_dropoff_address_len,
  drop constraint if exists deliveries_goods_description_len,
  drop constraint if exists deliveries_notes_len,
  drop constraint if exists deliveries_quantity_kg_range;
alter table public.profiles
  drop constraint if exists profiles_full_name_len;

alter table public.deliveries
  add constraint deliveries_pickup_address_len
    check (char_length(btrim(pickup_address)) between 5 and 200) not valid,
  add constraint deliveries_dropoff_address_len
    check (char_length(btrim(dropoff_address)) between 5 and 200) not valid,
  add constraint deliveries_goods_description_len
    check (char_length(btrim(goods_description)) between 2 and 120) not valid,
  add constraint deliveries_notes_len
    check (notes is null or char_length(btrim(notes)) <= 500) not valid,
  add constraint deliveries_quantity_kg_range
    check (quantity_kg is null or quantity_kg between 1 and 100000) not valid;
alter table public.profiles
  add constraint profiles_full_name_len
    check (char_length(btrim(full_name)) between 2 and 120) not valid;

-- Decide from the actual data, rather than assuming production is clean.
-- The ALTER TABLE locks above remain held through this migration transaction.
do $$
declare
  c record;
  has_violations boolean;
begin
  for c in
    select conrelid::regclass as table_name, conname,
           pg_get_expr(conbin, conrelid) as expression
      from pg_constraint
     where (conrelid = 'public.deliveries'::regclass and conname in (
       'deliveries_pickup_address_len', 'deliveries_dropoff_address_len',
       'deliveries_goods_description_len', 'deliveries_notes_len',
       'deliveries_quantity_kg_range'))
        or (conrelid = 'public.profiles'::regclass and conname = 'profiles_full_name_len')
  loop
    execute format('select exists (select 1 from %s where not (%s))',
                   c.table_name, c.expression) into has_violations;
    if not has_violations then
      execute format('alter table %s validate constraint %I', c.table_name, c.conname);
    else
      raise notice '% remains NOT VALID: existing rows violate the check', c.conname;
    end if;
  end loop;
end;
$$;
