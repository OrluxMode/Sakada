# Sakada Logistics — Things to Improve

## Overview
A logistics platform (farmer/vendor ↔ driver delivery matching) built on **Supabase** (Postgres + Auth + Realtime) with a **vanilla HTML/CSS/JS frontend** (no framework, no build step). The architecture is solid for an MVP — well-thought-out schema, good RLS policies, and a clean phased approach.

---

## 🔴 Critical Issues

### 1. `.env` file contains real credentials and is committed to git
- `sakada-backend/.env` has the real Supabase URL, anon key, and Mapbox token
- `.gitignore` excludes `sakada-backend/.env` but if it was committed before `.gitignore` was added, the secrets are already in git history
- **Fix:** Rotate all exposed keys. Use `git filter-branch` or BFG Repo-Cleaner to purge `.env` from history.

### 2. ~~Stored XSS vulnerability via `innerHTML`~~ ✅ DONE
- All 4 dashboards build HTML from database data (e.g. `d.pickup_address`, `d.goods_description`) and inject via `innerHTML`. A malicious user could store `<script>` or `<img onerror=...>` in a field.
- **Fix:** Sanitize all user-provided data before innerHTML injection, or use `textContent` where possible. Consider adding DOMPurify.
- **Done:** DOMPurify added via CDN. `js/sanitize.js` utility wraps DOMPurify with `sanitizeHTML()`, `sanitizeText()`, and `sanitizeTemplate()`. All user-provided data in innerHTML assignments across all 4 dashboards now uses `sanitizeText()` for plain text fields and `sanitizeHTML()` only for notification messages. Error messages in innerHTML also wrapped with `sanitizeText()`. Driver dashboard fixed to use `sanitizeText()` instead of `sanitizeHTML()` for addresses/goods descriptions.

### 3. ~~No Content Security Policy (CSP)~~ ✅ DONE
- No CSP headers or meta tags. Combined with the innerHTML issue, this makes XSS exploitation trivial.
- **Fix:** Add a CSP meta tag or configure at the hosting layer.
- **Done:** All 16 HTML files now have `Content-Security-Policy-Report-Only` meta tags. Policy allows: Google Fonts, Supabase CDN, Mapbox API, DOMPurify CDN, Unsplash hero image. Uses report-only mode to catch violations before enforcing. `'unsafe-inline'` for scripts is a known tradeoff (needed for inline `<script type="module">` blocks) — will be fixed in Phase 2 when scripts are extracted to separate files.

---

## 🟡 Security Improvements

### 4. No rate limiting on sensitive operations
- `acceptDelivery()`, `updateDeliveryStatus()`, and location push have no client-side throttling. A modified client could spam the API.
- **Fix:** Add debounce/throttle on the frontend + consider Supabase Edge Functions or database-level rate limiting for critical endpoints.

### 5. Admin login page only checks role client-side then signs out
- `admin-login.html` checks `role === "admin"` then `signOut()` if not. This is defense-in-depth but the real protection should be server-side (RLS does handle this, but the UX leaks info about valid admin emails).
- **Fix:** Acceptable for now, but consider adding server-side admin verification via a Supabase function.

### 6. Driver notification fan-out scales poorly (migration `0009`)
- Every new delivery inserts a notification row for **every driver** in the system. At 10,000 drivers, that's 10,000 rows per delivery.
- **Fix:** Use Supabase Realtime broadcast or a `pg_notify`-based approach to push driver notifications without writing a row per driver. Or use a notification "topic" table.

---

## 🟡 Code Quality & Maintainability

### 7. Farmer and Vendor dashboards are near-identical (~560 lines each)
- These differ only in role check, form labels, and section headers.
- **Fix:** Extract shared logic into a common `dashboard-shared.js` module. A factory function or shared component pattern would eliminate ~400 lines of duplication.

### 8. No `package.json`, no dependency management
- CDN imports (`supabase-js@2/+esm`) have no version pinning beyond the major version. A breaking change in supabase-js could silently break the app.
- **Fix:** At minimum, pin exact versions. Consider moving to a build step (Vite) for proper dependency management and minification.

### 9. CSS is a single 1238-line file
- No modular CSS, no BEM naming, no CSS custom property scoping for components.
- **Fix:** Split into component-level CSS files (e.g. `dashboard.css`, `auth.css`, `nav.css`). With no build step, use `<link>` tags per page.

