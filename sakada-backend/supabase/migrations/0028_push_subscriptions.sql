begin;
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique
    check (char_length(endpoint) between 9 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 200),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_id on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_owner on public.push_subscriptions;
create policy push_subscriptions_select_owner on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists push_subscriptions_delete_owner on public.push_subscriptions;
create policy push_subscriptions_delete_owner on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
-- Explicit server grants: the Edge Function maintains success timestamps and
-- removes expired endpoints. service_role bypasses RLS on hosted Supabase.
grant select, update, delete on public.push_subscriptions to service_role;

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text
) returns void language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  -- Serialize saves per account, including transfers from a shared phone.
  -- A concurrent logout/delete can only reduce this account's count.
  perform 1 from public.profiles where id = caller for update;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (caller, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set
    user_id = caller, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent,
    -- Treat a transferred phone as newly saved to the receiving account.
    created_at = case when push_subscriptions.user_id = caller
      then push_subscriptions.created_at else now() end,
    last_sent_at = case when push_subscriptions.user_id = caller
      then push_subscriptions.last_sent_at else null end;

  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = caller
    order by created_at desc, id desc offset 10
  );
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = caller;
end;
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon, authenticated;
revoke all on function public.delete_push_subscription(text) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
commit;
