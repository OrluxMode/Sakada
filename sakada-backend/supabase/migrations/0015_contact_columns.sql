-- 0015: contact form columns (fixes N1).
-- js/contact.js inserts phone, role and purpose, but 0014 only created
-- name, email and message, so every submit was rejected.
-- This table accepts anonymous inserts, so every column also gets a
-- size/shape limit. NOT VALID = enforce on new rows without re-checking
-- any rows that already exist.

alter table contact_submissions
  add column if not exists phone   text,
  add column if not exists role    text,
  add column if not exists purpose text;

alter table contact_submissions
  drop constraint if exists contact_name_len,
  drop constraint if exists contact_email_len,
  drop constraint if exists contact_phone_len,
  drop constraint if exists contact_role_valid,
  drop constraint if exists contact_purpose_valid,
  drop constraint if exists contact_message_len;

alter table contact_submissions
  add constraint contact_name_len
    check (char_length(name) between 1 and 120) not valid,
  add constraint contact_email_len
    check (char_length(email) between 3 and 254) not valid,
  add constraint contact_phone_len
    check (phone is null or char_length(phone) <= 40) not valid,
  add constraint contact_role_valid
    check (role is null or role in ('farmer', 'vendor', 'driver', 'partner')) not valid,
  add constraint contact_purpose_valid
    check (purpose is null or purpose in ('booking', 'driver', 'vendor', 'support', 'other')) not valid,
  add constraint contact_message_len
    check (char_length(message) between 1 and 5000) not valid;
