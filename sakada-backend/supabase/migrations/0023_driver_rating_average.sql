-- 0023: real rating averages/counts for drivers on the caller's deliveries.
-- The return type changes, so replace the function atomically.
begin;

drop function if exists public.get_my_delivery_drivers();

create function public.get_my_delivery_drivers()
returns table (
  delivery_id uuid,
  driver_name text,
  vehicle_type text,
  vehicle_plate text,
  rating_avg numeric,
  rating_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with my_deliveries as materialized (
    select d.id, d.driver_id
    from deliveries d
    where d.requester_id = auth.uid()
      and d.driver_id is not null
  ), driver_ratings as materialized (
    -- Aggregate each relevant driver once, even with multiple deliveries.
    select r.rated_user_id,
      round(avg(r.rating)::numeric, 1) as rating_avg,
      count(*)::integer as rating_count
    from ratings r
    where r.rated_user_id in (select d.driver_id from my_deliveries d)
    group by r.rated_user_id
  )
  select d.id, p.full_name, dp.vehicle_type, dp.vehicle_plate,
    dr.rating_avg, coalesce(dr.rating_count, 0)
  from my_deliveries d
  join profiles p on p.id = d.driver_id
  left join driver_profiles dp on dp.id = d.driver_id
  left join driver_ratings dr on dr.rated_user_id = d.driver_id;
$$;

revoke all on function public.get_my_delivery_drivers() from public, anon;
grant execute on function public.get_my_delivery_drivers() to authenticated;

commit;
