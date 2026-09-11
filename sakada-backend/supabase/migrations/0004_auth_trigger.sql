-- Auto-create a profile when someone signs up (email/password or Google).
-- The front end passes { role: 'farmer' | 'vendor' | 'driver', full_name }
-- as signup metadata; this trigger reads it and creates the matching
-- profiles row automatically.
--
-- IMPORTANT: 'admin' is deliberately not selectable here, matching Phase
-- 0.1 — admin is a completely separate login, never an option in normal
-- registration. If someone tampers with the client and sends role=admin
-- anyway, this trigger silently falls back to 'farmer'. Real admin
-- accounts are created directly in the database (see docs/SETUP.md).

create or replace function handle_new_user()
returns trigger as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  chosen_role user_role;
begin
  if requested_role is null or requested_role = 'admin'
     or requested_role not in ('farmer', 'vendor', 'driver') then
    chosen_role := 'farmer';
  else
    chosen_role := requested_role::user_role;
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    chosen_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );

  -- Also create the empty role-specific profile row so the dashboard
  -- has something to update from day one.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();