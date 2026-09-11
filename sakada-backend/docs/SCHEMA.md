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
| Schedules                        | `scheduled_pickup_at` column on `deliveries` |
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

**`delivery_status_history`** — every status a delivery ever passed through,
who changed it, and when. Auto-populated by a trigger — the front end never
writes to this table directly, so there's no risk of the audit trail and the
real status disagreeing.

**`notifications`** — one row per notification. The trigger doesn't create
these automatically (unlike status history) because the *wording* of a
notification is a product decision, not a database concern. Phase 8 should
insert a row here from application code whenever something notification-
worthy happens: driver accepted, picked up, in transit, delivered.

**`ratings`** — one row per (delivery, rater). Both the requester and the
driver can each leave one rating about the other side for the same
delivery. The RLS policy only allows inserting a rating once `status =
'delivered'`, so you can't rate a delivery that hasn't happened yet.

## Security note

Since the front end (and later, the mobile app) talks to Supabase directly
rather than through a custom API server, **Row Level Security (in
`0005_rls_policies.sql`) is your actual security boundary** — not something
optional. It's what stops a farmer's logged-in session from reading another
farmer's deliveries, or a driver from marking someone else's delivery
`delivered`. Test this specifically and adversarially in Phase 11 (Internal
Testing) — log in as one role and deliberately try to query another role's
data through the browser console.