# Session Notes — 2026-10-02 → 2026-10-03

Session focused on **getting Sakada live on Vercel**, then **auditing and fixing the frontend** with the `.opencode/skills/impeccable` skill.

---

## Quick reference

| Thing | Value |
|---|---|
| Repo | `https://github.com/OrluxMode/Sakada.git` (public, branch `main`) |
| Local | `/home/orlux/Desktop/Sakada` |
| **Live site** | **`https://sakada-blue.vercel.app`** |
| Deploy | Vercel → `outputDirectory: sakada-web`, auto-deploys on push to `main` |
| Supabase project | `aeeniueayubeugvooyqj` |
| Supabase credentials | `sakada-web/js/config.js` (single source of truth) |
| Mapbox token | `sakada-web/js/config.js` (was duplicated) |
| Local dev | `cd sakada-web && npm run dev` → `http://localhost:3000` |
| Tests | `cd sakada-web && npx vitest run` → **41/41 passing** |
| Git author | `Orlux <qadriancarlo@gmail.com>` |

### Commits this session

| Hash | Message |
|---|---|
| `5f1e2c5` | Prepare Vercel deployment |
| `026b325` | Fix two P0 CSS bugs found in design audit |
| `656cfca` | Fix dashboard redirects to 404 page; consolidate credentials in config.js |

---

## Things we did

### 1. Deploy to Vercel
- Untracked `sakada-web/node_modules` (2034 files / ~40MB), added `node_modules/` to `.gitignore`. Tracked files dropped **2122 → 63** (now 91).
- Created root `vercel.json` (`framework: null`, `buildCommand: ""`, `installCommand: ""`, `outputDirectory: "sakada-web"`) and `.vercelignore`.
- You imported the repo in the Vercel dashboard → site is live and auto-deploys.
- **Verified live:** all routes 200, custom `404.html` served, correct JS/CSS MIME types, 24-page internal link crawl found 0 broken links, CORS reflected by Supabase, full ES-module chain executes.

### 2. Impeccable design audit → 4 issues, 2 fixed as P0 (`026b325`)
- **New `css/forms.css`** — `.field`/`label`/`input` rules were trapped inside `contact.css`, so 5 other pages had unstyled form fields. Moved out and `@import`ed at `css/style.css:2`.
- **Scoped `css/auth.css` role-tab selectors to `.auth-card`** — the old `.role-tabs button.active` (specificity `0,2,1`) beat `.role-tab.active` (`0,2,0`), rendering amber text on an amber chip (invisible text on the role selector).
- **Added 11 design tokens** to `css/base.css` `:root` — `--space-xs/sm/md/lg/xl/2xl/3xl`, `--radius-sm/md/lg/pill`.
- Unified `pages/contact.html` footer to `© 2026 Sakada Logistics.` to match every other page.
- **Verified by pixel analysis** (headless Chrome + PIL, not eyeballing): role chip interior went from **4 → 316 distinct colors** (text now visible), chip width 114 → 134px, headline still above the fold on desktop (y=482/900) and mobile (y=257/844).

### 3. Mapbox — correction to an earlier claim
**Mapbox is NOT broken.** `js/mapbox-client.js` uses your real token (user `qadriancarlo`) and geocoding/directions/static-images all return 200. The 403 came from a **dead, unused token in `js/config.js`** — it was Mapbox's own docs example token, and `config.js` was imported by **zero files**.

### 4. Two P0s fixed (`656cfca`)
- **All 12 dashboard redirects landed on the 404 page.** Dashboards live at `/dashboard/<role>/index.html` (two levels deep) but used one-level paths, so `../auth/login.html` resolved to `/dashboard/auth/login.html` → 404. Hit every sign-out and every unauthenticated visit. Now `../../`.
  - **Live proof:** farmer dashboard → "Log In", admin dashboard → "Admin Login".
- **`js/config.js` was dead code** (0 imports, broken token, non-functional env-override). Wired `mapbox-client.js` and `supabase-client.js` to read from it. Credentials now live in **exactly one file**.

