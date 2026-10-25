-- 0024: recipient and Philippine-time pickup window for new bookings.
-- Existing bookings retain NULL; no backfill or changes to pickup-date rules.
begin;

alter table public.deliveries
  add column if not exists recipient_name text,
  add column if not exists pickup_window text;

alter table public.deliveries
  drop constraint if exists deliveries_recipient_name_len,
  drop constraint if exists deliveries_pickup_window_valid;

alter table public.deliveries
  add constraint deliveries_recipient_name_len
    check (recipient_name is null or char_length(btrim(recipient_name)) between 2 and 80),
  add constraint deliveries_pickup_window_valid
    check (pickup_window is null or pickup_window in ('08-10', '10-12', '13-15'));

-- 0020's guard_delivery_update() compares every changed key with allow-lists
-- that exclude these columns, so requester/driver edits are already blocked.
-- Existing table-level INSERT/SELECT privileges cover the new columns.
commit;
