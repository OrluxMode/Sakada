# OpenCode task: fix the landing page audit findings

The landing page (`sakada-web/index.html`) was audited and scored 13/20. The full report is `claude audit - landing page.md` in the project root, so read it first. Fix the 9 items below **exactly as described**. The page must look the same as it does now at 1440×900 and 390×844. These are technical fixes, not a redesign. Don't commit.

## Files you may touch
- `sakada-web/index.html`
- `sakada-web/css/nav.css`
- `sakada-web/css/base.css`
- `sakada-web/js/main.js` (it's shared by all public pages, which is fine and intended)
- `sakada-web/assets/hero.jpg` (recompress only, see item 5)

Nothing else. Don't touch the inner pages, `style.css`, `pages.css`, or any app/dashboard file.

---

## 1. [P1] Headline hidden under the nav on short or sideways screens
At 844×390 the hero content starts at y=0, and the 79px nav (`position: absolute`) covers "Your Harvest.".
- In `base.css` `:root`, add the token `--nav-h: 79px;`.
- In `nav.css`, give `.hero` `padding-top: var(--nav-h);`. The hero content can then never rise under the nav, and at tall viewports nothing changes (the content stays bottom-aligned).
- Change `.nav { min-height: 79px; }` to `min-height: var(--nav-h);`, and the mobile dropdown's `top: 79px` to `top: var(--nav-h);`.

## 2. [P2] Landmarks: `<main>` is inside `<header>`
Restructure `index.html` like this, keeping every class name so the CSS keeps working:
```html
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="site-header">
    <nav class="nav" aria-label="Primary"> …unchanged… </nav>
  </header>

  <main id="main">
    <div class="hero">
      <div class="hero-photo" role="img" aria-label="Tractor pulling two trailers across farmland at sunset"></div>
      <div class="wordmark" aria-hidden="true">SAKADA</div>
      <div class="hero-content">
        <h1 class="headline">…</h1>
        <div class="hero-side">…unchanged…</div>
      </div>
    </div>

    <section class="steps" aria-labelledby="steps-heading"> …unchanged… </section>
  </main>

  <footer class="site-footer lp-footer"> …unchanged… </footer>
```
Notes:
- `.hero-content` changes from `<main>` to `<div>`. The old `id="main"` moves to the new `<main>`.
- The nav stays `position: absolute` with `top: 0`, so it still sits on top of the hero at the top of the page. Check that it still looks exactly the same.
- Remove the empty whitespace inside the `.hero-photo` div (`>      </div>` → `></div>`), and update the old HTML comment above it ("rural road") to say "tractor at sunset".

## 3. [P2] Mobile menu accessibility (`js/main.js` + markup)
- Give the `<ul class="nav-links">` `id="primary-menu"`, and give the toggle button `aria-controls="primary-menu"`.
- Rewrite `main.js` so that:
  - clicking the toggle opens or closes the menu, sets `aria-expanded`, and switches `aria-label` between "Open menu" and "Close menu"
  - pressing **Escape** while the menu is open closes it and moves focus back to the toggle
  - clicking anywhere outside the menu and the toggle closes it
  - clicking a link inside the menu closes it
  - all of it still does nothing harmful on pages that lack the toggle (keep the early `return`)
- Plain JS, no libraries. Keep it short and readable.
- The inner pages (`pages/*.html`, `404.html`) use the same markup but don't have `id="primary-menu"`. Make the JS work without the id: find the menu with `querySelector(".nav-links")`. Only set `aria-controls` from JS if the menu has an id. Don't edit the inner pages in this task.

## 4. [P2] Share previews have no image
`og:image`, `og:url` and `twitter:image` point to `https://sakadalogistics.ph/…`. That domain doesn't respond. Change them to the live site:
- `og:url` → `https://sakada-blue.vercel.app/`
- `og:image` and `twitter:image` → `https://sakada-blue.vercel.app/assets/hero.jpg`

## 5. [P2] Hero photo: load it early, send tablets the smaller file
- In `nav.css`, the media query that swaps in `hero-mobile.jpg` is `@media (max-width: 600px)`. Change it to `@media (max-width: 1024px)`.
- In `index.html` `<head>`, right after the stylesheet link, add:
  ```html
  <link rel="preload" as="image" href="assets/hero-mobile.jpg" media="(max-width: 1024px)" />
  <link rel="preload" as="image" href="assets/hero.jpg" media="(min-width: 1025px)" />
  ```
- Recompress `assets/hero.jpg` (currently 2400×1800, 736 KB). If Python with Pillow is available, run:
  ```
  python3 -c "from PIL import Image; im=Image.open('sakada-web/assets/hero.jpg'); im=im.resize((1920,1440), Image.LANCZOS); im.save('sakada-web/assets/hero.jpg', quality=72, optimize=True, progressive=True)"
  ```
  Target: under 350 KB. If Pillow isn't available, skip this step and say so in your report.

## 6. [P2] Load only the CSS this page uses
`index.html` loads `css/style.css`, which `@import`s 10 files one after another, including dashboard, admin and auth CSS this page never uses. In `index.html` only, replace
```html
<link rel="stylesheet" href="css/style.css" />
```
with
```html
<link rel="stylesheet" href="css/base.css" />
<link rel="stylesheet" href="css/nav.css" />
<link rel="stylesheet" href="css/pages.css" />
```
(in that order, which is the same order `style.css` uses). The page only uses classes from those three files. Don't change `style.css`, because the app pages still use it.

## 7. [P2] Lede contrast over the bright sky on short laptop screens
At 1440×700, the muted lede (`.hero-side p`) sits over bright sky and drops to about 2.8:1 contrast. Darken the right side of the scrim a little. In **both** `.hero-photo` background-image declarations (the default one and the one in the `max-width: 1024px` query), add this as the **first** layer, before the two existing gradients:
```css
linear-gradient(
  270deg,
  rgba(11, 12, 9, 0.5) 0%,
  rgba(11, 12, 9, 0) 45%
),
```
Keep the two existing gradients and the `url(...)` exactly as they are, in the same order after it.

## 8. [P3] Font weights
In the Google Fonts URL in `index.html`, change `Barlow+Condensed:wght@600;800;900` to `Barlow+Condensed:wght@700;800;900`. Nothing uses 600, and 700 is used elsewhere.

## 9. [P3] Hard-coded button text color
In `base.css` `:root`, add `--text-on-amber: #17150c;`. In `nav.css`, replace both `color: #17150c;` with `color: var(--text-on-amber);`.

---

## Quality rules (these will be checked)
- At 1440×900 and 390×844 the page looks the same as before, apart from the slightly darker right side of the photo.
- At 844×390 (phone held sideways) and 1440×700, the whole headline is visible below the nav.
- No horizontal overflow at 320, 390, 768, 1024, 1440.
- The menu works at ≤1024px: toggle, Escape, outside click and link click all close it. Check that it still works on `pages/about.html` too.
- No inline styles, no `!important` (except the existing reduced-motion block), no new colors besides the token in item 9.
- The CSP meta tag stays unchanged.

## When you're done
1. Run `npm test` inside `sakada-web`.
2. Run `npm run dev` and check the sizes above.
3. Reply with the files you changed, the new size of `hero.jpg`, anything you skipped and why, and the test result. The reviewer (Claude Code) will re-run the audit.
