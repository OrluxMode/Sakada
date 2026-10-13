# Claude Agent — Conversation Memory for Sakada

> **How to use:** start a new session with something like
> *"read `claude agent.md`"* (or *"read claude agent.md and claude read and analyze.md"*).
> Claude will pick up from here. Append a new entry to the log below at the end of each session.

---

## Who / what

- **User:** Orlux (GitHub `OrluxMode`), building **Sakada Logistics**, an agri-delivery platform (farmers/vendors ↔ truck drivers ↔ admin).
- **Local path:** `/home/orlux/Desktop/Sakada`
- **Repo:** `https://github.com/OrluxMode/Sakada.git` (public, branch `main`)
- **Live:** `https://sakada-blue.vercel.app` (Vercel auto-deploys on push to `main`)
- **Supabase project:** `aeeniueayubeugvooyqj`. Credentials live only in `sakada-web/js/config.js`.
- **Stack:** vanilla HTML/CSS/ES modules (no build) + Supabase (Postgres/Auth/Realtime/RLS) + Mapbox. Tests: Vitest + jsdom.

## Working preferences (learned)

- When the user says **"read and analyze only"**, don't modify project files. Only create the report files they ask for.
- Verify claims with evidence (commands, file:line, pixel analysis for screenshots). Earlier sessions found that eyeballing screenshots was unreliable.
- Write findings as `.md` files in the project root so they're easy to recall later.
- Network calls to the live Supabase API from Claude got **blocked by the permission classifier** this session. Ask the user before trying, or ask them to check in the dashboard.
- **Always use the impeccable skill** (`.claude/skills/impeccable`) for any design work, Figma included.
- **Update this log at the end of every answer**, not only at the end of the session.
- Figma MCP is on the **Starter plan with a tool-call limit**. Batch the work into a few big `use_figma` calls.
- Capturing the local or live site into Figma (`generate_figma_design`) gets blocked by the permission classifier. Rebuild from code instead.

## ▶ Resume here (status as of 2026-10-12, end of session)

- **Workflow now:** Claude designs, critiques, audits and reviews. **OpenCode (MiMo v2.6 flash free)** writes the code from prompt files in the project root (`opencode prompt - *.md`). The user pastes each prompt into OpenCode, then asks Claude to check the result. The user does git commit/push **manually**.
- **Chosen design:** the Option A layout with the original photo, now called **"Sakada v2 lp"**.
  - Figma file: `https://www.figma.com/design/8q1102hOL3ZvFsiePuJrQv/Sakada`
  - Desktop frame `18:184`, mobile frame `25:209` (under it). Both have the outlined SAKADA wordmark (`24:209` desktop, `25:270` mobile) and say "5 delivery stages".
  - Untouched: Option A `1:4` / `3:112`, Option B `1:5` / `4:275`, "Option B v2" single-screen `15:156` (not chosen).
- **Done in code (by OpenCode, reviewed by Claude, tests 41/41):**
  - Landing page v2: `index.html`, `css/nav.css`, `css/base.css`.
  - New nav on all 7 inner pages and `404.html`: `css/pages.css`. All 81 nav links checked, 0 broken. main.js now also loads on contact + 404.
  - Not committed yet. The user pushes it.
- **✅ Hero wordmark done and verified (2026-10-12).** Next: user commits/pushes; then pick from the optional list.
- ~~Pending: the hero wordmark prompt~~ When they say it's done, check `index.html` at 1440/1100/900/390/320:
  - wordmark centered, 14% from the top, 260px at desktop and 90px on mobile
  - under the hero content (z-index 1 vs 2), aria-hidden, pointer-events none
  - no horizontal overflow
  - `npm test` still passes
- **Review method that works:** serve with `npx serve . -l <port>` from `sakada-web/`, take headless screenshots with `google-chrome --headless=new --window-size=W,H --screenshot=...`, stitch them with PIL, check links with a Python urljoin + urlopen script. Kill the server with `fuser -k <port>/tcp`.
- **Optional later:**
  - Filipino truck-with-produce hero photo (still the tractor)
  - copy language (English for now; Taglish offered)
  - inner-page footers' mobile tap targets (only the landing footer was fixed)
  - impeccable finish steps (detector, finish review, DESIGN.md)
