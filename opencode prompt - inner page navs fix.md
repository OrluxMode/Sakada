# OpenCode task: fix broken nav links on 8 pages

Your inner-page nav update looks right and the tests pass. But **every page link in the new navs goes to a 404**, because the relative paths are backwards. Fix only the `href`s inside the `<nav class="nav nav--static">` blocks. Change nothing else, and don't commit.

## The bug
- `pages/*.html` (7 files): the page links use `../how-it-works.html`, `../for-farmers.html`, `../for-vendors.html`, `../for-drivers.html`, `../contact.html`. Those resolve to the site root, where the files don't exist.
  - **Correct:** no `../`, because these pages are in the same `pages/` folder: `how-it-works.html`, `for-farmers.html`, `for-vendors.html`, `for-drivers.html`, `contact.html`.
  - Keep `../index.html`, `../auth/login.html` and `../auth/register.html` as they are. Those are correct.
- `404.html` (site root): the page links use `how-it-works.html` etc.
  - **Correct:** `pages/how-it-works.html`, `pages/for-farmers.html`, `pages/for-vendors.html`, `pages/for-drivers.html`, `pages/contact.html` (same as `index.html`).

Keep the `aria-current="page"` attributes where they are.

## Check
1. Run `grep -rn 'href="\.\./\(how-it-works\|for-farmers\|for-vendors\|for-drivers\|contact\)\.html"' sakada-web/pages`. It should return nothing.
2. Run `grep -n 'href="\(how-it-works\|for-farmers\|for-vendors\|for-drivers\|contact\)\.html"' sakada-web/404.html`. It should return nothing.
3. Start `npm run dev`, open `pages/about.html` and `404.html`, click each nav link, and confirm every one opens a real page.
4. Run `npm test`, then reply with the files you changed and the test result.