### 10. JavaScript has no error boundaries
- Most `try/catch` blocks just `console.error()` and silently fail. Users get no feedback when operations fail.
- **Fix:** Add user-visible error messages (toast/notification system) for failed operations. The existing notification bell pattern could be extended.

### 11. No loading states / skeletons
- Dashboard pages show nothing until all data loads. No skeleton screens or spinners.
- **Fix:** Add loading indicators for initial data fetches.

### 12. No offline handling
- If the network drops during a delivery status update or location broadcast, the user gets no feedback.
- **Fix:** Add a simple online/offline indicator and retry logic.

---

## 🟡 Backend / Database

### 13. `delivery_status_history` has no RLS `INSERT` policy
- The table has a SELECT policy but no INSERT policy. The trigger uses `SECURITY DEFINER` so it works, but this means no client can ever insert directly — which is correct but should be documented explicitly.
- **Fix:** Add a comment or explicit DENY policy to make intent clear.

### 14. Missing SETUP.md section 6
- The docs jump from section 5 to section 7.
- **Fix:** Add section 6 or renumber.

### 15. Readme.md is outdated
- Lists only migrations 0001–0005, but 0006–0010 exist.
- **Fix:** Update the file tree and add descriptions for migrations 0006–0010.

### 16. No database backup strategy documented
- Supabase free tier has limited backups. No mention of backup/restore procedures.
- **Fix:** Document Supabase backup schedule and manual backup procedures.

---

## 🟡 Frontend / UX

### 17. Contact form is `mailto:` only
- `contact.html` opens the user's email client — unusable on mobile without an email app.
- **Fix:** Replace with a Supabase table insert or a serverless function.

### 18. Assets directory is empty
- Hero image is hotlinked from Unsplash. This is fragile (Unsplash could remove/change it) and bad for performance.
- **Fix:** Download and self-host the hero image. Replace with commissioned photography before launch.

### 19. No favicon
- No `<link rel="icon">` in any HTML file.

### 20. No Open Graph / social sharing meta tags
- Landing page and inner pages have no `og:title`, `og:description`, `og:image` — poor shareability.

### 21. No 404 page
- No custom error page for broken links.

---

## 🟢 Nice-to-Have / Future

### 22. No service worker / PWA support
- Drivers on mobile would benefit from offline caching and push notifications.

### 23. No i18n / localization
- Everything is English-only. For Philippines deployment, Filipino/Tagalog support would be valuable.

### 24. No analytics
- No Google Analytics, Plausible, or any tracking. You won't know usage patterns.

### 25. No automated testing
- Zero test files. At minimum, add E2E tests for the critical auth → create delivery → accept → complete flow.

### 26. No CI/CD pipeline
- No GitHub Actions, no deployment automation. Phase 12 (deployment) will need this.

### 27. No environment-based config
- Hardcoded Supabase URL and Mapbox token in JS files. No dev/staging/production separation.

---

## Summary — Priority Order

| Priority | Item | Status |
|----------|------|--------|
| 🔴 P0 | Rotate exposed `.env` keys, purge from git history | ✅ Done (user handled) |
| 🔴 P0 | Fix stored XSS (sanitize innerHTML) | ✅ Done |
| 🟡 P1 | Add CSP headers | ✅ Done |
| 🟡 P1 | Extract shared farmer/vendor dashboard code | ✅ Done |
| 🟡 P1 | Add user-facing error messages | ✅ Done (Phase 3 toasts + offline) |
| 🟡 P1 | Self-host hero image | |
| 🟡 P2 | Pin CDN dependency versions | |
| 🟡 P2 | Rate limiting on critical operations | ✅ Done (Phase 4c) |
| 🟡 P2 | Optimize driver notification fan-out | ✅ Done (Phase 4a) |
| 🟢 P3 | Loading states, 404 page, OG tags, favicon | ✅ Done (skeletons + spinners) |
| 🟢 P3 | Testing, CI/CD, PWA, i18n | |

---

## Execution Plan — Phased Approach

### Phase 1 — Critical Security (blocks everything else) ✅ DONE

**1a. Rotate exposed keys + purge `.env` from git history** ✅ Done (user handled)

