-- Document and enforce the intent that delivery_status_history INSERTs
-- are handled exclusively by the SECURITY DEFINER trigger (0002).
--
-- The trigger function log_delivery_status_change() runs as the function
-- owner (superuser context), bypassing RLS entirely. This means:
--   - Regular users CANNOT insert into delivery_status_history directly
--   - The trigger does it on their behalf, with validated data
--
-- This migration adds an explicit comment and a defensive INSERT policy
-- that always denies, making the security intent visible and documented.
-- (The trigger bypasses RLS, so this policy has no effect on the trigger
-- itself — it only blocks direct client inserts.)

-- Comment explaining the design
comment on table delivery_status_history is
  'Audit trail for delivery status changes. INSERTs are handled exclusively '
  'by the SECURITY DEFINER trigger log_delivery_status_change() (migration 0002). '
  'Direct INSERTs from clients are blocked by the INSERT policy below.';

-- Drop existing policy if re-running this migration
drop policy if exists "deny direct inserts to status history" on delivery_status_history;

-- Explicit DENY policy for direct client inserts
-- The trigger bypasses RLS (SECURITY DEFINER), so this doesn't affect it.
create policy "deny direct inserts to status history"
  on delivery_status_history for insert
  with check (false);
