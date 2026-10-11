# Sakada — Read & Analyze Report

**Date:** 2026-10-10 · **Analyst:** Claude (Opus 5.5) · **Mode:** read-only (no project files modified)
**Repo state at analysis:** `main` @ `656cfca`, untracked: `SESSION-NOTES-2026-10-03.md`, `screenshot/{2,3,4,5}.png`

---

## 1. What Sakada is

An agricultural delivery platform for the Philippines: **farmers/vendors book trucks, drivers accept and deliver, admins oversee.**

| Layer | Tech |
|---|---|
| Frontend (`sakada-web/`) | Vanilla HTML + CSS + ES modules. No framework, no build step. |
| Backend (`sakada-backend/`) | Supabase (Postgres + Auth + Realtime). No custom server — the browser talks to Supabase directly, so **RLS is the real security boundary**. |
| Maps / pricing | Mapbox geocoding + directions + static map images (`js/mapbox-client.js`) |
| Sanitizing | DOMPurify 3.1.6 via CDN (dashboards only) |
| Hosting | Vercel, static, `outputDirectory: sakada-web`, auto-deploy on push to `main` → `https://sakada-blue.vercel.app` |
| Tests | Vitest + jsdom — **41/41 passing** (re-ran today) |

### Size
~6,000 lines of real code: 18 JS modules (~2,050 lines), 13 CSS files (~2,300), 17 HTML pages, 14 SQL migrations (~730), 4 test files.

---

## 2. Folder map

```
Sakada/
├── vercel.json, .vercelignore, .gitignore
├── things-to-improve.md          ← phased roadmap (Phases 1–10), mostly ✅
├── things-to-improve-design.md   ← design audit + token/animation specs
├── need to fix.md                ← pre-deploy QA audit (partly stale)
├── SESSION-NOTES-2026-10-03.md   ← last session (Vercel deploy + fixes) — untracked
├── screenshot/                   ← palette + Supabase config screenshots, CONVERSATION-SUMMARY.md
├── .opencode/skills/impeccable/  ← design-rules skill used for audits
├── sakada-backend/
│   ├── supabase/migrations/0001–0014
│   ├── docs/SCHEMA.md, SETUP.md
│   └── .env (gitignored, never committed ✅), .env.example
└── sakada-web/
    ├── index.html, 404.html
    ├── pages/      about, contact, features, for-{farmers,vendors,drivers}, how-it-works
    ├── auth/       login, register, admin-login, callback
    ├── dashboard/  farmer/, vendor/, driver/, admin/  (each index.html)
    ├── js/         see §3
    ├── css/        style.css @imports base, forms, nav, pages, auth, dashboard, notifications, ratings, admin, ui-feedback, contact
    ├── tests/      dashboard-shared, mapbox-client, sanitize, toast
    └── docs/       DESIGN-SYSTEM.md, SITE-MAP.md
```

---

## 3. How the code fits together

```
config.js ──► supabase-client.js ──► auth.js ──► login / register / admin-login / callback
          └─► mapbox-client.js                └► *-dashboard.js (requireRole guard)
supabase-client.js ──► deliveries.js, notifications.js, ratings.js, admin-data.js, contact.js
dashboard-shared.js  (statusLabel, timeAgo, notifications bell, rating block) ──► farmer/vendor/driver dashboards
toast.js, offline.js, sanitize.js  ──► dashboards
main.js  ──► marketing pages (mobile nav toggle only)
```

**Delivery lifecycle** (enforced by trigger `0007`):
`pending → driver_assigned → picked_up → in_transit → delivered`, with `cancelled` allowed from `pending` or `driver_assigned`.

**Database triggers do the side effects:** status history (`0002`), profile creation on signup (`0004`), requester notifications (`0008`), driver fan-out notifications for active drivers only (`0009` → `0011`).

**Good engineering already in place:**
- Optimistic-concurrency guards on accept/status update (`.eq("status", current)` + `.is("driver_id", null)`) — two drivers can't both win.
- Role escalation blocked by trigger (`0006`/`0010`); `admin` can't be chosen at signup (`0004`).
- XSS: all DB strings go through `sanitizeText()` before `innerHTML`; toasts use `textContent`.
- **Enforcing** CSP `<meta>` on all 16 pages with no `unsafe-inline` for scripts. (Docs still say "Report-Only" — that's out of date; it's enforcing now.)
- Accessibility basics: skip links, global `:focus-visible`, `prefers-reduced-motion`, `aria-live` toasts.

