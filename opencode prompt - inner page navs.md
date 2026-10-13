# OpenCode task: make the inner-page navs match the new landing page nav

The landing page (`sakada-web/index.html`) has a new nav. The 7 inner pages and the 404 page still use the old one. Make them match the landing nav in markup and look. Do not redesign anything, and do not touch page content below the nav.

## Pages to update (8 files)
- `sakada-web/pages/about.html`, `contact.html`, `features.html`, `for-drivers.html`, `for-farmers.html`, `for-vendors.html`, `how-it-works.html`
- `sakada-web/404.html` (it lives in the site root, so its paths have no `../`)

You may also edit `sakada-web/css/pages.css` and `sakada-web/css/nav.css`. Don't touch `index.html`, any JS file, `auth/`, `dashboard/`, or anything else. Don't commit.

## The target: copy the nav from `index.html`
Open `sakada-web/index.html` and copy its `<nav class="nav" aria-label="Primary">…</nav>` block. That block contains the logo, the `ul.nav-links` (with the extra `li.nav-item-menu` "Log In" item), and the `div.nav-actions` (Log In outline pill, Sign up amber pill, and the hamburger `button.nav-toggle` with its inline SVG). On each inner page, replace the old nav with that block, with these changes:

1. **Keep the class `nav nav--static`** on the `<nav>`. `.nav--static` makes it sit in the page flow instead of floating over a hero photo.
2. **Fix the paths for the folder:**
   - In `pages/*.html`: logo → `../index.html`, links → `how-it-works.html`, `for-farmers.html`, etc. (same folder), Log In → `../auth/login.html`, Sign up → `../auth/register.html`.
   - In `404.html`: same paths as `index.html` (no `../`).
3. **Mark the current page.** On the page the link points to, add `aria-current="page"` to that link (how-it-works, for-farmers, for-vendors, for-drivers, contact). `about.html`, `features.html` and `404.html` have no matching nav link, so they get no `aria-current`.
4. **Delete the old pieces:** the `☰` text button that sits before the `<ul>`, and the old `a.nav-cta` with the `span.dot`.

## CSS
- In `css/pages.css`, change the `.nav--static` background from `var(--panel-dark)` to `var(--bg-black)`. That matches the landing nav. Keep `position: static` and the bottom border.
- In `css/nav.css`, add a style for the current-page link, both in the desktop row and in the mobile dropdown:
  ```css
  .nav-links a[aria-current="page"] {
    color: var(--accent-amber);
  }
  ```
- In `css/nav.css`, the "Legacy styles shared by other pages" section has `.nav-cta` and `.nav-cta .dot`. Once no HTML file uses `.nav-cta` anymore (check with `grep -rn "nav-cta" sakada-web --include=*.html`), delete those two rules. Leave `.stat-strip` alone unless the same grep shows nothing uses it either. If nothing uses it, delete it too, including its rules inside the media queries.
- The mobile dropdown uses `top: 79px` with `position: absolute`. On inner pages the nav is `position: static`, so make sure the dropdown still opens right under the nav bar and isn't stuck at the top of the page. If it is, add `position: relative` to `.nav--static`.

## Bug to fix at the same time: the hamburger does nothing on 2 pages
`pages/contact.html` and `404.html` never load `js/main.js`, so on phones their menu button can't open. Add the same tag the other pages use, just before `</body>`:
- `pages/contact.html`: `<script src="../js/main.js"></script>` (keep the existing `contact.js` module tag too)
- `404.html`: `<script src="js/main.js"></script>`

## Quality rules (these will be checked)
- Every page's nav looks identical to the landing nav at 390, 900, 1024, 1100 and 1440px wide. Only the background behavior differs (static, not over a photo).
- At ≤1024px: logo on the left; Sign up and the hamburger on the right; Log In moves into the dropdown. At ≥1025px: the full link row plus the Log In and Sign up pills.
- The hamburger opens and closes the menu on all 8 pages, and `aria-expanded` flips between true and false.
- Tap targets are at least 44px. No horizontal overflow at 320px.
- No inline styles, no `!important`, no new colors, no emoji icons.

## When you're done
1. Run `npm test` inside `sakada-web`.
2. Check at least `pages/about.html`, `pages/contact.html` and `404.html` at 390 and 1440px wide. On 390px, tap the hamburger on each one.
3. Reply with the files you changed, what you deleted from `nav.css`, and the test result. A reviewer (Claude Code) will check the result.
