# OpenCode task: build the "Sakada v2 lp" landing page

You are updating the landing page of Sakada Logistics, a booking site for moving agricultural goods in the Philippines. The design is final and approved. Your job is to make the code match it exactly. Do not redesign, add sections, or invent copy.

## Reference images (look at these first)
- Desktop, 1440 wide: `design-ref/sakada-v2-lp-desktop-1440.png`
- Mobile, 390 wide: `design-ref/sakada-v2-lp-mobile-390.png` (the mobile hero shows a dark placeholder; in code, use the real photo `assets/hero-mobile.jpg`)
- Figma source, if you can read it: file `8q1102hOL3ZvFsiePuJrQv`, frame "Sakada v2 lp" (node `18:184`), mobile frame node `3:112`

## Files you may touch
- `sakada-web/index.html`
- `sakada-web/css/nav.css` (holds the nav, hero, and strip styles for this page)
- `sakada-web/css/base.css` only if you need a new token

Do NOT touch any other page, any JS besides what is listed here, `js/config.js`, Supabase code, or `node_modules`. Do not add any framework, library, build step, or new font. Stack is plain HTML + CSS + ES modules.

## What the page must be
One screen with three parts, top to bottom: **hero (with nav inside) → "How it works" 3-step strip → footer**. Nothing else on this page. No stat strip, no big outline "SAKADA" wordmark.

## Design tokens (already in `css/base.css`, reuse them by name)
| Token | Value | Use |
|---|---|---|
| `--bg-black` | `#0b0c09` | page and nav background, footer |
| `--panel-dark` | `#14150f` | how-it-works strip background |
| `--text-cream` | `#f3efe4` | headings, nav links, outline buttons |
| `--text-muted` | `#b8b4a6` | lede, step body, footer text |
| `--accent-amber` | `#e0972f` | primary buttons, step numbers, "DA" in logo |
| `--accent-amber-dim` | `#b9761c` | primary button hover |
| `--line` | `rgba(243,239,228,0.12)` | 1px dividers |

Text on amber buttons is `#17150c`.
Fonts (already loaded from Google Fonts in `index.html`): **Barlow Condensed 800** for the logo, headline, and step numbers; **Public Sans** 400/500/600/700 for everything else.

## Section specs (desktop at 1440px)

### 1. Nav (sits at the top of the hero)
- Full-width bar, solid `--bg-black`, 1px bottom border `--line`, height about 79px, padding `16px 64px`.
- Left: logo "SAKA" in cream plus "DA" in amber, Barlow Condensed 800, 26px, letter-spacing 0.02em. Keep the existing `.logo` + `span.mark` markup.
- Center: links How It Works / For Farmers / For Vendors / For Drivers / Contact, Public Sans 500, 15px, **cream** (not muted), gap 36px. Keep the existing hrefs.
- Right: two pill buttons, gap 12px, radius 999px, Public Sans 600 15px, padding `12px 20px`, at least 44px tall:
  - **Log In**: transparent, 1px cream border, cream text → `auth/login.html`
  - **Sign up**: amber fill, `#17150c` text → `auth/register.html`
- Remove the old `.nav-cta` with the amber dot.

### 2. Hero
- Height 860px on desktop (use `min-height: min(860px, 100svh)`, but never so short that the content overlaps the nav).
- Background photo: `assets/hero.jpg` (desktop) and `assets/hero-mobile.jpg` (≤ 600px), `background-size: cover`, `background-position: center 60%`.
- Keep the existing two scrim gradients exactly as they are in `.hero-photo` (dark at the bottom, darker on the left). They keep the text readable.
- Content sits at the **bottom** of the hero: padding `0 64px 72px`. It is a row with the headline on the left and a 400px-wide side column on the right (`justify-content: space-between; align-items: flex-end`).
- **Headline** (h1): "Your Harvest.<br>Their Truck.<br>One Booking." Barlow Condensed 800, **96px** on desktop (use `clamp(44px, 6.7vw, 96px)`), line-height 0.95, letter-spacing -0.01em, cream.
- **Side column**, 400px wide, vertical, gap 22px:
  1. Lede: "Stop calling around for a ride. Post what you're moving, get matched with a driver, and watch it get there — all from your phone." Public Sans 400, **17px**, line-height 1.6, muted.
  2. Primary button **"Book a Delivery →"**: amber, `#17150c` text, Public Sans 700 **17px**, padding `16px 28px`, radius 6px, gap 10px, right-arrow SVG icon 20px (inline SVG, `aria-hidden="true"`). Link → `auth/register.html`. Hover → `--accent-amber-dim` and `translateY(-1px)`.
  3. Role chips block, gap 10px:
     - Label "New here? I'm a…" Public Sans 500 15px muted.
     - Row of 3 pill chips, gap 10px: **Farmer →**, **Vendor →**, **Driver →**. Each: `--bg-black` fill, 1px cream border, radius 999px, padding `12px 16px 12px 18px`, height 48px, Public Sans 600 16px cream, 18px right-arrow SVG, gap 8px.
     - Links: `auth/register.html?role=farmer`, `?role=vendor`, `?role=driver`. (`js/register.js` already reads `?role=` and preselects the tab.)
