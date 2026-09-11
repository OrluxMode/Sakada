# Sakada Logistics — Backend Setup (Phase 3)

These migrations define the schema. You still need to create the actual
Supabase project yourself — that requires your own account and can't be
done from here.

## 1. Create the project

1. Go to https://supabase.com and sign in (or create an account).
2. Click **New Project**. Pick a name (`sakada-logistics`), a database
   password (save it somewhere), and a region close to your users
   (Singapore is closest to the Philippines).
3. Wait for provisioning (~2 minutes).

## 2. Run the migrations

In the Supabase dashboard: **SQL Editor → New Query**. Run each file in
`supabase/migrations/` **in order** — the numbering matters, later files
depend on tables created in earlier ones:

1. `0001_core_schema.sql`
2. `0002_status_history.sql`
3. `0003_notifications_ratings.sql`
4. `0004_auth_trigger.sql`
5. `0005_rls_policies.sql`
6. `0006_prevent_role_escalation.sql` — closes a gap where a user could
   otherwise promote themselves to admin by updating their own profile row
7. `0007_valid_status_transitions.sql` — Phase 6: enforces the real
   delivery lifecycle order at the database level
8. `0008_notifications_trigger.sql` — Phase 8: auto-creates a notification
   for the requester whenever their delivery's status actually changes

Paste each file's contents, run it, confirm no errors, then move to the
next. (If you have the Supabase CLI installed locally, `supabase db push`
runs them all in order automatically — but the SQL Editor works fine for
now and doesn't require installing anything.)

## 3. Get your API credentials

**Project Settings → API**. You'll need two values for the front end later
(Phase 4):
- **Project URL** (looks like `https://xxxxx.supabase.co`)
- **anon public key** (safe to expose in front-end code — RLS is what
  actually protects the data, not keeping this key secret)

Don't use the **service_role** key anywhere in front-end code — it bypasses
RLS entirely.

## 4. Enable Google Sign-In

1. In Supabase: **Authentication → Providers → Google** → toggle it on.
2. You'll need a Google OAuth Client ID/Secret from
   [Google Cloud Console](https://console.cloud.google.com/):
   - Create a project (or use an existing one).
   - **APIs & Services → OAuth consent screen** — fill in the basics
     (app name, support email).
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID**
     → type: **Web application**.
   - Add the **Authorized redirect URI** Supabase shows you on its Google
     provider setup screen (it's your project's callback URL).
   - Copy the generated **Client ID** and **Client Secret** back into the
     Supabase Google provider settings, then save.
3. Test sign-in once Phase 4 wires up the actual login button — don't test
   this in isolation via `curl`, it needs a real browser redirect flow.

## 5. Creating an admin account

Admin is deliberately not selectable during normal registration (per
Phase 0.1). To create one, after a person has registered normally through
the website (so their `auth.users` row exists), run this in the SQL
Editor, replacing the email:

```sql
update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'the-admin-email@example.com');
```

There is intentionally no self-service way to become an admin from the UI.

## 7. Enable Realtime for live tracking and notifications (Phase 7 & 8)

The farmer/vendor tracking map and the notification bell both update live
(no manual refresh) using Supabase Realtime, which needs to be turned on
per-table:

1. In Supabase: **Database → Publications**.
2. Click into the `supabase_realtime` publication (it shows "0 tables" by
   default — that's the actual toggle list, not a separate settings page).
3. Turn on both `deliveries` and `notifications`. Leave everything else off.

Without this step, tracking and notifications still work, but the person
has to click "Refresh" to see updates instead of seeing them appear live.

## 8. What's next

This is Phase 3 — schema only, no front-end wiring yet. Phase 4 (real
authentication) is where `sakada-web/` actually calls this Supabase project:
adding the `supabase-js` client library, building real login/register forms
for the three public roles, and connecting the dashboards so a session
actually determines what a user can see — matching the RLS rules already
in place here.