### 5. Supabase URL configuration verified
Confirmed via screenshots `screenshot/4.png` → `screenshot/5.png`:
- **Site URL:** `https://sakada-blue.vercel.app` — saved (Save button dimmed: brightness 186 vs Add URL's 333 = no pending changes).
- **5 redirect URLs** — the bad `http://127.0.0.1:3000/sakada-web/auth/callback.html` was replaced with `http://127.0.0.1:3000/**`.
- Verified by **pixel text-width analysis** (no OCR available): the old row measured 493px, gone in 5.png; a new 230px row appeared = exactly 23 chars = `http://127.0.0.1:3000/**`.

| # | Redirect URL | Purpose |
|---|---|---|
| 1 | `https://sakada-blue.vercel.app/auth/callback.html` | prod OAuth/email callback |
| 2 | `https://sakada-blue.vercel.app/**` | prod wildcard |
| 3 | `http://localhost:3000/auth/callback.html` | local dev |
| 4 | `http://localhost:3000/**` | local dev wildcard |
| 5 | `http://127.0.0.1:3000/**` | local dev via IP (different origin from `localhost`) |

**Limitation:** persistence can't be confirmed from outside — `/auth/v1/authorize?redirect_to=` 302-redirects even for `https://evil.example.com/x`, so it doesn't validate the allow list. The dimmed Save button is the only external signal.

### 6. Infrastructure verified (read-only, no users created)
- `profiles`, `deliveries`, `ratings`, `notifications`, `contact_submissions` all return `200 []` with the publishable key (tables exist, RLS allows reads, DB empty).
- Auth API reachable: password grant → `400 invalid_credentials`; signup → `422 weak_password`. Both endpoints live and validating.
- 14 migrations present in `sakada-backend/supabase/migrations/` (incl. RLS 0005, role-escalation prevention 0006/0010, rate limiting 0012).
- **No JS console errors** on register / login / vendor dashboard / contact (only Chromium environment noise).
- **You confirmed end-to-end vendor flow works perfectly** — signup → confirmation email → login → dashboard.

---

## Things to do next session

### A. Open bugs (from `need to fix.md`, re-verified today)

| # | Issue | Location | Notes |
|---|---|---|---|
| **1** | **`og:url` / `og:image` / `twitter:image` point at `https://sakadalogistics.ph/`** which returns `tlsv1 alert internal error` → broken social previews | `sakada-web/index.html:24,26,31` | Switch to `https://sakada-blue.vercel.app/...` — **5 min fix, highest value** |
| **2** | `console.warn("updateLastLogin:", …)` leaks error detail | `sakada-web/js/auth.js:60` | Remove or gate behind a `DEBUG` flag |
| **3** | `assets/hero-mobile.jpg` (204KB) referenced by **nothing** | `sakada-web/assets/` | Add a `@media` swap in `css/nav.css` or delete |
| **4** | `assets/images/` is empty | `sakada-web/assets/images/` | Delete |
| **5** | `callback.html` loads a narrower font subset than every other page | `sakada-web/auth/callback.html:10` | Unify to the shared Google Fonts URL |
| **6** | 8 pages lack `<meta name="description">` | `404.html`, `auth/*`, `dashboard/*` | Low priority (all `noindex`) |

**Already fixed — `need to fix.md` is stale on these:** #1 contact form ID ✅, #3 config.js not imported ✅, #5 skip links `id="main"` ✅ (all 4 dashboards), #6 two Mapbox tokens ✅, #8 Features missing from nav ✅, #11 config.js orphan ✅.

### B. Open design items (from `things-to-improve-design.md`, re-verified today)
- **Status pill colors still hardcoded** — `#888`, `#5b9bd5`, `#7ab05c` (+ `#ccc`, `#8ab8e6`, `#a9d18f`) in `css/dashboard.css`. Promote to `--status-*` tokens.
- **Notification panel has no animation** — no `transition` anywhere on `.notif-panel`; it pops via `display` toggle. Use opacity + `translateY(-8px) → 0`.
- **Shadow tokens missing** — spacing/radius tokens landed (11 of them), `--shadow-sm/md/lg` not yet added.

### C. Workflow / tooling
- **ESLint** — `npm run lint` is a stub (`echo 'Add a linter'`). Add ESLint + Prettier.
- **CI/CD** — no GitHub Actions yet (Phase 9 in `things-to-improve.md`): run tests on PR, deploy on push.
- **E2E tests** — deferred from Phase 8. The critical path (signup → create delivery → accept → complete) has no automated coverage; unit tests only cover pure utilities.

### D. Repo hygiene
- `screenshot/{2,3,4,5}.png` are **untracked on purpose** (left out of deploy commits). Decide: commit them as docs, or add `screenshot/` to `.gitignore`.
- `screenshot/CONVERSATION-SUMMARY.md` and this file both exist — consider consolidating.
- Optional security hardening: restrict the Mapbox token to your domain URLs at mapbox.com (it's a public `pk.` token by design, but URL-scoping reduces abuse if the repo is public).

### E. Nice-to-have (Phase 10 backlog)
- PWA / service worker (drivers benefit most — offline access)
- i18n Filipino-Tagalog
- Analytics (Plausible is privacy-friendly, no cookie banner)
- Notification sound/vibration for drivers
- Trust signals, feature-grid icons, empty-state illustrations (see `things-to-improve-design.md` P1)

---

## Gotchas / knowledge for next session

1. **Screenshot verification must be pixel analysis, not eyeballing.** The Read tool returned *mismatched* images at one point this session. Use headless Chrome + PIL: distinct-color counts, text-pixel extents, brightness comparisons. That's how the role-tab fix and the Supabase URL change were both proven.
2. **`localhost` and `127.0.0.1` are different origins** in Supabase's allow list — you need entries for both, or pick one and stick to it.
3. **`mailer_autoconfirm: false`** — every new user must click the email confirmation link before login. Expect this to confuse testers first.
4. **`throw new Error("redirecting")`** in each `*-dashboard.js` after `requireRole()` returns null is *intentional* control flow — it stops module execution. It logs `Uncaught Error: redirecting` to console. Cosmetic only; also means `pageLoader` never hides on the redirect path (harmless, we navigate away).
5. **`config.js` reads `window.__SAKADA_CONFIG__` at module-eval time** — any injected override must run *before* the module graph loads.
6. Verification command set:
   ```bash
   cd sakada-web && npx vitest run                      # 41/41
   curl -s -o /dev/null -w '%{http_code}\n' https://sakada-blue.vercel.app/
   timeout 60 google-chrome --headless=new --no-sandbox --disable-gpu \
     --virtual-time-budget=12000 --dump-dom "$URL" | grep -oE '<title>[^<]*'
   ```