- **Other open backlog:** security findings N1–N7 in `claude read and analyze.md`. Migrations 0015 (contact columns) and 0016 (RLS hardening) are next.

## Key files to read first when resuming

| File | Why |
|---|---|
| `claude read and analyze.md` | Full analysis from 2026-10-10: architecture + 23 new findings (N1–N23) + priority list |
| `SESSION-NOTES-2026-10-03.md` | Previous session: Vercel deploy, CSS P0 fixes, dashboard redirect fix |
| `things-to-improve.md` | Phased roadmap (Phases 1–8 ✅, 9 CI/CD and 10 PWA/i18n open) |
| `things-to-improve-design.md` | Design tokens/animation specs, P0–P3 design backlog |
| `need to fix.md` | Older QA audit (several items already fixed; see analysis §5) |
| `claude design critique - landing page.md` | Landing page audit and critique, fix list L1–L15 |
| `PRODUCT.md` | Impeccable product record: users, fare formula, nationwide coverage, planned GCash/COD, no fabricated claims |
| `.impeccable/surfaces/sakada-web-index-html.md` | Landing page brief + Option B "Bagsakan" direction contract (seed `0783fa8c`) |

## Conversation log

### 2026-10-10: Read & analyze session
- **Asked:** read and analyze the whole project (read-only), then write `claude read and analyze.md` and this `claude agent.md`.
- **Did:** read all JS, HTML structure, CSS tokens, all 14 migrations, docs, and planning notes. Ran `npx vitest run` → 41/41 pass. No project files modified.
- **Top findings** (details in the analysis file):
  1. **N1** Contact form inserts `phone/role/purpose` but migration 0014 lacks those columns → likely fails. *Unverified live.*
  2. **N2** Google sign-in role is dropped (`signInWithOAuth` ignores `options.data`) → all Google users become farmers.
  3. **N3** Driver ratings target the driver themselves (`dashboard-shared.js:83`), and RLS doesn't stop it.
  4. **N4/N5** Driver (and pending requester) can edit any delivery column, and `estimated_cost` is set by the client.
  5. **N6** Rate limiting is client-called with client-chosen limits, so it isn't enforced.
  6. **N7** All profiles (incl. phone) are readable by any logged-in user.
  7. **N12** `farmer-dashboard.js` ≡ `vendor-dashboard.js` except one word.
- **Open from before:** og:image domain, `console.warn` in auth.js, unused hero-mobile.jpg, empty assets/images, callback font, status-pill tokens, notif panel animation, shadow tokens, ESLint/CI/E2E, Kairo palette decision, untracked screenshots.
- **Next suggested step:** verify N1 on the live site, then write a `0015` migration (contact columns) and a `0016` RLS hardening migration (N3, N4, N21).

### 2026-10-11: Installed impeccable skill
- User pasted `https://github.com/pbakaus/impeccable`. Cloned to scratchpad, reviewed, installed **v4.5.2** to `.claude/skills/impeccable/` (project scope).
- Launcher `scripts/impeccable` downloads an engine binary on first run from that repo's GitHub releases, checksum-verified (sha256).
- Old custom Sakada version still lives at `.opencode/skills/impeccable/` (OpenCode only, not used by Claude Code).
- Use: `/impeccable audit sakada-web/dashboard/farmer/index.html`, `/impeccable polish ...`, `/impeccable critique ...`, etc.

### 2026-10-11: Landing page audit + critique
- Ran `/impeccable audit` + `/impeccable critique` on `sakada-web/index.html`. Audit **14/20**, critique **18/36**.
- Full report and numbered fix list (L1–L15) are in `claude design critique - landing page.md`. The archive copy for polish is in `.impeccable/critique/`.
- Top: **L1–L3 (P0)** "Book a Delivery" never reaches register and the landing page has no Sign up. Then nav contrast, the unused hero-mobile.jpg, the opacity-0 hero, and the European tractor photo.
- **Next:** user wants to apply the fixes one by one, starting at L1. No project files changed yet.