---

## 4. NEW findings (not in any existing .md)

Ranked by severity. File:line refs are as of `656cfca`.

### 🔴 High

**N1. Contact form probably fails on every submit — schema mismatch.**
`js/contact.js:73-80` inserts `name, email, phone, role, purpose, message`, but `migrations/0014_contact_submissions.sql` only creates `name, email, message`. PostgREST rejects unknown columns → the user always sees "Something went wrong."
*Couldn't confirm against the live DB (that check was blocked). Either the live table was altered by hand, or the form is broken in production. Quick check: submit the form on the live site, or look at the table's columns in the Supabase dashboard.*

**N2. Google sign-up ignores the chosen role — everyone becomes a farmer.**
`js/auth.js:38-45` passes `options.data` to `signInWithOAuth`, but supabase-js only supports `data` on `signUp`, not on OAuth. No role metadata gets sent, so `handle_new_user()` (`0004`) falls back to `'farmer'`. A driver or vendor who registers with Google ends up on the farmer dashboard, and per `0006` they can't change their own role.

**N3. A driver's rating gets recorded against the driver themselves.**
`js/dashboard-shared.js:83` sets `data-other-user-id="${d.driver_id || d.requester_id}"`. On the driver dashboard, `d.driver_id` is the driver, so the driver rates themselves. The RLS insert policy (`0005`, ratings) never checks that `rated_user_id` is the *other* party, so the database accepts it.
Fix idea: pass the "other" id explicitly per dashboard, and add `rated_user_id <> auth.uid() AND rated_user_id IN (requester_id, driver_id)` to the policy.

**N4. The assigned driver can change *any* column on their delivery.**
In `0005` the policy "assigned driver can progress delivery status" uses `using/with check (auth.uid() = driver_id)` with no column limit. From the browser console a driver can change `estimated_cost`, addresses, `requester_id`, etc. Trigger `0007` only checks `status`.
Same pattern: "requester can cancel their own pending delivery" lets the requester edit any column while the delivery is `pending`.

**N5. Prices are set by the client.**
`estimated_cost` is calculated in the browser (`mapbox-client.js estimateCost`) and inserted as-is. A farmer can insert a ₱1 delivery through the API. When real money is involved, compute it server-side (DB function or Edge Function).

### 🟡 Medium

**N6. Rate limiting is advisory only.** `check_rate_limit` (`0012`) is an RPC the *client* chooses to call. It also takes `p_max_per_window` from the client, so a modified client can skip it or pass `999999`. To enforce it, call it from a `BEFORE INSERT/UPDATE` trigger with fixed limits.
`cleanup_rate_limits()` is never scheduled, and the comment saying "cleaned up on every check_rate_limit call" is wrong, so `rate_limits` grows forever.

**N7. PII is readable by every logged-in user.** `profiles` is selectable by any authenticated user (`0005`), which includes `phone`. `driver_profiles` (license number, live `current_lat/lng`) is also open to all authenticated users. Any farmer can dump every user's name and phone from the console.

**N8. Driver notifications render user-supplied HTML.** The `0009`/`0011` message concatenates `pickup_address`/`dropoff_address`, and `dashboard-shared.js:47` renders it with `sanitizeHTML` (allows `<a href>`, `<img src>`). A farmer could put a phishing link or tracking pixel into every active driver's notification panel. Use `sanitizeText` there, since all notification messages are plain text.

**N9. SECURITY DEFINER functions without `set search_path`:** `log_delivery_status_change` (`0002`), `is_admin` (`0005`), `cleanup_rate_limits` (`0012`). Supabase's security advisor flags this.

**N10. No security headers at the host.** `vercel.json` has no `headers`. Browsers ignore `frame-ancestors` in a `<meta>` CSP, so there's no clickjacking protection. Add `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, and `X-Content-Type-Options` in `vercel.json`.

**N11. Rating errors are swallowed.** `dashboard-shared.js:133-137` returns `{error}` from an event handler, so nothing is shown. The button just resets and the user doesn't know why.

### 🔵 Low / cleanup