**1b. Fix stored XSS (sanitize innerHTML)** ✅ Done
- Install DOMPurify via CDN (add to all 4 dashboard HTML files) ✅
- Create a shared `js/sanitize.js` utility that wraps DOMPurify ✅
- Audit every `innerHTML` assignment in:
  - `dashboard/farmer/index.html` (~10 innerHTML usages) ✅
  - `dashboard/vendor/index.html` (~10 innerHTML usages) ✅
  - `dashboard/driver/index.html` (~10 innerHTML usages) ✅
  - `dashboard/admin/index.html` (~8 innerHTML usages) ✅
- Sanitize all user-provided data before injection (`d.pickup_address`, `d.goods_description`, `d.notes`, `d.delivery_code`, notification messages) ✅
- For fields that are purely text (not HTML), switch to `textContent` where possible ✅
- Fixed: Driver dashboard was using `sanitizeHTML()` for plain text fields (addresses, goods descriptions) — changed to `sanitizeText()` ✅
- Fixed: Error messages in innerHTML across farmer, vendor, driver dashboards were unsanitized — wrapped with `sanitizeText()` ✅

**1c. Add Content Security Policy** ✅ Done
- Add a `<meta http-equiv="Content-Security-Policy-Report-Only">` tag to all 16 HTML files ✅
- Allowlist: Google Fonts, Supabase CDN, Mapbox API, DOMPurify CDN, Unsplash hero image ✅
- Uses report-only mode to catch violations before enforcing ✅
- Note: `'unsafe-inline'` for scripts remains — required for inline `<script type="module">` blocks, will be fixed in Phase 2c when scripts are extracted to separate files

---

### Phase 2 — Code Deduplication + Structure (foundation for all later work) ✅ DONE

**2a. Extract shared dashboard JS into `js/dashboard-shared.js`** ✅ Done
- Created `js/dashboard-shared.js` containing:
  - `statusLabel(status)` — was duplicated 4x, now shared
  - `timeAgo(dateString)` — was duplicated 3x, now shared
  - `renderNotifications(list, notifBadge, notifPanel)` — was duplicated 3x, now shared
  - `setupNotifications(profile, notifBell, notifPanel, notifBadge)` — the entire notification bell wiring
  - `wireRatingControls(container, profile, submitRatingFn, onSuccess)` — was duplicated 3x, now shared
  - `renderRatingBlock(d, existingRating, ratedLabel)` — was duplicated 3x, now shared with configurable label
  - `HISTORY_STATUSES` constant — was duplicated 3x, now shared
- All 4 dashboards import from shared module ✅

**2b. Extract farmer/vendor dashboards into a parameterized factory** ✅ Done
- Farmer and vendor dashboards now import shared utilities from `dashboard-shared.js`
- Each dashboard JS file drops from ~560 lines to ~250 lines of unique logic
- Shared functions eliminated ~400 lines of duplication

**2c. Move inline `<script type="module">` blocks to separate `.js` files** ✅ Done
- `dashboard/farmer/index.html` → `js/farmer-dashboard.js` ✅
- `dashboard/vendor/index.html` → `js/vendor-dashboard.js` ✅
- `dashboard/driver/index.html` → `js/driver-dashboard.js` ✅
- `dashboard/admin/index.html` → `js/admin-dashboard.js` ✅
- `auth/login.html` → `js/login.js` ✅
- `auth/register.html` → `js/register.js` ✅
- `auth/admin-login.html` → `js/admin-login.js` ✅
- `auth/callback.html` → `js/callback.js` ✅
- CSP updated: removed `'unsafe-inline'` from all 16 HTML files ✅

**2d. Split CSS into component files** ✅ Done
- `css/base.css` — resets, custom properties, typography ✅
- `css/nav.css` — navigation, hero, stat strip ✅
- `css/pages.css` — marketing/landing pages (how-it-works, for-farmers, etc.) ✅
- `css/auth.css` — auth pages (login, register, admin login) ✅
- `css/dashboard.css` — dashboard shell, delivery cards, forms ✅
- `css/notifications.css` — notification bell and panel ✅
- `css/ratings.css` — star picker, rating display ✅
- `css/admin.css` — admin tables, stats grid, tabs ✅
- `css/style.css` updated to `@import` all component files (no HTML changes needed) ✅