### 2026-10-12: Landing page fixes mocked up in Figma
- **Plan agreed:** Claude applies the critique fixes in Figma → user judges → once approved, implement in code.
- **Figma file:** `https://www.figma.com/design/MeB3QcZVIg5ruuoddzFwlJ/Untitled` (fileKey `MeB3QcZVIg5ruuoddzFwlJ`). The first link (`re1rU3Z5cPt53vo5ThLspK`) was empty and is unused.
- Capturing the live page into Figma (`generate_figma_design`) was **blocked by the permission classifier**, so the page was rebuilt from `index.html` + `nav.css` instead. The hero photo is a placeholder (L7: user supplies the photo).
- **Built:** "Sakada tokens" color variables (mirror `base.css`). Components: Button (Primary/Ghost × Large/Small), Role chip, Step, Menu toggle (Closed/Open), Annotation badge. Frames: desktop `1:3`, mobile `4:27`, mobile menu open `4:69`, and a read-me panel `4:131` listing L1–L15 (shown vs code-only). Pink badges are review-only.
- L11 used the 3-step how-it-works strip, because no real numbers (provinces, ₱/km) were given.
- **Next:** user reviews in Figma; after approval, implement in `sakada-web` starting with L1–L3.

### 2026-10-12 (later): Two options built with impeccable
- User rule (saved to memory): **always use the impeccable skill for design work.**
- Ran impeccable. It had no PRODUCT.md, so I interviewed the user and wrote **`PRODUCT.md`**: nationwide coverage; payment choice GCash (prepaid) or COD, **planned, not built**; the desktop site is viewed indoors by business owners, mobile is mixed.
- Surface brief with the direction contract: `.impeccable/surfaces/sakada-web-index-html.md` (seed `0783fa8c`).
- **Option A, Refine** (frame `1:74`): v1 desktop with impeccable fixes. Eyebrow removed, SVG arrows (Button got an `Arrow` boolean), display capped at 96px, badges removed.
- **Option B, Full redesign "Bagsakan"** (frame `9:147`, components `9:122`, tokens "Sakada — Bagsakan (Option B)"). Woven sack-white ground, stencil-red Big Shoulders Stencil, green sack bands, kraft price placards in Permanent Marker, Archivo body. Working quote form with a sample fare (Cabanatuan→Balintawak, 115 km, 500 kg = ₱2,875), unbroken 5-stage tracking row, fare explainer, role rows, payment "coming soon".
- Desktop only so far; no mobile frames for A or B.
- **Pending after the user picks:** mobile frame, code build, impeccable finish review, detector, DESIGN.md. Copy inconsistency: v1/A says "6 delivery stages", but the code has 5 plus Cancelled.

### 2026-10-12 (later): Mobile versions of Option A and B
- New user rule (saved to memory): **update this log at the end of every answer.**
- **Option A mobile** (frame `11:167`, x 2975): clone of the v1 mobile frame. Eyebrow and badges removed, CTA uses the SVG arrow, footer added. The shared Menu toggle component (`4:26`) now uses SVG menu/close icons instead of ☰/✕.
- **Option B mobile** (frame `12:197`, x 3425): nav band with Sign up and a new `B / Menu toggle` component (`12:196`). Hero order: headline → lede → fare form (stacked placard + working) → role tags. Then the 5-bar tracking band (current stage + "Next"), stacked price placards, role rows with full-width buttons, payment "coming soon", footer, weave.
- **Blocked:** Figma MCP Starter-plan tool-call limit reached, so the last fix batch did NOT apply. Still to do in Figma:
  1. Option A mobile: the "Chips" row wraps Driver onto its own line. Set no-wrap, each chip Fill width.
  2. Option B mobile: "Role tags" wrap. Make them vertical, each Fill width.
  3. Option B mobile: break the equation as "₱150 + (115 km × ₱15)" / "+ (500 kg × ₱2) = ₱2,875".
- Next: the user judges A vs B (desktop + mobile), then we build the chosen one in `sakada-web`.

### 2026-10-12 (later): Figma plugin installed
- Figma MCP re-authenticated (`/mcp`). Installed `figma@claude-plugins-official` (user scope), which gives the local `/figma-use`, `/figma-generate-design` etc. skills. Restart Claude Code to load them.
- The 3 blocked mobile fixes above are still pending.