- Keep the existing `rise` entrance animation on the hero content and the `prefers-reduced-motion` rule.

### 3. "How it works" strip (replaces `.stat-strip`)
- `--panel-dark` background, 1px top border `--line`, padding `44px 64px 48px`, 3 equal columns, gap 56px. Use a `<section aria-labelledby>` with a visually hidden h2 "How it works".
- Each step is a vertical stack, gap 10px:
  - Number: Barlow Condensed 800, 40px, line-height 1, amber ("01", "02", "03")
  - Title: Public Sans 600, 20px, line-height 1.3, cream (h3)
  - Body: Public Sans 400, 16px, line-height 1.55, muted
- Copy (use exactly this):
  1. **01 · Post your load:** "Tell us what you're moving, how much, and where it needs to go."
  2. **02 · Get matched with a driver:** "An available driver nearby accepts your booking. You see the estimated cost before you confirm."
  3. **03 · Track it to the drop-off:** "Follow all 5 delivery stages live, from pickup to delivered."
     (Important: it is **5** stages: Pending, Driver Assigned, Picked Up, In Transit, Delivered. The Figma says 6 by mistake. Use 5.)

### 4. Footer
- `--bg-black`, 1px top border `--line`, padding `28px 64px`, space-between row.
- Left: "© 2026 Sakada Logistics." Public Sans 400 15px muted.
- Right: links Home / How It Works / Features / About / Contact, Public Sans 500 15px muted, gap 28px, hover → cream. Keep the existing hrefs.

## Mobile (≤ 860px), see `design-ref/sakada-v2-lp-mobile-390.png`
- Nav: logo left; right side shows the **Sign up** pill and the hamburger button (44×44, 1px cream border, radius 8px). Hide Log In and the center links behind the hamburger. Keep the existing `js/main.js` toggle behavior and `aria-expanded`. Put "Log In" inside the opened menu.
- Hero: side padding 20px, bottom padding 40px. Headline stacks above the side column. Side column is full width. "Book a Delivery" becomes full width. The 3 role chips **stay on one row** (shrink padding if needed, but keep them at least 44px tall).
- Strip: steps stack in 1 column, gap 32px, padding `32px 20px`.
- Footer: links wrap onto lines above the copyright, left-aligned.
- At no width may anything overflow horizontally (test 320, 390, 768, 1024, 1440).

## Quality rules (these will be checked)
- Every tap target is at least 44×44px. Body text is at least 16px on mobile (the 15px nav/footer text is OK).
- WCAG AA contrast. All interactive elements have a visible `:focus-visible` outline (2px amber, offset 3px).
- Keep the skip link, `<main id="main">`, the CSP meta tag, the og/twitter meta, and the `role="img"` + `aria-label` on the hero photo. Change the aria-label to describe the actual photo: "Tractor pulling two trailers across farmland at sunset".
- Icons are inline SVG, never emoji or icon fonts.
- No `!important` except inside the existing reduced-motion block. No inline styles. No new colors outside the tokens.
- Don't delete CSS that other pages use. `nav.css` may be shared, so check `pages/*.html` before you remove a selector. If another page uses `.stat-strip` or `.nav-cta`, leave that rule in place.

## When you're done
1. Run `npm test` inside `sakada-web` and make sure it still passes.
2. Run `npm run dev` and check the page at 1440 and 390 widths against the two reference images.
3. Reply with a short report: the files you changed, anything you couldn't match exactly and why, and the test result. Don't commit. A reviewer (Claude Code) will audit the result against the Figma frame.
