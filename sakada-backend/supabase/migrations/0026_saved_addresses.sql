begin;
create table if not exists public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  address text not null check (char_length(btrim(address)) between 2 and 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  city text check (city is null or char_length(city) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists saved_addresses_user_label
  on public.saved_addresses (user_id, lower(btrim(label)));
create index if not exists saved_addresses_user_id on public.saved_addresses (user_id);

-- Lock the parent to serialize concurrent inserts for the same user. SECURITY
-- DEFINER ensures counting cannot be bypassed by RLS. Ownership cannot be edited.
create or replace function public.enforce_saved_address_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.saved_addresses where user_id = new.user_id) >= 10 then
    raise exception 'saved address limit reached';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_saved_address_limit() from public, anon, authenticated;
drop trigger if exists trg_saved_address_limit on public.saved_addresses;
create trigger trg_saved_address_limit before insert on public.saved_addresses
  for each row execute function public.enforce_saved_address_limit();
drop trigger if exists trg_saved_addresses_updated_at on public.saved_addresses;
create trigger trg_saved_addresses_updated_at before update on public.saved_addresses
  for each row execute function public.set_updated_at();

alter table public.saved_addresses enable row level security;
drop policy if exists saved_addresses_owner on public.saved_addresses;
create policy saved_addresses_owner on public.saved_addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.saved_addresses from public, anon, authenticated;
grant select, insert, delete on public.saved_addresses to authenticated;
grant update (label, address, lat, lng, city) on public.saved_addresses to authenticated;
commit;