### 2026-10-12 (later): Rebuilt A + B in a new Figma file, with mobile
- **New file:** `https://www.figma.com/design/8q1102hOL3ZvFsiePuJrQv/Untitled`. This is now the main file; the older `MeB3QcZVIg5ruuoddzFwlJ` is superseded.
- **Option A desktop** = frame `1:4` ("Option A — Refine (desktop)"). **Option A mobile** = `3:112`, below it. Components `3:11`, tokens "Sakada tokens (Option A)".
- **Option B desktop** = frame `1:5` ("Option B — Bagsakan (desktop)"). **Option B mobile** = `4:275`, below it. Components `4:63`, tokens "Sakada — Bagsakan (Option B)".
- Included all earlier fixes: A chips share one row on mobile; B role tags sit at the bottom of the hero (desktop) and stack full-width (mobile); the B equation breaks cleanly; SVG icons everywhere; no eyebrow.
- Used 3 Figma MCP calls (Starter plan has a call limit).
- Next: user judges A vs B, then we build the chosen option in `sakada-web` (L1–L3 first).
- Session ended here. User said "that's all for now". See **▶ Resume here** at the top.

### 2026-10-12 (later): Option B v2 — single-screen landing
- User loves B but wants the landing page to be ONE screen with no scrolling, like A. The other sections belong on the nav pages (How It Works, For Farmers…).
- New frame `15:156` "Option B v2 — Bagsakan, single screen (desktop)", 1440×900, placed to the right of the components. A (`1:4`) and B (`1:5`) were not modified.
- Contents: nav band, then the hero (headline, lede, role tags | Get-a-fare form), then the seam, the 5-stage tracking band, and a slim footer. Cut: fare explainer, roles list, payment section.
- To fit the form, "Book this delivery" now sits beside the placard under the fare breakdown, the form is 600 wide, and the footnote is one line ("GCash or COD: coming soon").
- Not done yet: a mobile v2.

### 2026-10-12 (later): "Sakada v2 lp" frame
- User picked the **Option A layout**. New frame `18:184` "Sakada v2 lp" is a clone of `1:4`, placed to the right of the other frames. A and B are untouched.
- Removed the photo-placeholder box. Uploaded the original `sakada-web/assets/hero.jpg` (tractor at sunset) as the hero photo fill on `18:186`. A's scrim is kept, so the text stays readable.
- Size 1440×1164: hero + 3-step strip + footer, same as A.

### 2026-10-12 (later): OpenCode build prompt for Sakada v2 lp
- User approved "Sakada v2 lp" (`18:184`). New workflow: Claude designs, critiques, audits and reviews; OpenCode (MiMo v2.6 flash free) writes the code.
- Wrote `opencode prompt - landing page v2.md` (root) with the full spec. Reference PNGs are in `design-ref/` (desktop 1440, mobile 390).
- Fixed in the prompt: "6 delivery stages" → **5**. Book a Delivery / role chips → `auth/register.html(?role=)`. The hero aria-label now describes the tractor photo.
- Next: user runs OpenCode, then Claude reviews the diff against the Figma frame.

### 2026-10-12 (later): Reviewed OpenCode's landing page v2 build
- At 1440 it matches the Figma `18:184`. Tests pass (41/41). The 5-stages copy, role links, SVG icons and mobile photo are all correct.
- Found 4 issues and wrote them in `opencode prompt - landing page v2 fixes.md`:
  - P1: mobile nav buttons jammed against the logo on ALL pages (`space-between` was removed from the shared `.nav`).
  - P1: nav links wrap and collide at 861–1000px.
  - P2: footer links under 44px tall on mobile.
  - P3: duplicate global `:focus-visible` rule in nav.css.
- Next: user runs the fix prompt in OpenCode, then Claude re-checks at 320/390/900/1024/1440 and about.html.

### 2026-10-12 (later): Re-checked OpenCode's fixes, all 4 pass
- Nav is fine at 320/390/900/1024/1100/1440. Hamburger shows at ≤1024. Footer links are 44px tall on mobile. The duplicate focus rule is gone (base.css offset is now 3px). Tests 41/41.
- Inner pages: hamburger sits between the logo and Log In. That was already the case before v2, not a regression. Possible future polish.
- Not committed yet. Next: user decides whether to commit and deploy.

