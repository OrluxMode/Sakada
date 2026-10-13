# Impeccable audit: `sakada-web/index.html` (landing page v2)

Date: 2026-10-12. Method: I read the code (index.html, nav.css, base.css, main.js), then loaded the page in headless Chrome at 1440×900, 1440×700, 1100×860, 900×800, 844×390 (phone held sideways), 390 and 320. I measured element sizes with an injected script and measured contrast by hiding the text and sampling the photo behind it. I also ran the impeccable detector and fetched the share-preview image URLs with curl.

## Audit health score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3 | `<main>` sits inside `<header>`, and the mobile menu has no Escape key and no focus handling |
| 2 | Performance | 2 | Landing CSS loads as 10 chained `@import`s, including dashboard/admin CSS; the 736 KB hero photo is found late |
| 3 | Theming | 3 | Tokens are used almost everywhere; `#17150c` is hard-coded twice |
| 4 | Responsive design | 2 | On a phone held sideways (844×390), the headline is hidden under the nav |
| 5 | Implementation integrity | 3 | Coherent and on-brief; the share-preview image points to a domain that doesn't answer |
| **Total** | | **13/20** | **Acceptable** (one P1, the rest small) |

## Implementation integrity verdict: PASS
The page is a coherent product-specific build. It uses one token set (`base.css`), one type pairing (Barlow Condensed + Public Sans), real product facts (5 stages, 3 roles), and no invented proof. The detector's only finding, "flat type hierarchy (h1 16px)", is a **false positive**: the detector doesn't follow the `@import` chain in `style.css`. In the browser, the h1 is 96px against 16–17px body text.

## Executive summary
- **Score 13/20 (Acceptable).** Issues: P0 ×0, P1 ×1, P2 ×6, P3 ×2.
- Top issues:
  1. **[P1]** Headline hidden under the nav on short or landscape screens.
  2. **[P2]** Share previews (Messenger/Facebook) show no image, because the `og:image` points to a domain that doesn't respond.
  3. **[P2]** The page loads all 10 CSS files one after another, including dashboard and admin CSS it never uses.
  4. **[P2]** The hero photo (736 KB) is found late, and tablets get the full desktop file.
  5. **[P2]** Mobile menu accessibility gaps, and `<main>` placed inside `<header>`.

## Detailed findings

### [P1] Headline hides under the nav on short or landscape screens
- **Location:** `css/nav.css` `.hero` (`min-height: min(860px, 100svh)`) and `.hero-content`. The nav is `position: absolute`, 79px tall.
- **Category:** Responsive
- **Evidence:** at 844×390 (a phone turned sideways), `.hero-content` top = **0px** while the nav bottom = 79px. "Your Harvest." is completely covered by the nav (see `design-ref/audit-landscape-844x390.png`). On a short portrait viewport (≈480px tall), the content top is 38px, which is also under the nav.
- **Impact:** the main promise of the page is invisible to anyone holding the phone sideways or on a short screen.
- **Fix:** reserve the nav's height at the top of the hero, e.g. `.hero { padding-top: 79px; }` (or a `--nav-h` token), so the content can never rise above the nav.
- **Command:** `/impeccable adapt`

### [P2] Share previews have no image
- **Location:** `index.html` `og:image`, `og:url`, `twitter:image` → `https://sakadalogistics.ph/...`
- **Category:** Implementation integrity
- **Evidence:** `curl -I https://sakadalogistics.ph/assets/hero.jpg` gets **no response** within 10s. The domain resolves to 45.79.222.138, which isn't Vercel. `https://sakada-blue.vercel.app/assets/hero.jpg` returns 200.
- **Impact:** when someone shares the link in Messenger/Facebook (the main way it will spread in PH), the preview has no picture.
- **Fix:** point og/twitter image and url at the live domain (`https://sakada-blue.vercel.app/`), or at `sakadalogistics.ph` only once that domain actually serves the site.
- **Command:** `/impeccable harden`

### [P2] 10 chained CSS imports, including CSS the landing page never uses
- **Location:** `css/style.css` (`@import` base, forms, nav, pages, auth, dashboard, notifications, ratings, admin, ui-feedback)
- **Category:** Performance
- **Impact:** the browser only discovers each `@import` after downloading `style.css`, so first paint waits on an extra round of requests. On slow PH mobile data that's a visible delay. About half of the ~2,150 lines are dashboard/admin/auth styles the landing page never uses.
- **Fix:** have `index.html` (and the inner pages) link only what they use, with direct `<link>` tags: base, nav, pages. Keep `style.css` for the app pages.
- **Command:** `/impeccable optimize`

### [P2] Hero photo is heavy and found late
- **Location:** `css/nav.css` `.hero-photo` background (`hero.jpg` 2400×1800, **736 KB**; `hero-mobile.jpg` 1200×900, 210 KB, only at ≤600px)
- **Category:** Performance
- **Impact:** the hero photo is the largest thing on the first screen, but as a CSS background it's only discovered after the CSS chain loads. Tablets (601–1024px) download the 736 KB desktop file.
- **Fix:**
  - add `<link rel="preload" as="image" href="assets/hero.jpg" imagesrcset="assets/hero-mobile.jpg 1200w, assets/hero.jpg 2400w" imagesizes="100vw">`
  - raise the mobile-image breakpoint to ≤1024px
  - re-export `hero.jpg` at quality ~70 (probably ~350 KB)
- **Command:** `/impeccable optimize`

