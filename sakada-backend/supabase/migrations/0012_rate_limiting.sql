-- Rate limiting for critical delivery operations.
--
-- Protects against spam-accepting deliveries or spam-updating status
-- by limiting how many times a user can perform each operation per minute.
--
-- Usage: call check_rate_limit(auth.uid(), 'accept_delivery', 3, 60)
-- before executing the operation. Returns true if allowed, raises an
-- exception if the limit is exceeded.

create table if not exists rate_limits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  operation   text not null,
  performed_at timestamptz not null default now()
);

-- Index for fast lookups: "how many times has this user done X in the last N seconds?"
create index idx_rate_limits_user_operation
  on rate_limits (user_id, operation, performed_at);

-- Clean up old rows periodically (keep 10 minutes of history)
create or replace function cleanup_rate_limits()
returns void as $$
begin
  delete from rate_limits
  where performed_at < now() - interval '10 minutes';
end;
$$ language plpgsql security definer;

-- Core rate limit check function.
-- max_per_window: how many times the operation is allowed
-- window_seconds: the time window in seconds (default 60 = 1 minute)
-- Returns true if the operation is allowed.
-- Raises an exception if the limit is exceeded.
create or replace function check_rate_limit(
  p_user_id uuid,
  p_operation text,
  p_max_per_window int default 3,
  p_window_seconds int default 60
)
returns boolean as $$
declare
  current_count int;
begin
  -- Count recent operations
  select count(*) into current_count
  from rate_limits
  where user_id = p_user_id
    and operation = p_operation
    and performed_at > now() - (p_window_seconds || ' seconds')::interval;

  if current_count >= p_max_per_window then
    raise exception 'Rate limit exceeded for %. Try again in % seconds.',
      p_operation, p_window_seconds;
  end if;

  -- Record this operation
  insert into rate_limits (user_id, operation)
  values (p_user_id, p_operation);

  return true;
end;
$$ language plpgsql security definer set search_path = public;

-- Grant execute to authenticated users (they call it from RLS policies or frontend)
grant execute on function check_rate_limit(uuid, text, int, int) to authenticated;

-- Schedule periodic cleanup (run every 10 minutes via pg_cron if available,
-- or the frontend can call cleanup_rate_limits() periodically).
-- If pg_cron is not available, old rows are cleaned up on every check_rate_limit call.