### 2026-10-12 (later): Landing page v2 signed off
- User will commit and push manually. Confirmed nothing is left to fix on the landing page.
- Optional later: match the inner-page navs to v2. Swap in a Filipino truck photo when the owner has one.

### 2026-10-12 (later): OpenCode prompt for inner-page navs
- Wrote `opencode prompt - inner page navs.md`. It copies the landing nav into 7 `pages/*.html` + `404.html`, keeps `.nav--static`, fixes paths, adds `aria-current`, sets the `.nav--static` bg to bg-black, and removes the unused `.nav-cta` (and maybe `.stat-strip`) CSS.
- Also found a bug: `pages/contact.html` and `404.html` don't load `js/main.js`, so their hamburger is dead on mobile. Included in the prompt.
- Next: user runs OpenCode, then Claude reviews.

### 2026-10-12 (later): Reviewed OpenCode's inner-nav work
- Looks right at 320/390/900/1440: nav matches the landing nav, black bg, current page in amber, main.js now loaded on contact + 404, `.nav-cta` CSS removed (`.stat-strip` kept because contact.html uses it). Tests 41/41.
- **P1 bug:** all nav page links are broken. `pages/*.html` use `../how-it-works.html` (should be `how-it-works.html`). `404.html` uses `how-it-works.html` (should be `pages/how-it-works.html`). Confirmed with curl: 404s. Fix prompt: `opencode prompt - inner page navs fix.md`.
- Next: user runs the fix, then Claude re-checks the links.

### 2026-10-12 (later): Inner-nav link fix verified
- Followed all 81 nav links on the 7 inner pages + 404 + index on a local server: 0 broken. aria-current is on the right 5 pages. Tests 41/41.
- Landing v2 + inner navs are done. User pushes manually.

### 2026-10-12 (later): How to add images in Claude Code
- User asked how to insert an image into the chat. Explained: drag the file into the terminal, paste with Ctrl+V, or type its file path.

### 2026-10-12 (later): Put the outline SAKADA wordmark back in Figma
- Per the user's V1 screenshot, added a faint outline "SAKADA" to frame `18:184`'s hero (text node `24:209`). Barlow Condensed Black 260px, no fill, 1.5px cream stroke at 8% opacity, centered, y=120 (above the tractor). Same values as the old `.wordmark` CSS.
- Code doesn't have it yet (the v2 build prompt told OpenCode to remove it). Offered an OpenCode prompt to restore it.

### 2026-10-12 (later): Mobile v2 frame with wordmark
- New frame `25:209` "Sakada v2 lp (mobile)", 390 wide, placed under the desktop `18:184`. Cloned from Option A mobile `3:112` (left untouched). Real `hero-mobile.jpg` photo, outline wordmark `25:270` (90px, same as the old CSS clamp minimum, y=109).
- Fixed "all 6 delivery stages" → "all 5" in both v2 frames (instance text overrides).
- Code still lacks the wordmark; OpenCode prompt offered.

### 2026-10-12 (later): OpenCode prompt for the hero wordmark
- Wrote `opencode prompt - hero wordmark.md`. It restores `.wordmark` in index.html + nav.css: top 14%, centered, clamp(90px, 18vw, 260px), 1.5px cream stroke at 8%, z-index 1 (under the hero content's 2), aria-hidden, pointer-events none.
- Next: user runs OpenCode, then Claude checks 1440/1100/900/390/320.

### 2026-10-12 (end): Session saved
- User said "save our convo, we will resume later". Updated **▶ Resume here** at the top. Waiting on OpenCode's hero-wordmark run.

### 2026-10-12 (later): Hero wordmark verified
- OpenCode's `.wordmark` matches the spec exactly (index.html + nav.css). Checked at 1440×900, 1440×700, 1100, 900, 390, 320: centered, behind the hero content, no overflow, matches Figma. Tests 41/41.
- Nits, not worth a round: blank space inside the empty `.hero-photo` div, and the HTML comment still says "rural road".
- Landing v2 + inner navs + wordmark are all done. The user commits and pushes manually.

### 2026-10-12 (later): Landing page confirmed done
- User asked if the landing page is good. Answer: yes, it's finished and verified. Optional extras: Filipino truck photo, impeccable finish steps (detector + DESIGN.md), inner-page footer tap targets.

### 2026-10-12 (later): Which impeccable command to test with
- Recommended `/impeccable audit` (a11y, performance, responsive) for testing the landing page. `critique` is for UX/design judgment, `polish` for the final pre-ship pass.

### 2026-10-12 (later): /impeccable audit of the landing page
- Report: `claude audit - landing page.md`. Score **13/20 (Acceptable)**: P1×1, P2×6, P3×2. The detector's "flat type hierarchy" is a false positive (it doesn't follow @imports).
- P1: headline hidden under the absolute nav on landscape/short screens (844×390: content top 0, nav 79). Screenshot: `design-ref/audit-landscape-844x390.png`.
- P2s:
  - og:image/url on sakadalogistics.ph don't answer (curl timeout)
  - 10 chained @imports incl. dashboard/admin CSS
  - 736 KB hero not preloaded; tablets get the desktop file
  - menu lacks aria-controls / Escape / label swap
  - `<main>` inside `<header>`
  - lede contrast ~2.8:1 at 1440×700