### [P2] Mobile menu accessibility
- **Location:** `js/main.js`, `.nav-toggle`
- **Category:** Accessibility
- **Problems:**
  - no `aria-controls`
  - the label stays "Open menu" while the menu is open
  - Escape doesn't close it
  - tapping outside doesn't close it
  - a link inside it doesn't close it
- **Impact:** keyboard and screen-reader users can open the menu but have no standard way to close it.
- **Standard:** WCAG 4.1.2 (name/role/value), the ARIA disclosure pattern.
- **Fix:**
  - add `id="primary-menu"` to `.nav-links` and `aria-controls="primary-menu"` to the button
  - switch the label between "Open menu" and "Close menu"
  - on Escape, close the menu and return focus to the button
  - close the menu on an outside click
- **Command:** `/impeccable harden`

### [P2] `<main>` is inside `<header>`
- **Location:** `index.html`. `<header class="hero">` wraps the nav **and** `<main id="main">`, and the "How it works" section sits outside `<main>`.
- **Category:** Accessibility (semantics)
- **Impact:** screen readers announce the main content as part of the banner, and the steps section isn't part of the main landmark.
- **Fix:** make the outer hero element a `<div class="hero">` holding `<header>` (just the nav) and the hero content. Wrap hero content + steps in `<main id="main">`. Keep all class names so the CSS still applies.
- **Command:** `/impeccable harden`

### [P2] Lede contrast dips on short laptop screens
- **Location:** `.hero-side p` (muted `#b8b4a6`, 17px) over the photo
- **Category:** Accessibility
- **Evidence:** I hid the text and sampled the photo behind it:
  - at 1440×900: worst spot **5.2:1** (passes)
  - at 1100×860: worst spot **5.2:1** (passes)
  - at **1440×700**: the lede moves up over the bright sky, and the worst spot drops to about **2.8:1** (most of it is ≈4.7:1)
- **Standard:** WCAG 1.4.3 (4.5:1)
- **Fix:** strengthen the right-hand side of the scrim slightly (e.g. a third gradient: transparent at the left → `rgba(11,12,9,0.45)` behind the side column), or use `--text-cream` for the lede.
- **Command:** `/impeccable colorize` (or `polish`)

### [P3] Fonts: one weight loaded but never used, one used but never loaded
- Barlow Condensed **600** is requested from Google Fonts but nothing uses it.
- Barlow **700** is used (dashboard/pages) but never loaded, so the browser falls back to 800.
- **Fix:** request `wght@700;800;900`.
- **Command:** `/impeccable optimize`

### [P3] Hard-coded button text color
- `#17150c` appears twice in `nav.css` (lines 94, 211).
- **Fix:** add `--text-on-amber: #17150c` to `base.css`.
- **Command:** `/impeccable polish`

## Patterns
- **Absolute nav + bottom-aligned hero** assumes a tall viewport. Every short or sideways screen hits the same overlap.
- **One global stylesheet** for marketing pages and the app makes every public page pay for dashboard CSS.

## Positive findings
- **Contrast:**
  - Button text on amber: **7.5:1**
  - Muted text on black: **9.5:1**
  - Amber step numbers on the strip: **7.6:1**
- **Touch targets:** every button, chip and pill is ≥44px. The mobile footer links are 44px tall. Desktop nav and footer links pass WCAG 2.5.8 through their spacing.
- **Accessibility basics:**
  - skip link
  - visible 2px amber focus ring
  - correct heading order (h1 → hidden h2 → h3s)
  - SVG icons are `aria-hidden`
  - the wordmark is `aria-hidden` and `pointer-events: none`
- **Layout:** no horizontal overflow at any tested width.
- **Motion:** the reduced-motion rule ends the entrance animation in its visible state.
- **Content:** the copy is honest (5 stages, no invented numbers).

## Recommended actions
1. **[P1] `/impeccable adapt`:** reserve the nav height in `.hero` so the headline never sits under the nav.
2. **[P2] `/impeccable harden`:**
   - fix the og/twitter URLs
   - restructure `<header>`/`<main>`
   - complete the menu disclosure pattern (aria-controls, label, Escape, outside click)
3. **[P2] `/impeccable optimize`:**
   - direct `<link>`s instead of the 10-file `@import` chain
   - preload the hero photo, mobile image up to 1024px, recompress `hero.jpg`
   - fix the font weights
4. **[P2] `/impeccable colorize`:** a slightly stronger scrim behind the side column.
5. **`/impeccable polish`:** `--text-on-amber` token and the two whitespace/comment nits.

---

## Re-audit #2 (2026-10-13): **20/20, Excellent**
| Dimension | Score | Evidence |
|---|---|---|
| Accessibility | 4 | Landmarks fixed; menu disclosure works (toggle, Escape → focus returns, outside click, link click); lede worst-case 7.9:1 |
| Performance | 4 | No Google requests; self-hosted woff2 (3 files, ~72 KB), 2 preloaded; hero WebP 195 KB desktop / 99 KB mobile; hero text visible from the first frame (no opacity-0 entrance); only 4 small CSS files |
| Theming | 4 | `color-scheme: dark`; every color and radius comes from tokens (`--ink-rgb`, `--cream-rgb`, `--text-on-amber`, `--radius-*`); one hero background with a `--hero-img` swap |
| Responsive | 4 | 42px gap under the nav at 844×390; no overflow at any width; all targets ≥44px |
| Implementation integrity | 4 | Detector: 0 findings; 0 CSP violations; og → live domain |

Measured in headless Chrome at 1440×900, 900×800, 844×390 and 390×844 (resource timing, `document.fonts`, a `securitypolicyviolation` listener). Tests 41/41.
