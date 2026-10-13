# Sakada Landing Page: Audit + Critique

**Date:** 2026-10-11 · **Target:** `sakada-web/index.html` · **Tool:** `/impeccable audit` + `/impeccable critique` (dual-agent)
**Scores:** Audit **14/20 (Good)** · UX critique **18/36 (50%, Acceptable)**. Heuristic 7 is n/a, so the maximum is 36.
**Archive copy of the critique:** `.impeccable/critique/2026-10-11T11-11-54Z__sakada-web-index-html.md` (`/impeccable polish` reads this)

---

## Fix list (apply one by one)

Tick each item when it's done. The order is: most important first, then cheapest wins.

| # | Pri | Fix | Where | Command |
|---|---|---|---|---|
| L1 | P0 | Make "Book a Delivery" go to `auth/register.html` (with a role param) instead of how-it-works | `index.html:78` | `/impeccable clarify` |
| L2 | P0 | Add a **Sign up** link next to "Log In" in the nav | `index.html:53`, `nav.css:45-64` | `/impeccable clarify` |
| L3 | P0 | Fix the CTA chain on the sub-pages: how-it-works goes to for-farmers, which goes to login; "Register as a Driver" goes to **login** | `pages/how-it-works.html:157`, `pages/for-farmers.html:136`, `pages/for-drivers.html:135` | `/impeccable harden` |
| L4 | P1 | Nav links fail contrast (2.5–3.7:1 over the bright sky). Use cream text, or add a dark band behind the nav | `css/nav.css:34-38` | `/impeccable polish` |
| L5 | P1 | Phones download the 736 KB `hero.jpg`. Swap to the unused `hero-mobile.jpg` (210 KB) on small screens | `css/nav.css:103` | `/impeccable optimize` |
| L6 | P1 | The hero headline, text and CTA start at `opacity: 0` and depend on the animation. Make them visible by default and animate only when a class is added | `css/nav.css:133-135` | `/impeccable harden` |
| L7 | P1 | Replace the hero photo. It currently shows a European tractor with wind turbines. Use a Filipino truck with produce, and make the aria-label match the photo (it currently says "truck on a rural road") | `assets/hero.jpg`, `index.html:63` | `/impeccable bolder` (**you supply the photo**) |
| L8 | P1 | Add role entry points in the hero: "I'm a farmer / vendor / driver", each linking to register with the role filled in | `index.html` hero | `/impeccable layout` |
| L9 | P2 | `<main>` sits inside `<header>`. Restructure the landmarks so the stat strip is inside main | `index.html:36-106` | `/impeccable harden` |
| L10 | P2 | Mobile menu: add Esc and outside-tap close, switch ☰ to ✕, toggle the aria-label to "Close menu" | `js/main.js` | `/impeccable harden` |
| L11 | P2 | Replace the filler stats ("3 roles", "1 booking") with real proof (provinces, ₱/km, GCash/COD, verified drivers) or a 3-step how-it-works strip | `index.html:84-105` | `/impeccable clarify` |
| L12 | P2 | The landing page loads all 10 CSS files through serial `@import`, including dashboard, admin and auth. Load only what the page needs | `css/style.css` | `/impeccable optimize` |
| L13 | P2 | Tap targets under 44px: the Log In pill is about 40px tall, the menu toggle about 40×44 | `nav.css:45-74` | `/impeccable adapt` |
| L14 | P3 | Body text 15px and labels 13px; raise to 16px+ for older users on budget phones | `nav.css:158-163, 215-218` | `/impeccable typeset` |
| L15 | P3 | Small cleanups: stale dev comment `index.html:39`; 8%-opacity ghost wordmark; amber dot makes Log In look like the primary action; footer link `margin-left` indents when it wraps; `100vh` should be `100svh`; reduced-motion rule kills all animations globally instead of per animation | various | `/impeccable polish` |
| — | — | Final pass, then re-run `/impeccable audit` + `/impeccable critique` | | `/impeccable polish` |

