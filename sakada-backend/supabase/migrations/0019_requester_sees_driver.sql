-- 0019: let a farmer/vendor see who is driving THEIR delivery.
--
-- profiles and driver_profiles stay private (0016: own row + admin only).
-- This function is the one narrow exception: for deliveries the caller
-- requested, it returns the assigned driver's name, vehicle type and plate.
-- Nothing else (no phone, licence number or live location).

create or replace function get_my_delivery_drivers()
returns table (
  delivery_id uuid,
  driver_name text,
  vehicle_type text,
  vehicle_plate text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, p.full_name, dp.vehicle_type, dp.vehicle_plate
  from deliveries d
  join profiles p on p.id = d.driver_id
  left join driver_profiles dp on dp.id = d.driver_id
  where d.requester_id = auth.uid()
    and d.driver_id is not null;
$$;

revoke all on function get_my_delivery_drivers() from public, anon;
grant execute on function get_my_delivery_drivers() to authenticated;

-- Drivers can already edit their own driver_profiles row (0005). Keep the
-- new vehicle fields short so they can't be abused for long text.
alter table driver_profiles
  drop constraint if exists driver_profiles_vehicle_type_len,
  drop constraint if exists driver_profiles_vehicle_plate_len;
alter table driver_profiles
  add constraint driver_profiles_vehicle_type_len
    check (vehicle_type is null or char_length(vehicle_type) <= 40),
  add constraint driver_profiles_vehicle_plate_len
    check (vehicle_plate is null or char_length(vehicle_plate) <= 15);
