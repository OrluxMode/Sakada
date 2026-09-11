-- Row Level Security — this is what actually enforces Phase 4's
-- authorization rule ("a farmer should not gain access to the driver
-- dashboard") at the database layer, not just by hiding buttons in the UI.
-- Since the front end talks to Supabase directly, this is your real
-- security boundary — treat it as seriously as backend code.

alter table profiles enable row level security;
alter table farmer_profiles enable row level security;
alter table vendor_profiles enable row level security;
alter table driver_profiles enable row level security;
alter table deliveries enable row level security;
alter table delivery_status_history enable row level security;
alter table notifications enable row level security;
alter table ratings enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- ---------- profiles ----------
create policy "profiles viewable by any signed-in user"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "admins can update any profile"
  on profiles for update
  using (is_admin());

-- ---------- role-specific profiles ----------
create policy "owner or admin can view farmer profile"
  on farmer_profiles for select using (auth.uid() = id or is_admin());
create policy "owner can manage their farmer profile"
  on farmer_profiles for all using (auth.uid() = id);

create policy "owner or admin can view vendor profile"
  on vendor_profiles for select using (auth.uid() = id or is_admin());
create policy "owner can manage their vendor profile"
  on vendor_profiles for all using (auth.uid() = id);

create policy "any signed-in user can view driver profile"
  on driver_profiles for select using (auth.role() = 'authenticated');
create policy "owner can manage their driver profile"
  on driver_profiles for all using (auth.uid() = id);

-- ---------- deliveries ----------
create policy "requester can view their own deliveries"
  on deliveries for select using (auth.uid() = requester_id);

create policy "assigned driver can view their deliveries"
  on deliveries for select using (auth.uid() = driver_id);

create policy "drivers can view unassigned pending deliveries"
  on deliveries for select
  using (
    status = 'pending' and driver_id is null
    and exists (select 1 from profiles where id = auth.uid() and role = 'driver')
  );

create policy "admins can view all deliveries"
  on deliveries for select using (is_admin());

create policy "farmers and vendors can create deliveries"
  on deliveries for insert
  with check (
    auth.uid() = requester_id
    and exists (select 1 from profiles where id = auth.uid() and role in ('farmer','vendor'))
  );

create policy "requester can cancel their own pending delivery"
  on deliveries for update
  using (auth.uid() = requester_id and status = 'pending')
  with check (status in ('pending', 'cancelled'));

create policy "driver can accept an unassigned pending delivery"
  on deliveries for update
  using (status = 'pending' and driver_id is null)
  with check (driver_id = auth.uid() and status = 'driver_assigned');

create policy "assigned driver can progress delivery status"
  on deliveries for update
  using (auth.uid() = driver_id)
  with check (auth.uid() = driver_id);

create policy "admins can manage all deliveries"
  on deliveries for all using (is_admin());

-- ---------- status history ----------
create policy "involved parties can view status history"
  on delivery_status_history for select
  using (
    exists (
      select 1 from deliveries d
      where d.id = delivery_id
      and (d.requester_id = auth.uid() or d.driver_id = auth.uid())
    ) or is_admin()
  );

-- ---------- notifications ----------
create policy "users can view their own notifications"
  on notifications for select using (auth.uid() = user_id);
create policy "users can mark their own notifications read"
  on notifications for update using (auth.uid() = user_id);

-- ---------- ratings ----------
create policy "involved parties can view ratings for their deliveries"
  on ratings for select
  using (
    exists (
      select 1 from deliveries d
      where d.id = delivery_id
      and (d.requester_id = auth.uid() or d.driver_id = auth.uid())
    ) or is_admin()
  );

create policy "involved party can rate the other side once delivered"
  on ratings for insert
  with check (
    auth.uid() = rated_by
    and exists (
      select 1 from deliveries d
      where d.id = delivery_id
      and d.status = 'delivered'
      and (d.requester_id = auth.uid() or d.driver_id = auth.uid())
    )
  );