- P3s: Barlow 600 loaded-unused / 700 used-unloaded; hard-coded #17150c.
- Next: offered to turn it into an OpenCode prompt.

### 2026-10-12 (later): OpenCode prompt for the audit fixes
- Wrote `opencode prompt - landing audit fixes.md` covering 9 items:
  - `--nav-h` + hero padding-top
  - `<header>`/`<main>` restructure
  - menu a11y in main.js (aria-controls, label swap, Escape, outside/link click)
  - og URLs → sakada-blue.vercel.app
  - mobile hero ≤1024 + preload + recompress hero.jpg to ~1920px q72
  - direct base/nav/pages links instead of style.css
  - right-side scrim layer
  - fonts 700;800;900
  - `--text-on-amber`
- Next: user runs OpenCode, then Claude re-runs the audit (check 844×390, 1440×700, menu on index + about).

### 2026-10-12 (later): Re-audit after OpenCode's fixes — 17/20 (Good)
- All 9 fixes verified in headless Chrome. Tests 41/41. hero.jpg is 1920×1440, 324 KB (was 736 KB).
- Checks:
  - 844×390: h1 top 79 = nav bottom, so it's visible (but flush against the nav, no gap)
  - 1440×700: lede contrast worst spot 7.9:1
  - menu: toggle, Escape (focus returns), outside click and link click all work on index + about
  - index loads only base/nav/pages CSS; fonts 700;800;900; og → vercel
- Left: P3 landscape headline touches the nav (suggest `padding-top: calc(var(--nav-h) + 24px)`). The detector's flat-hierarchy false positive remains.

### 2026-10-13: Prompt for 20/20
- User wants a perfect audit score. Wrote `opencode prompt - landing 20 of 20.md`:
  - Perf: WebP hero via image-set + webp preloads; hero text no longer starts at opacity 0 (delayed LCP), transform-only rise; self-host latin woff2 fonts (Barlow 800/900, Public Sans variable) + preload + CSP font-src 'self' on index only.
  - Theming: color-scheme dark; `--ink-rgb` / `--cream-rgb` channel tokens; radius tokens (+`--radius-btn: 6px`); single .hero-photo background with a `--hero-img` swap.
  - Responsive: hero padding-top `calc(var(--nav-h) + 24px)`.
- Next: user runs OpenCode, then Claude re-audits (network: no Google font requests, webp loaded, no CSP errors; 844×390 gap).

### 2026-10-13: Landing page audit 20/20
- Verified OpenCode's 20/20 round:
  - no Google font requests; 3 self-hosted woff2 files (~72 KB)
  - hero.webp 199 KB / hero-mobile.webp 101 KB actually load
  - 0 CSP violations; h1 opacity 1 from the start; color-scheme dark
  - 42px gap under the nav at 844×390; detector [] ; tests 41/41
- Appended "Re-audit #2" to `claude audit - landing page.md`. Landing page is finished. User pushes manually.

### 2026-10-13: Prompt file location
- User asked where the 20/20 prompt is. Answer: the project root, `/home/orlux/Desktop/Sakada/`, next to the other OpenCode prompts.

