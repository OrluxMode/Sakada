begin;
alter table public.profiles add column if not exists language text not null default 'en';
alter table public.profiles drop constraint if exists profiles_language_valid;
alter table public.profiles add constraint profiles_language_valid
  check (language in ('en', 'fil', 'taglish'));

-- Retain 0016's column-only writes and existing owner RLS.
revoke update on public.profiles from public, anon, authenticated;
grant update (full_name, phone, avatar_url, language) on public.profiles to authenticated;
commit;
