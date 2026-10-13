# OpenCode task: logged-in nav on every page (not just the landing page)

**Bug:** when a user is logged in, only `index.html` switches the nav to **Log Out / My Dashboard**. Every other page still shows **Log In / Sign up**, because only `index.html` loads `js/landing-auth.js`. The How It Works page also still sends logged-in users to the sign-up page from its "Book a Delivery" and "Sign up to drive" buttons.

**Fix:**
1. Make `js/landing-auth.js` work from any folder.
2. Add the same nav markup and script to the 8 inner pages.
3. Switch the How It Works call-to-action buttons for logged-in users.

The landing page must keep working exactly as it does now.

## Files you may touch
- `sakada-web/js/landing-auth.js`
- `sakada-web/tests/landing-auth.test.js`
- `sakada-web/pages/how-it-works.html`, `for-farmers.html`, `for-vendors.html`, `for-drivers.html`, `features.html`, `about.html`, `contact.html`
- `sakada-web/404.html`

Nothing else. Don't commit.

---

## 1. `js/landing-auth.js`: work from any folder

The links are currently relative to the site root (`dashboard/farmer/index.html`), so they break on `pages/*.html`. Build them from the site root, worked out from the script's own URL.

Make these changes:

**a.** Below `const SESSION_KEY = …`, add:
```js
// Site root, worked out from this file's URL (js/landing-auth.js → /), so
// links work from index.html, pages/*.html and 404.html alike.
const ROOT = typeof document !== "undefined" ? new URL("../", import.meta.url).href : "";
```

**b.** Give `getLandingState` a `root` parameter (default `""`, so the existing tests still pass) and prefix every link with it:
```js
export function getLandingState(storage, root = "") {
  const role = storage.getItem(ROLE_KEY);
  if (!Object.hasOwn(ROLE_HOME, role)) return null;
  if (!hasSession(storage)) {
    storage.removeItem(ROLE_KEY);
    return null;
  }
  const home = ROLE_HOME[role];
  return {
    role,
    dashboard: `${root}dashboard/${role}/index.html`,
    book: `${root}${home.book}`,
    cta: home.cta,
    label: home.label,
  };
}
```

**c.** In `applyLandingState`, after the existing `roleLabel` block, add support for the page-level call-to-action buttons (used on How It Works):
```js
  // Page call-to-action buttons (How It Works). "book" buttons are for
  // farmers/vendors; "drive" buttons are for drivers. Anyone else gets
  // the button hidden rather than a link back to sign-up.
  const isSender = state.role === "farmer" || state.role === "vendor";
  doc.querySelectorAll('[data-auth-cta="book"]').forEach((el) => {
    if (isSender) el.href = state.book;
    else el.hidden = true;
  });
  doc.querySelectorAll('[data-auth-cta="drive"]').forEach((el) => {
    if (state.role === "driver") {
      el.href = state.dashboard;
      el.textContent = "Find Deliveries";
    } else {
      el.hidden = true;
    }
  });
```

**d.** In `handleSignOut`, change `await signOut("index.html");` to `await signOut(`${ROOT}index.html`);`.

**e.** At the bottom, change `getLandingState(localStorage)` to `getLandingState(localStorage, ROOT)`.

**f.** Update the top comment: "Landing page:" becomes "Every public page (landing, pages/*, 404):".

Don't change anything else in the file.

---

## 2. The nav on the 8 inner pages

In each of `pages/how-it-works.html`, `for-farmers.html`, `for-vendors.html`, `for-drivers.html`, `features.html`, `about.html`, `contact.html` and `404.html`, make the same 3 edits `index.html` already has. **Keep each page's existing `href` paths:** `pages/*` use `../auth/…`, and `404.html` uses `auth/…`.

**a. Mobile menu.** Replace the `<li class="nav-item-menu">…Log In…</li>` line with:
```html
<li class="nav-item-menu" data-auth="guest"><a href="../auth/login.html">Log In</a></li>
<li class="nav-item-menu" data-auth="member" hidden>
  <button type="button" class="nav-link-btn" data-signout>Log Out</button>
</li>
```
(in `404.html` the Log In href stays `auth/login.html`)

**b. Nav actions.** Add `data-auth="guest"` to the existing Log In and Sign up links. Right after the Sign up link (before the `.nav-toggle` button), add:
```html
<button type="button" class="nav-btn nav-btn-outline nav-login" data-auth="member" data-signout hidden>
  Log Out
</button>
<a class="nav-btn nav-btn-solid" href="../auth/login.html" data-auth="member" data-dashboard-link hidden
  >My Dashboard</a
>
```
(in `404.html` the href is `auth/login.html`; the script replaces it anyway)

**c. Script.** Right after the existing `main.js` script tag, add:
- in `pages/*.html`: `<script type="module" src="../js/landing-auth.js"></script>`
- in `404.html`: `<script type="module" src="js/landing-auth.js"></script>`

Don't add the hero chips or the "Signed in as…" line to these pages. Those only exist on the landing page, and the script simply skips anything it doesn't find.

---

## 3. How It Works call-to-action buttons

In `pages/how-it-works.html`, add the attribute to these 5 buttons. Don't change their classes or text:
- The 3 "Book a Delivery" links (fare card, end of the sending list, closing band): add `data-auth-cta="book"`.
- The 2 "Sign up to drive" links (end of the driving list, closing band): add `data-auth-cta="drive"`.

What a logged-in user then sees:
- **Farmer/vendor:** Book a Delivery goes to their dashboard's booking form, and Sign up to drive is hidden.
- **Driver:** Book a Delivery is hidden, and "Sign up to drive" becomes **Find Deliveries**, linking to their dashboard.
- **Admin:** both are hidden.
- **Logged out:** everything stays as it is today.

---

## 4. Tests: add to `tests/landing-auth.test.js`
Keep all existing tests unchanged. They must still pass, since `root` defaults to `""`. Add:
1. `getLandingState(storage, "https://x.test/")` with farmer + session: `dashboard` is `https://x.test/dashboard/farmer/index.html` and `book` is `https://x.test/dashboard/farmer/index.html#deliveryForm`.
2. `applyLandingState` with a fixture containing one `[data-auth-cta="book"]` link and one `[data-auth-cta="drive"]` link:
   - farmer state: the book href becomes the farmer booking URL, and the drive link is hidden;
   - driver state (fresh fixture): the book link is hidden, and the drive link's text is "Find Deliveries" with an href of the driver dashboard.

## Checks before you finish
1. `cd sakada-web && npx vitest run` passes (63 + the new tests).
2. `cp js/landing-auth.js /tmp/l.mjs && node --check /tmp/l.mjs`.
3. `grep -c 'landing-auth.js' sakada-web/index.html sakada-web/404.html sakada-web/pages/*.html` shows 1 for each of the 9 files.
4. Logged out, every page looks exactly as before.
