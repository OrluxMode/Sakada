# OpenCode task: fix 4 issues in the landing page v2 build

Your landing page build was reviewed. At 1440px it matches the design and `npm test` passes, so keep everything that already works. Fix only the issues below. Touch only `sakada-web/css/nav.css` and `sakada-web/css/base.css`. Don't change any HTML, and don't commit.

Remember that `nav.css` is shared. `css/style.css` imports it on every page (`pages/*.html` and `404.html`), so any change to `.nav` also changes those pages.

## 1. [P1] On phones the nav buttons are stuck against the logo, on EVERY page
- **What you see:** at 390px wide, the Sign up pill and the hamburger sit right next to "SAKADA" with no space between them. On `pages/about.html` and the other inner pages, the hamburger and the Log In pill also crowd up against the logo. Before your change they were spread across the bar.
- **Why:** you removed `justify-content: space-between` from `.nav`. On mobile `.nav-links` becomes `position: absolute`, so nothing pushes the buttons to the right anymore.
- **Fix:** put `justify-content: space-between;` back on `.nav` and add `gap: 24px;`. Keep `flex: 1` on `.nav-links` so the desktop links stay centered.
- **Check:** at 390px on `index.html` and `pages/about.html`, the logo is on the far left and the buttons are on the far right.

## 2. [P1] Between 861px and about 1000px the nav links wrap and collide
- **What you see:** at 900px, "How It / Works", "For / Farmers", etc. break onto two lines, and "Contact" touches the Log In button.
- **Fix:**
  - Add `white-space: nowrap;` to `.nav-links a`.
  - Move the **nav-only** mobile rules into a new `@media (max-width: 1024px)` block: the dropdown `.nav-links`, `.nav-links.open`, `.nav-links a`, `.nav-item-menu`, `.nav-login`, and `.nav-toggle`.
  - Leave the hero, chips, steps, and footer rules at `max-width: 860px`.
- **Check:** at 900px and 1024px, the hamburger shows and nothing wraps. At 1100px and 1440px, the full link row shows.

## 3. [P2] Footer links are too small to tap on phones
- **What you see:** at ≤860px each footer link is only about 18px tall. The rule is at least 44px.
- **Fix:** inside the existing `@media (max-width: 860px)` block, add:
  ```css
  .site-footer.lp-footer nav { gap: 4px 24px; }
  .site-footer.lp-footer a { display: inline-flex; align-items: center; min-height: 44px; }
  ```

## 4. [P3] Duplicate global focus rule
- **Problem:** `nav.css` adds a second global `:focus-visible { outline: 2px solid var(--accent-amber); outline-offset: 3px; }`. That repeats the rule in `base.css` and silently overrides it on every page.
- **Fix:** delete that block from `nav.css`, and change `outline-offset` in `base.css`'s `:focus-visible` from `2px` to `3px`.

## When you're done
1. Run `npm test` in `sakada-web`.
2. Look at `index.html` at 320, 390, 900, 1024, 1100 and 1440px wide, and at `pages/about.html` at 390 and 1440. Nothing should overflow sideways or collide.
3. Reply with the files you changed and the test result.
