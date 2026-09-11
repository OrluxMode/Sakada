-- Bugfix for 0006_prevent_role_escalation.sql. That trigger correctly
-- blocks a logged-in end user from promoting themselves to admin through
-- the app — but it was ALSO blocking legitimate role changes made
-- directly via the SQL Editor (or any trusted backend script using the
-- service_role key), because auth.uid() is NULL outside an authenticated
-- app session, which made is_admin() always false there.
--
-- This doesn't weaken anything: anyone with SQL Editor access or the
-- service_role key already has full, unrestricted database access
-- regardless of this trigger — they could disable it outright if they
-- wanted to. Exempting auth.uid() IS NULL just removes an accidental
-- self-lockout for the one context that was always meant to be trusted.

create or replace function prevent_role_escalation()
returns trigger as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.role is distinct from old.role and not is_admin() then
    raise exception 'You are not allowed to change your own role.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;