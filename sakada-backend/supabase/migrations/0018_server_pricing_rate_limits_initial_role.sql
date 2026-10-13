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