**Not on this page:** the detector flagged 4 colored-left-border toasts (`css/ui-feedback.css:80-89`), which only show on the dashboards. There are also 26 hard-coded hex colors, mostly in `dashboard.css` (10) and `ui-feedback.css` (7); status colors need tokens.

---

## Part 1: Technical audit (14/20)

| # | Area | Score | Main finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Nav links over the bright sky: 2.5–3.7:1 contrast (needs 4.5:1) |
| 2 | Performance | 2 | 736 KB hero on mobile; `hero-mobile.jpg` unused |
| 3 | Theming | 3 | Tokens are mostly used; 26 hard-coded hex values (mostly dashboard and toast CSS) |
| 4 | Responsive | 3 | Clean reflow at 390px; some tap targets under 44px; basic mobile menu |
| 5 | Code fits the design system | 3 | One coherent token system; detector found nothing on this page |

**Verdict: pass.** The page uses one coherent token system. The skip link, `:focus-visible` outline and reduced-motion handling are all present.

**What's working:** text and button contrast is strong (7.5–8.8:1; button hover 4.9:1). There is a CSP, `font-display: swap`, `aria-expanded` on the toggle, and every link resolves.

---

## Part 2: UX critique (18/36)

Method: dual-agent (A: design review · B: detector + headless browser). The browser overlay was skipped because no tool could inject a script.

| # | Heuristic | Score | Main issue |
|---|---|---|---|
| 1 | Visibility of status | 2 | No current-page marker; hero invisible until the fade-in |
| 2 | Match to the real world | 2 | Farmer-language headline, but a European tractor photo |
| 3 | User control | 2 | Mobile menu has no Esc or outside close and no ✕ |
| 4 | Consistency | 1 | "Book a Delivery" goes to 3 different places; "Register as a Driver" opens login |
| 5 | Error prevention | 2 | Vendors and drivers get funnelled into farmer content |
| 6 | Recognition over recall | 2 | No sign-up link on the landing page |
| 7 | Flexibility | n/a | One-screen marketing page |
| 8 | Aesthetic / minimalist | 3 | Disciplined; ghost wordmark and filler stats are decoration |
| 9 | Error recovery | 2 | Little to recover from |
| 10 | Help | 2 | No FAQ, pricing, coverage area, or phone/Messenger contact |

### Does it feel made for Sakada? Mostly no.
The headline and "Stop calling around for a ride" are specific to the product. The rest could front any logistics startup: dark photo with a gradient, outlined ghost wordmark, headline left with CTA right, four stat boxes. The photo is foreign and nothing is localized: no Tagalog, no ₱, no provinces, and "Sakada" is never explained.

**Detector:** the `index.html` scan found 0 issues because it doesn't follow `@import`. The `css/` scan found 4 side-tab findings on toasts (dashboard only). The render at 1440px found 5 low-contrast nav links, all confirmed. No false positives.

### What's working
1. The headline: rhythmic, framed as a benefit, and it names the real pain.
2. Barlow Condensed with Public Sans, amber used sparingly on near-black. Feels like freight at dusk.
3. Clean mobile reflow: the CTA is visible without scrolling at 390px, and the stats form a 2×2 grid.

### Persona red flags
- **Jordan (first-time visitor):** doesn't know what Sakada means or whether it covers their province. The CTA opens an explainer page. Can't tell whether they're a farmer or a vendor. Never sees "Sign up".
- **Riley (stress tester):** CTA destinations differ across pages. "Register as a Driver" opens login. The header and footer navs differ. The alt text doesn't match the photo. "24/7" has no support channel behind it.
- **Casey (one-handed, slow connection):** downloads 736 KB plus fonts, and the headline stays blank until the animation runs. Log In and ☰ sit in the top corners. Role links are hidden behind ☰. Three more page loads to reach sign-up.

### Questions to consider
- Would a Nueva Ecija rice farmer recognize their own road in the photo?
- Why does "One Booking" take four clicks to reach sign-up?
- Should the page lead in Tagalog or Taglish, with English as the toggle?

### Open decisions (unanswered)
- **Tone:** warmer and local, keep it sleek, or bolder?
- **Scope:** P0+P1 only, or everything?
