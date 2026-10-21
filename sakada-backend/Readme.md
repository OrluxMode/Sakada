Sakada Logistics — Backend

Database schema and security policies for Sakada, built on Supabase (Postgres + Auth + Realtime). This is a sibling project to sakada-web/ — the front end.

What's here
sakada-backend/
├── supabase/
│   └── migrations/
│       ├── 0001_core_schema.sql              ← profiles, role tables, deliveries
│       ├── 0002_status_history.sql           ← auto-logged status audit trail
│       ├── 0003_notifications_ratings.sql    ← notifications + ratings tables
│       ├── 0004_auth_trigger.sql             ← auto-create profile on signup
│       ├── 0005_rls_policies.sql             ← role-based access control
│       ├── 0006_prevent_role_escalation.sql  ← blocks self-promotion to admin
│       ├── 0007_valid_status_transitions.sql ← enforces valid delivery lifecycle
│       ├── 0008_notifications_trigger.sql    ← notify requester on status change
│       ├── 0009_notify_drivers_new_delivery.sql ← fan-out notify all drivers
│       ├── 0010_fix_role_escalation.sql      ← fix when auth.uid() is NULL
│       ├── 0011_optimize_driver_notifications.sql ← only notify active drivers (7d)
│       ├── 0012_rate_limiting.sql            ← rate limit table + check function
│       ├── 0013_deny_status_history_insert.sql ← explicit DENY for status history
│       ├── 0014_contact_submissions.sql      ← contact form submissions table
│       ├── 0015_contact_columns.sql          ← contact form columns (fixes N1)
│       ├── 0016_rls_hardening.sql            ← RLS hardening (fixes N3, N4, N7, N9, N21)
│       ├── 0017_delivery_distance.sql        ← store the route distance the fare was computed from (prep for N5)
│       ├── 0018_server_pricing_rate_limits_initial_role.sql ← server-side pricing (N5), enforced rate limits (N6), first-login role for Google sign-ups (N2)
│       ├── 0019_requester_sees_driver.sql    ← private driver details for requesters' own deliveries
│       ├── 0020_driver_jobs_and_payment.sql ← two-active-job cap, payment status, status timestamps
│       ├── 0021_text_limits.sql             ← booking/profile text and quantity limits
│       ├── 0022_past_pickup_date.sql        ← Manila pickup-date checks and expired-job visibility
│       └── 0023_driver_rating_average.sql  ← real driver rating averages and counts in requester RPC
├── docs/
│   ├── SCHEMA.md                            ← every table explained
│   └── SETUP.md                             ← step-by-step setup guide
└── .env.example

Status

Migrations 0001–0023 are written. Apply pending migrations in order; this list
does not confirm their deployment status. The frontend (sakada-web/) is fully wired to this backend with:
- Real authentication (email/password + Google OAuth)
- Role-based dashboards (farmer, vendor, driver, admin)
- Toast notifications, loading skeletons, offline detection
- Rate limiting on delivery creation, acceptance, and status updates
- Optimized driver notifications (only active drivers notified)
