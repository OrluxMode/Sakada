-- Fixes a gap in 0005_rls_policies.sql: "users can update their own
-- profile" allows updating the whole row, including `role` — which would
-- let anyone promote themselves to admin via a direct client call. This
-- trigger blocks changing `role` unless the person making the change is
-- already an admin. Run this after 0005.

create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'You are not allowed to change your own role.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_escalation();