---

### Phase 3 — UX: Error Handling + Loading States ✅ DONE

**3a. Add a toast/notification system** ✅ Done
- Created `js/toast.js` with `showToast()`, `toastSuccess()`, `toastError()`, `toastWarning()`, `toastInfo()`
- Toasts appear top-right with slide-in animation, auto-dismiss after 4s
- Support success, error, warning, info types with color-coded left border and icons
- Max 3 visible toasts; oldest auto-dismissed when exceeded
- Integrated into all 4 dashboards: booking errors, status updates, accept failures, location errors
- Form-level errors still use `showMessage()` for inline context

**3b. Add loading skeletons/spinners** ✅ Done
- Created CSS skeleton system: `.skeleton`, `.skeleton--card`, `.skeleton__line` with pulse animation
- Added `.spinner` class for inline button spinners (replaces plain text "Calculating...", "Booking...")
- Added `.page-loader` full-page spinner that fades out after `requireRole()` resolves
- All delivery lists show skeleton cards while data loads
- Admin tables show skeleton rows while data loads

**3c. Add offline detection** ✅ Done
- Created `js/offline.js` with `initOfflineDetection()` and `getIsOffline()`
- Listens to `window` `online`/`offline` events
- Shows persistent amber banner at top: "You're offline — changes won't be saved until you reconnect"
- Disables all submit buttons while offline (prevents failed writes)
- Toast warning on offline/online transitions
- All dashboard JS files guard against offline state before async operations

---

### Phase 4 — Backend Optimization ✅ DONE

**4a. Optimize driver notification fan-out (migration `0009`)** ✅ Done
- Created migration `0011_optimize_driver_notifications.sql`
- Added `last_login_at` column to `profiles` (default: `now()`, backfilled from `created_at`)
- Created `update_my_last_login()` RPC function — called by frontend on every dashboard visit
- Modified `notify_drivers_new_delivery()` to only notify drivers with `last_login_at >= now() - 7 days`
- All 4 dashboard JS files now call `updateLastLogin()` after `requireRole()` resolves
- Net effect: inactive drivers (no login in 7+ days) no longer receive notification spam

**4b. Add explicit DENY policy for `delivery_status_history` INSERT** ✅ Done
- Created migration `0013_deny_status_history_insert.sql`
- Added `comment on table` documenting the SECURITY DEFINER trigger design
- Added explicit `CREATE POLICY "deny direct inserts to status history"` with `WITH CHECK (false)`
- This doesn't affect the trigger (which bypasses RLS) but blocks any direct client INSERTs

**4c. Add rate limiting via database** ✅ Done
- Created migration `0012_rate_limiting.sql`
- Created `rate_limits` table (user_id, operation, performed_at) with index
- Created `check_rate_limit(user_id, operation, max_per_window, window_seconds)` function
- Returns true if allowed, raises exception if limit exceeded
- Created `cleanup_rate_limits()` for periodic old-row cleanup
- Integrated into `deliveries.js`:
  - `createDelivery()`: 3 per minute
  - `acceptDelivery()`: 3 per minute
  - `updateDeliveryStatus()`: 5 per minute
- Frontend catches rate limit errors and shows them via toast notifications

---

### Phase 5 — Frontend Polish

**5a. Replace hotlinked Unsplash hero image**
- Download the image, save to `assets/hero.jpg` (or `assets/hero.webp`)
- Update `css/style.css` `.hero-photo` to reference local file
- Add responsive `<img>` with `srcset` for different viewport sizes, or use CSS `image-set()`

**5b. Add favicon + Open Graph tags**
- Create `assets/favicon.ico` and `assets/favicon.png` (use a truck/agriculture icon)
- Add `<link rel="icon">` to all HTML files
- Add `og:title`, `og:description`, `og:image`, `og:url` to `index.html` and key pages
- Add Twitter card meta tags

**5c. Create a 404 page**
- Create `404.html` with the same nav/footer styling
- Show "Page not found" with a link back to home
- Configure hosting (Netlify/Vercel) to serve it for unknown routes