- **N12.** `farmer-dashboard.js` and `vendor-dashboard.js` are **byte-identical except line 26** (`"farmer"` vs `"vendor"`), so 308 lines are duplicated. The "factory" from roadmap Phase 2b was never actually done. Could be one `requester-dashboard.js` that reads the role from a `data-role` on `<body>`.
- **N13.** Stale placeholder: farmer and vendor dashboards still show *"Coming in Phase 9: ratings and feedback"* (`dashboard/{farmer,vendor}/index.html:152`), but ratings already ship.
- **N14.** Farmers/vendors can't cancel their own pending delivery in the UI, even though RLS and trigger `0008` support it. Only admin has a Cancel button.
- **N15.** Stale quote: after "Get Estimated Cost", changing the address fields and clicking Confirm books the *old* addresses (`farmer-dashboard.js:130-145` uses `pendingQuote`).
- **N16.** `callback.js` has no fallback. If the profile row is missing, the user sits on the callback page forever.
- **N17.** `offline.js:46` shows "You're back online" as a *warning* toast; it should be success/info.
- **N18.** Admin dashboard has no view for `contact_submissions`, so messages are only visible in the Supabase UI. `loadFeedback()` also refetches all deliveries a second time. No pagination anywhere.
- **N19.** `supabase-client.js` sets `auth.lock: false`, which disables the cross-tab lock and can cause token-refresh races with several tabs open.
- **N20.** Version drift: tests use DOMPurify `^3.4.15` (devDependency) while production loads `3.1.6` from CDN.
- **N21.** Requester can set *themselves* as driver on their own pending delivery. The "driver can accept" policy doesn't check `role = 'driver'`; only the SELECT policy hides other people's rows.
- **N22.** Register/contact role selectors use `role="tablist"` without `role="tab"`/`aria-selected` on the buttons (register).
- **N23.** Docs drift: `sakada-backend/Readme.md` says "through 0013" (0014 exists). `things-to-improve.md` says CSP is report-only (it's enforcing). `SCHEMA.md` says notifications aren't created by triggers (they are, since 0008).

---

## 5. Still-open items from previous sessions (re-verified today)

| # | Item | Status |
|---|---|---|
| 1 | `og:image`/`og:url`/`twitter:image` → `sakadalogistics.ph` (broken TLS) — `index.html:24` | ❌ still open |
| 2 | `console.warn("updateLastLogin:")` — `js/auth.js:60` | ❌ still open |
| 3 | `assets/hero-mobile.jpg` unreferenced | ❌ still open |
| 4 | `assets/images/` empty dir | ❌ still open |
| 5 | `auth/callback.html:10` narrower font subset | ❌ still open |
| 6 | Status pill colors hardcoded (`css/dashboard.css:175,184,188`) | ❌ still open |
| 7 | Notification panel has no transition | ❌ still open |
| 8 | `--shadow-*` tokens missing | ❌ still open |
| 9 | ESLint stub, no CI (GitHub Actions), no E2E tests | ❌ still open |
| 10 | Kairo palette decision (`screenshot/CONVERSATION-SUMMARY.md`) | ⏸ awaiting your decision |
| 11 | `screenshot/*.png` + session notes untracked | ⏸ commit or ignore? |

---

## 6. Suggested priority order for next work

1. **N1** contact form: verify live, then add an `0015` migration with `phone, role, purpose` (or trim the JS). Small fix, and the bug is user-facing.
2. **N2** Google role: pass role via `queryParams`/redirect state, or have callback ask for the role on first login.
3. **N3 + N4 + N21**: one `0015/0016` RLS hardening migration (column-limited updates via trigger, rating target check, driver-role check on accept).
4. **og:image** fix (5 minutes).
5. **N6, N7, N9**: second security migration (server-enforced rate limits, PII-limited profile view, `search_path`).
6. **N10**: security headers in `vercel.json`.
7. **N12**: merge farmer/vendor dashboard JS.
8. CI (lint + vitest on PR), then E2E for signup → book → accept → deliver → rate.

---

## 7. Verification commands

```bash
cd sakada-web && npx vitest run            # 41/41 as of 2026-10-10
cd sakada-web && npm run dev               # http://localhost:3000
diff sakada-web/js/farmer-dashboard.js sakada-web/js/vendor-dashboard.js   # proves N12
grep -n "data:" sakada-web/js/auth.js      # N2 (OAuth data option)
```
