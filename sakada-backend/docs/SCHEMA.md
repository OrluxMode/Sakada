# Sakada Logistics — Database Schema

Maps directly to the entity list from Phase 3 of the implementation plan.
Where two planned entities collapsed into one table, the reasoning is
explained below rather than hidden.

## Entities and how they map

| Planned entity                  | Actual table(s)                              |
|----------------------------------|-----------------------------------------------|
| Users                            | `auth.users` (Supabase-managed) + `profiles` |
| Farmer / Vendor / Driver profiles| `farmer_profiles`, `vendor_profiles`, `driver_profiles` |
| Delivery requests, Bookings, Assignments | `deliveries` (see below) |
| Goods                            | `goods_description`, `quantity_kg` columns on `deliveries` |
| Locations                        | `pickup_lat/lng`, `dropoff_lat/lng`, `current_lat/lng` columns |
| Schedules                        | `scheduled_pickup_at`, `pickup_window` columns on `deliveries` |
| Delivery statuses                | `delivery_status` enum + `delivery_status_history` table |
| Notifications                    | `notifications` table |
| Delivery history                 | `delivery_status_history` (every status change, timestamped) |
| Ratings / feedback               | `ratings` table |

### Why "requests", "bookings", and "assignments" are one table

The plan lists these as three entities. In practice, a delivery request
*becomes* a booking the moment it's confirmed, and *becomes* an assignment
the moment a driver accepts it — it's the same real-world thing moving
through stages, not three things that need to be kept in sync with each
other. Modeling it as three separate tables would mean writing sync logic
to keep them consistent, with no benefit — nothing about a "booking" exists
independently of its request. One `deliveries` table with a `status` column
avoids that entirely. If a real future need arises for something a request
can be *without* it being a booking (e.g. saved drafts), that's a legitimate
reason to split them later — not something to build in now.

## Table reference

**`profiles`** — one row per authenticated user, any role. Created
automatically on signup (see `0004_auth_trigger.sql`). Holds fields every
role has in common: name, phone, avatar, `role` itself.

**`farmer_profiles` / `vendor_profiles` / `driver_profiles`** — role-specific
fields only that role needs. A farmer never has a `license_number` column
sitting unused; a driver never has a `farm_name` column sitting unused.

**`deliveries`** — the core lifecycle table. `delivery_code` is the
human-readable reference number your Phase 5.2 example showed (`SK-00001`),
auto-generated. `status` moves through: `pending` → `driver_assigned` →
`picked_up` → `in_transit` → `delivered` (or `cancelled` from `pending`).
`current_lat`/`current_lng` are what Phase 7 tracking updates while a
delivery is in transit.

Migration `0024` adds nullable `recipient_name` (the person receiving the goods
and paying the driver at drop-off) and `pickup_window`. Window codes are
`08-10` (8:00–10:00 AM), `10-12` (10:00 AM–12:00 PM), and `13-15`
(1:00–3:00 PM), all Philippine time. Existing bookings keep NULL for both;
there is no backfill. Requesters may provide them on insert; requesters and
drivers cannot change them after booking because `guard_delivery_update()`
checks all changed keys against allow-lists. Admins may edit them, subject to
the constraints below. Assigned drivers can read both on their jobs through
existing RLS and table-level SELECT privileges. Existing table-level INSERT
privileges cover both columns; no new grants are needed.

`scheduled_pickup_at` retains its existing UTC date encoding. The window does
not affect `pickup_date_passed()` or any of migration `0022`'s past-date rules.

**`delivery_status_history`** — every status a delivery ever passed through,
who changed it, and when. Auto-populated by a trigger — the front end never
writes to this table directly, so there's no risk of the audit trail and the
real status disagreeing.

**`notifications`** — one row per notification. Created by database triggers:
`0008_notifications_trigger.sql` notifies the requester on every status
change, and `0009`/`0011` notify recently active drivers when a new delivery
is posted. Users can only mark their own notifications as read (`is_read`,
enforced by column grants in `0016`).

**`ratings`** — one row per (delivery, rater). Both the requester and the
driver can each leave one rating about the other side for the same
delivery. The RLS policy only allows inserting a rating once `status =
'delivered'`, so you can't rate a delivery that hasn't happened yet.

## Booking and profile limits (0021, 0024)

Database checks enforce these limits on inserts and updates, including direct
API writes. Text lengths are measured after trimming surrounding spaces.

| Constraint | Allowed value |
|---|---|
| `deliveries_pickup_address_len` | 5–200 characters |
| `deliveries_dropoff_address_len` | 5–200 characters |
| `deliveries_goods_description_len` | 2–120 characters |
| `deliveries_notes_len` | NULL or at most 500 characters |
| `deliveries_recipient_name_len` | NULL or 2–80 characters after trimming |
| `deliveries_pickup_window_valid` | NULL or exactly `08-10`, `10-12`, `13-15` |
| `deliveries_quantity_kg_range` | NULL or 1–100000 kg (inclusive) |
| `profiles_full_name_len` | 2–120 characters |

`quantity_kg` and `estimated_cost` remain nullable. Migration `0021` adds all
checks as `NOT VALID`, then validates each check only when existing rows pass.
It never changes existing data; its header includes a query counting violations
per column. A check left `NOT VALID` still rejects invalid inserts and updates,
including updates to legacy rows that still violate it. After correcting old
data, run `ALTER TABLE <table> VALIDATE CONSTRAINT <constraint>` for each
remaining check.