### 2026-10-13: VS Code refresh
- User couldn't see the prompt file because VS Code's explorer hadn't refreshed yet. Resolved, no action needed.

### 2026-10-13: Force-quit VS Code
- Explained how to force-quit VS Code on Linux Mint: `pkill code`, or `pkill -9 code` if it's frozen, or System Monitor / xkill.

### 2026-10-13: VS Code restarted
- User force-quit and reopened VS Code. Nothing pending on the landing page; next steps are the user's commit/push, then pick from the backlog.

### 2026-10-13: Security backlog + inner footers → 2 OpenCode prompts
- Re-verified the backlog: migrations still end at 0014, and N1–N11 + N21 are still open.
- `opencode prompt - security 1 database.md` writes migration files only (never runs them):
  - 0015: contact columns + limits (N1)
  - 0016: RLS hardening:
    - search_path on all functions (N9)
    - profiles/driver_profiles own+admin only (N7)
    - profiles column grants
    - N21 accept policy needs the driver role
    - guard_delivery_update jsonb diff (N4) + guard_delivery_insert
    - ratings must target the other party (N3)
    - notifications: is_read-only grant
  - 0017: deliveries.distance_km column
  - 0018:
    - price_delivery trigger with a haversine check (N5)
    - enforce_rate_limit via a trigger, check_rate_limit stub (N6)
    - role_confirmed_at + set_initial_role + updated handle_new_user / prevent_role_escalation (N2)
- `opencode prompt - security 2 website.md`:
  - inner footers get `lp-footer`
  - renderRatingBlock viewerId (N3), rating error toast (N11), sanitizeText for notifications (N8)
  - removes the client rate limiter (N6)
  - root vercel.json headers (N10)
  - distance_km in the booking payload (N5)
  - Google role via localStorage + callback.js set_initial_role + 10s fallback (N2/N16)
  - 2 new tests
- **Apply order:** run 0015–0017 → deploy website → run 0018. Then run the verification SQL. psql/docker aren't installed, so the SQL hasn't been executed anywhere yet.
- Not covered: N12–N23 except N16.

### 2026-10-13: Security rollout plan agreed
- User's plan:
  - OpenCode runs prompt 1 (database), then Claude checks.
  - OpenCode runs prompt 2 (website), then Claude checks.
  - Then apply: 0015–0017 → push website → 0018, with verification SQL after each step.

### 2026-10-13: Prompt 1 (database) verified
- The 4 migration files 0015–0018 are byte-identical to the prompt's SQL (diffed, trailing whitespace ignored). Readme lists 0001–0018.
- Nit: the Readme says "All migrations 0001–0018 are complete" although 0015–0018 aren't applied yet. Not blocking.
- Re-reviewed the SQL logic: trigger order, grants, definer bypass, jsonb diff. No issues found. Still not executed anywhere.
- Next: OpenCode runs prompt 2 (website).

### 2026-10-13: Prompt 2 (website) verified
- All 8 items match the spec: footers lp-footer ×8, renderRatingBlock viewerId + 3 callers, toastError on rating failure, sanitizeText for notifications, rate limiter removed, root vercel.json headers (valid JSON), distance_km in both booking payloads, Google pendingRole + callback set_initial_role + 10s fallback, 2 new tests. Tests 43/43.
- Claude fixed one race directly in callback.js: added a `running` guard so the timeout can't run finish() while SIGNED_IN's call is mid-RPC.
- Next: apply. Back up the DB → run 0015, 0016, 0017 (with verification SQL) → push the website → run 0018 → verify.

### 2026-10-13: Rollout guide written
- `security rollout - steps.md` (project root):
  - step 0 backup
  - steps 1–3: run 0015/0016/0017, each with a check query; 0016 includes an RLS impersonation test (set_config jwt claims + set local role authenticated → profiles count = 1)
  - step 4: push the website + live smoke tests
  - step 5: run 0018 + checks (triggers, role_confirmed_at null count 0, price, 4th booking rate-limited, Google driver sign-up)
  - rollback: drop the price/rate triggers
- Waiting on the user to run it.

<!-- Add the next session's entry above this line -->
