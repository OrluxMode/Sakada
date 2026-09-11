Sakada Logistics — Backend (Phase 3)

Database schema and security policies for Sakada, built on Supabase (Postgres + Auth + Realtime). This is a sibling project to sakada-web/ — the front end you already have.

What's here
sakada-backend/
├── supabase/
│   └── migrations/
│       ├── 0001_core_schema.sql          ← profiles, role tables, deliveries
│       ├── 0002_status_history.sql       ← auto-logged status audit trail
│       ├── 0003_notifications_ratings.sql
│       ├── 0004_auth_trigger.sql         ← auto-create profile on signup
│       └── 0005_rls_policies.sql         ← role-based access control
├── docs/
│   ├── SCHEMA.md                          ← every table explained, mapped to your plan
│   └── SETUP.md                           ← step-by-step: create the project, run migrations, enable Google sign-in
└── .env.example
Status

Phase 3 (backend + database foundation): schema designed, not yet provisioned. You still need to create the actual Supabase project yourself (docs/SETUP.md walks through it) and run these migrations there — that step needs your own account and can't be done from this side.

Not yet done: wiring sakada-web/ to actually call this backend. That's Phase 4 (real authentication) — adding supabase-js to the front end, building real login/register forms, and connecting each dashboard so a session determines what's visible, matching the access rules already written into the RLS policies here.

Per the plan's own rule — don't move to Phase 4 until Phase 3 is confirmed working. After you run the migrations, a good sanity check before moving on: open the Supabase Table Editor and confirm all 8 tables exist with the right columns, then try inserting a test row into deliveries manually and watch a row appear automatically in delivery_status_history.