The two `0024` checks are validated immediately. Both new columns are nullable
with no default, so existing rows satisfy them without data changes.

The signup trigger trims and caps metadata names to 120 characters before
creating a profile. Names shorter than two characters fall back to the trimmed,
capped email local part, then to `User` if needed. Google signups still start
as unconfirmed farmers; explicit valid signup roles remain confirmed (0018).

## Past pickup dates (0022)

`pickup_date_passed(scheduled_pickup_at)` compares the pickup timestamp's UTC
calendar date (the website's date encoding) with today's date in Asia/Manila.
Today, future dates and NULL dates remain eligible. An optional `today` date
argument supports deterministic testing; policies and triggers use the default.

Drivers cannot select expired pending, unassigned requests through RLS, and
the new `trg_check_pickup_date` trigger rejects pending → driver_assigned with
`This pickup date has passed. The farmer or vendor needs to book a new date.`
RLS may hide a row before an UPDATE reaches the trigger; clients must also
handle an acceptance that affects zero rows.

Ordinary farmer/vendor inserts with past pickup dates fail with
`Pick today or a later date.` Trusted SQL/service-role and admin inserts keep
their existing exemption. Requesters can still see and cancel their expired
pending requests. Assigned drivers retain access to their own jobs/history;
admin visibility is unchanged. No old rows are modified or cancelled.
All 0020 functions remain unchanged, including the two-active-job cap and its
message. The migration header provides a read-only count of requests that
will disappear from drivers' open lists.

## Requester driver function (0019, 0023)

`get_my_delivery_drivers()` returns one row per caller-owned delivery with an
assigned driver. Its columns, in order, are `delivery_id uuid`,
`driver_name text`, `vehicle_type text`, `vehicle_plate text`,
`rating_avg numeric`, and `rating_count integer`.

The average is `round(avg(rating)::numeric, 1)` over all ratings whose
`rated_user_id` is that driver, including ratings from other requesters'
deliveries. Ratings the driver gave a requester do not count. An unrated
driver returns NULL for `rating_avg` and 0 for `rating_count`; no default
stars are supplied. Ratings are aggregated once per relevant driver.

This stable SECURITY DEFINER function uses `search_path = public`. Only
`authenticated` has EXECUTE permission (revoked from public and anon).
Profiles and individual ratings retain their existing RLS: the function
exposes no comments, rater identities, or drivers absent from the caller's
own assigned deliveries. Migration 0023 drops and recreates the function in
one transaction because its return type changes.

## Security note

Since the front end (and later, the mobile app) talks to Supabase directly
rather than through a custom API server, **Row Level Security (in
`0005_rls_policies.sql`) is your actual security boundary** — not something
optional. It's what stops a farmer's logged-in session from reading another
farmer's deliveries, or a driver from marking someone else's delivery
`delivered`. Test this specifically and adversarially in Phase 11 (Internal
Testing) — log in as one role and deliberately try to query another role's
data through the browser console.

## Avatars (0025)

The public Storage bucket `avatars` accepts `image/webp`, `image/jpeg` and
`image/png`, limited to 1,048,576 bytes per file. The migration creates it;
no manual bucket creation is needed on hosted Supabase. Public reads are
allowed. Authenticated inserts, updates (both old and new paths) and deletes
require the first object-name folder to equal `auth.uid()`. The website uses
`<user-id>/<timestamp>.webp` inside the bucket, saves the new URL, then removes
the old object. Bucket creation uses `ON CONFLICT DO NOTHING`; an already
existing bucket's configuration is not overwritten.

`profiles_avatar_url_valid` permits NULL or a URL starting exactly with
`https://aeeniueayubeugvooyqj.supabase.co/storage/v1/object/public/avatars/<row-id>/`.
The project reference matches the existing frontend configuration; update it
for another deployment. The constraint is `NOT VALID`: existing rows are not
scanned or rewritten, but subsequent inserts/updates must pass. It checks URL
ownership, not object existence. Existing name/phone/avatar column grants and
profile RLS remain in effect.

## Saved addresses (0026)

`saved_addresses` stores up to ten addresses per user:

| Column | Definition |
|---|---|
| `id` | UUID primary key, generated automatically |
| `user_id` | Required profile foreign key, defaults to `auth.uid()`, cascades on profile deletion |
| `label` | Required, 1–40 characters after outer-space trimming |
| `address` | Required, 2–200 characters after outer-space trimming |
| `lat` / `lng` | Required double precision, -90–90 / -180–180 inclusive |
| `city` | NULL or at most 120 characters |
| `created_at` / `updated_at` | Required timestamps, default now; existing `set_updated_at()` stamps updates |

The explicit saved-address requirement uses a two-character minimum; booking
addresses retain their existing five-character minimum. A unique index on
`(user_id, lower(btrim(label)))` rejects labels differing only in case or outer
spaces; a separate index supports user lookup. Values are validated without
rewriting the supplied text.

The before-insert limit trigger locks the user's parent profile row before
counting, serializing concurrent inserts per user. It raises exactly
`saved address limit reached` at ten. Its SECURITY DEFINER function fixes
`search_path` and has no client EXECUTE grant. RLS permits only caller-owned
rows for all CRUD operations, including an ownership check on inserts and
updates. Only `authenticated` receives SELECT/INSERT/DELETE and UPDATE on
`label,address,lat,lng,city`; ownership and timestamps cannot be edited.
No anonymous grants or admin override are provided. See Readme.md for the
PGlite test command and required manual Storage checks.