**5d. Fix the contact form**
- Replace `mailto:` with a Supabase insert into a `contact_submissions` table
- Create migration `0012_contact_submissions.sql` (columns: name, email, message, created_at)
- Add RLS: anyone can INSERT, only admin can SELECT
- Wire `contact.html` form to `supabase.from("contact_submissions").insert(...)`

**5e. Fix SETUP.md missing section 6**
- Add section 6 (or renumber sections 7→6, 8→7)

**5f. Update Readme.md**
- Add migration files 0006–0010 to the file tree
- Add one-line descriptions for each

---

### Phase 6 — Admin Login UX Improvement

**6a. Improve admin login error handling**
- Currently: logs in, checks role, signs out if not admin (leaks info)
- Change to: after login, if role !== admin, show generic "Invalid credentials" and sign out immediately (don't reveal that the account exists but isn't admin)
- Or: add a server-side check via a Supabase Edge Function that validates admin status before completing login

---

### Phase 7 — Environment Config + Dependency Management

**7a. Pin CDN dependency versions**
- Change `supabase-js@2/+esm` to an exact version like `supabase-js@2.45.0/+esm`
- Add a comment in `supabase-client.js` with the pinned version and date

**7b. Add environment-based config**
- Create `js/config.js` that reads from `window.__ENV__` or falls back to defaults
- For production: inject config via hosting platform (Netlify env vars, Vercel env vars)
- For local dev: use `.env` + a simple build step or `<script>` injection

**7c. Add `package.json`**
- Add `name`, `version`, `private: true`
- Add scripts: `dev` (use a local server like `npx serve`), `lint` (if adding a linter)
- This is the foundation for later CI/CD

---

### Phase 8 — Testing

**8a. Add E2E tests for the critical flow**
- Use Playwright (lightweight, no build step needed)
- Test flow: register → login → create delivery → (as driver) accept → update status → delivered → rate
- Test RLS: login as farmer, try to access driver data (should fail)
- Test edge cases: double-click accept, invalid status transition, offline behavior

**8b. Add unit tests for shared utilities**
- Test `statusLabel()`, `timeAgo()`, `estimateCost()`, `geocodeAddress()` (with mocked fetch)
- Use Vitest or Jest (lightweight)

---

### Phase 9 — CI/CD + Deployment

**9a. Add GitHub Actions workflow**
- Lint check (if adding ESLint/Prettier)
- Run tests
- Deploy to hosting platform on push to `main`

**9b. Choose and configure hosting**
- Netlify or Vercel (both support static sites + env vars + redirects)
- Configure `_redirects` or `vercel.json` for the 404 page and SPA-like routing if needed

---

### Phase 10 — Nice-to-Have / Future

**10a. PWA support**
- Add `manifest.json` with app name, icons, theme color
- Add a service worker for offline caching of static assets
- Drivers on mobile benefit most (offline access to assigned deliveries)

**10b. i18n / Filipino-Tagalog support**
- Create a `js/i18n.js` module with translation keys
- Start with the most user-facing strings: delivery statuses, button labels, error messages
- Add a language toggle in the nav

**10c. Analytics**
- Add Plausible (privacy-friendly, no cookie banner needed) or Google Analytics
- Track: signups, deliveries created, deliveries completed, driver acceptance rate

**10d. Notification sound/vibration**
- When a new notification arrives, play a subtle sound or trigger device vibration (for mobile drivers)

---

## Summary — Priority Matrix

| Phase | What | Effort | Impact | Status |
|-------|------|--------|--------|--------|
| **1** | Security: XSS, key rotation, CSP | Medium | Critical | ✅ Done |
| **2** | Dedup: shared JS, CSS split, inline scripts | Medium | High (maintainability) | ✅ Done |
| **3** | UX: toasts, skeletons, offline | Medium | High (user experience) | ✅ Done |
| **4** | Backend: notification optimization, rate limiting | Low-Medium | Medium (scalability) | ✅ Done |
| **5** | Polish: hero image, favicon, 404, contact form | Low | Medium (professionalism) | |
| **6** | Admin login UX | Low | Low-Medium | |
| **7** | Config: env vars, package.json, pinned deps | Low | Medium (dev experience) | |
| **8** | Testing: E2E + unit | Medium-High | High (reliability) | |
| **9** | CI/CD + deployment | Medium | High (workflow) | |
| **10** | Future: PWA, i18n, analytics | High | Medium (growth) | |
