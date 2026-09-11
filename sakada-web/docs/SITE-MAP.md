# Sakada Logistics — Site Map & File Organization

Matches Phase 1.1 / Phase 2 of the implementation plan. Built incrementally —
do not create a page's file until its phase is reached.

sakada-web/
├── index.html                  ← Phase 2.1 (landing page) — BUILT
├── css/
│   └── style.css                ← shared design-system styles
├── js/
│   ├── main.js                   ← nav toggle, hero entrance motion
│   ├── supabase-client.js         ← shared Supabase client (Phase 4)
│   ├── auth.js                    ← shared auth helpers (register/login/session/role-guard)
│   ├── mapbox-client.js           ← Phase 5: geocoding + driving-distance + cost formula; Phase 7: staticMapUrl()
│   ├── deliveries.js              ← Phase 5: deliveries table reads/writes; Phase 6: updateDeliveryStatus; Phase 7: location + realtime subscription
│   ├── notifications.js           ← Phase 8: notification reads, mark-as-read, realtime subscription
│   ├── ratings.js                 ← Phase 9: rating reads (batched) and submission
│   └── admin-data.js              ← Phase 10: all-users/all-deliveries/all-ratings reads, admin cancel
├── assets/
│   └── images/                  ← final licensed photography goes here
│                                    (index.html currently hotlinks one
│                                    Unsplash placeholder — see docs/DESIGN-SYSTEM.md)
├── pages/                        ← Phase 2.3 — BUILT (all 7)
│   ├── how-it-works.html          ← BUILT
│   ├── for-farmers.html           ← BUILT
│   ├── for-vendors.html           ← BUILT
│   ├── for-drivers.html           ← BUILT
│   ├── contact.html               ← BUILT (info-only form: mailto, no backend yet)
│   ├── features.html              ← BUILT (linked from footer nav, not top nav)
│   └── about.html                 ← BUILT (linked from footer nav, not top nav)
├── auth/                          ← Phase 4 — BUILT
│   ├── register.html              ← role tabs (farmer/vendor/driver), email/password + Google
│   ├── login.html                 ← email/password + Google, routes to the right dashboard by role
│   ├── admin-login.html           ← separate, not linked from public nav, no Google/register option
│   └── callback.html              ← handles the Google OAuth redirect
├── dashboard/                     ← Phase 5 — BUILT
│   ├── farmer/index.html          ← Create Delivery + My Deliveries, real Mapbox cost estimate
│   ├── vendor/index.html          ← Book a Delivery + Incoming Deliveries, same real flow
│   ├── driver/index.html          ← Available Deliveries + Accept + My Assigned Deliveries
│   └── admin/index.html           ← still a placeholder (Phase 10)
└── docs/
    ├── DESIGN-SYSTEM.md          ← tokens, layout rules, voice guidelines
    └── SITE-MAP.md               ← this file

Rule from the plan: don't jump to the next feature until the current one
works. Phases 2 through 7 are complete and tested end to end — booking,
cost estimate, driver acceptance, the full status lifecycle, and live
location tracking, all confirmed working with real test deliveries.

Phase 8 (notifications) is now built:
- A database trigger (0008_notifications_trigger.sql) creates a
  notification the instant a delivery's status actually changes —
  matching the plan's own line that "notifications should come from
  actual system events," not a front-end call that could be forgotten.
- Farmer/vendor dashboards have a notification bell with an unread-count
  badge. New notifications appear live via Supabase Realtime; clicking
  one marks it read.
- The driver dashboard has the same bell. Originally left empty by design
  (nothing targeted drivers), but now also notifies every driver the
  moment a new delivery is posted and available
  (0009_notify_drivers_new_delivery.sql) — added after testing surfaced
  it as a real gap, not part of the original Phase 8 scope.

Manual step required: Supabase → Database → Publications → the
`supabase_realtime` publication needs `notifications` toggled on
alongside `deliveries` (sakada-backend/docs/SETUP.md, step 7 — same
screen used for Phase 7's tracking, just one more table). Note: this
screen is called "Publications," not "Replication" — Supabase moved/
renamed things since this project started, and "Replication" is now a
different, unrelated feature for external destinations.

Next per the roadmap: Phase 11 — internal testing (test each role
separately, then the full chains: Farmer → Driver → Vendor and
Vendor → Driver → Destination) before Phase 12 (deploy).

Phase 10 (the admin system) is now built:
- Stat cards: Farmers / Vendors / Drivers / Pending / Active / Completed
  deliveries, all computed from real data.
- Three tabs — Deliveries, Users, Feedback — each a real table reading
  ALL rows across every user, not just the admin's own. This only works
  because of the admin-scoped RLS policies written back in
  0005_rls_policies.sql ("admins can view all deliveries", "admins can
  update any profile") — they'd been sitting unused since Phase 3 until
  now.
- One real management action: an admin can cancel a pending or
  driver-assigned delivery. It still goes through the same
  validate_status_transition trigger as everyone else (Phase 6) — admin
  can *reach* any delivery, but isn't exempt from the lifecycle rules, so
  a delivery that's already Picked Up or In Transit can't be
  admin-cancelled without a separate deliberate change to that trigger
  (not built — a real product decision to make later, not assumed now).
- No notification bell on this dashboard — nothing in the current
  feature set generates admin-facing notifications.

Phase 9 (delivery history + ratings) is now built:
- Every dashboard's delivery list is split into "Active" and "Delivery
  History" (Delivered/Cancelled), rather than one mixed list — matches
  the separate "My Deliveries" vs "Delivery History" nav items from
  Phase 1.3.
- Any delivery in history with status Delivered shows a 5-star rating
  control with an optional comment. Farmer/vendor rates the driver;
  driver rates the requester. Once submitted, it's swapped for a
  read-only display of what was given — the RLS policy and the unique
  (delivery_id, rated_by) constraint (both from Phase 3) are what
  actually stop a second submission, not just the UI hiding the form.