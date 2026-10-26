-- Hosted Supabase already supplies storage; this migration creates the bucket.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Exact project prefix, matching sakada-web/js/config.js. Existing rows remain untouched.
alter table public.profiles drop constraint if exists profiles_avatar_url_valid;
alter table public.profiles add constraint profiles_avatar_url_valid check (
  avatar_url is null or starts_with(avatar_url,
    'https://aeeniueayubeugvooyqj.supabase.co/storage/v1/object/public/avatars/' || id::text || '/')
) not valid;
commit;
