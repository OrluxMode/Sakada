# OpenCode task: landing page for users who are already logged in

Today a logged-in farmer who opens the landing page still sees "Log In", "Sign up", a "Book a Delivery" button that goes to the sign-up page, and the "New here? I'm a…" role chips. Make the landing page recognise a signed-in user and point them to their own dashboard instead.

New visitors (not logged in) must see the page **exactly as it is today**. The guest markup stays the default in the HTML; JavaScript only swaps it for signed-in users.

## Reference
- Figma file `8q1102hOL3ZvFsiePuJrQv`, frame "Idea 2 — Landing when logged in (desktop)" (node `33:370`) and its notes panel to the right.
- What changes for a signed-in user:

| Element | Guest (today, unchanged) | Signed in |
|---|---|---|
| Nav, outline button | Log In → `auth/login.html` | **Log Out** (signs out, stays on the landing page) |
| Nav, solid button | Sign up → `auth/register.html` | **My Dashboard** → `dashboard/<role>/index.html` |
| Mobile menu last item | Log In | **Log Out** |
| Hero main button | Book a Delivery → `auth/register.html` | farmer/vendor: **Book a Delivery** → `dashboard/<role>/index.html#deliveryForm`<br>driver: **Find Deliveries** → `dashboard/driver/index.html`<br>admin: **Open Admin** → `dashboard/admin/index.html` |
| "New here? I'm a…" + role chips | shown | **hidden**, replaced by a green dot + "Signed in as a farmer" (a vendor / a driver / an admin) |

## How "signed in" is detected (important, keep the page light)
The landing page must **not** load the Supabase SDK on page load. It was tuned to a 20/20 audit, and the SDK is ~100 KB. Instead:
1. Every dashboard already calls `requireRole()` in `js/auth.js`. When it succeeds, save the role in `localStorage` under the key `sakada.role`.
2. `signOut()` removes `sakada.role`.
3. On the landing page, the user counts as signed in only when **both** hold:
   - `localStorage.getItem("sakada.role")` is one of `farmer`, `vendor`, `driver`, `admin`, and
   - a Supabase session key exists in localStorage (any key matching `/^sb-.+-auth-token$/`; supabase-js stores the session there).
   If the role is there but the session key isn't (signed out in another tab, cleared storage), remove the stale `sakada.role` and show the guest page.
4. This hint only controls which links are shown. It is not security. The dashboards still check the real role with `requireRole()`, so a faked hint just leads to a redirect.
5. The SDK is only loaded when the user clicks **Log Out**, via a dynamic `import("./auth.js")`.

## Files you may touch
- `sakada-web/index.html`
- `sakada-web/js/landing-auth.js` (new)
- `sakada-web/js/auth.js`
- `sakada-web/css/base.css`
- `sakada-web/css/nav.css`
- `sakada-web/tests/landing-auth.test.js` (new)

Nothing else. Do **not** change `js/main.js` or any other page. Don't commit.

## 1. `css/base.css`
- Add this near the top of the file, after the `:root` block. Without it, `.nav-btn { display: inline-flex }` would override the `hidden` attribute:
  ```css
  [hidden] {
    display: none !important;
  }
  ```
- Add a token in `:root`, in the Color group, after `--text-on-amber`:
  ```css
  --ok-green: #7ab05c;
  ```

## 2. `index.html`
Add `data-auth="guest"` to the guest elements, and add the signed-in elements with `data-auth="member"` and `hidden`.

**a. Mobile menu.** Replace:
```html
          <li class="nav-item-menu"><a href="auth/login.html">Log In</a></li>
```
with:
```html
          <li class="nav-item-menu" data-auth="guest"><a href="auth/login.html">Log In</a></li>
          <li class="nav-item-menu" data-auth="member" hidden>
            <button type="button" class="nav-link-btn" data-signout>Log Out</button>
          </li>
```

**b. Nav actions.** Replace the Log In and Sign up links (keep the `.nav-toggle` button after them unchanged):
```html
          <a class="nav-btn nav-btn-outline nav-login" href="auth/login.html"
            >Log In</a
          >
          <a class="nav-btn nav-btn-solid" href="auth/register.html">Sign up</a>
```
with:
```html
          <a class="nav-btn nav-btn-outline nav-login" href="auth/login.html" data-auth="guest"
            >Log In</a
          >
          <a class="nav-btn nav-btn-solid" href="auth/register.html" data-auth="guest">Sign up</a>
          <button type="button" class="nav-btn nav-btn-outline nav-login" data-auth="member" data-signout hidden>
            Log Out
          </button>
          <a class="nav-btn nav-btn-solid" href="auth/login.html" data-auth="member" data-dashboard-link hidden
            >My Dashboard</a
          >
```

**c. Hero main button.** Add `data-book-link` to the `.btn-primary` link and wrap its label in a span. Keep the SVG arrow as it is:
```html
          <a class="btn-primary" href="auth/register.html" data-book-link>
            <span data-book-label>Book a Delivery</span>
            <svg ...unchanged... </svg>
          </a>
```

**d. Role chips.** Add `data-auth="guest"` to `<div class="role-chips">`. Right after that div closes (still inside `.hero-side`), add:
```html
          <p class="signed-in" data-auth="member" hidden>
            <span class="signed-in-dot" aria-hidden="true"></span>
            Signed in as <span data-role-label>a farmer</span>
          </p>
```

**e. Script.** Right after `<script src="js/main.js"></script>`, add:
```html
    <script type="module" src="js/landing-auth.js"></script>
```
(The CSP already allows `'self'` scripts. Don't touch the CSP.)

## 3. `js/landing-auth.js` (new file, exactly this)
```js
// Landing page: if the visitor is already signed in, point the nav and the
// hero button at their own dashboard instead of sign-up.
//
// This deliberately does NOT load the Supabase SDK on page load (it's heavy
// and the landing page is tuned for speed). It reads two things from
// localStorage instead:
//   - "sakada.role", saved by requireRole() in auth.js when a dashboard loads
//   - the session key supabase-js keeps ("sb-<project>-auth-token")
// It's a display hint only. The dashboards still verify the real role.

const ROLE_KEY = "sakada.role";
const SESSION_KEY = /^sb-.+-auth-token$/;

export const ROLE_HOME = {
  farmer: { book: "dashboard/farmer/index.html#deliveryForm", cta: "Book a Delivery", label: "a farmer" },
  vendor: { book: "dashboard/vendor/index.html#deliveryForm", cta: "Book a Delivery", label: "a vendor" },
  driver: { book: "dashboard/driver/index.html", cta: "Find Deliveries", label: "a driver" },
  admin: { book: "dashboard/admin/index.html", cta: "Open Admin", label: "an admin" },
};

function hasSession(storage) {
  for (let i = 0; i < storage.length; i++) {
    if (SESSION_KEY.test(storage.key(i) || "")) return true;
  }
  return false;
}

/** Returns what the landing page should show, or null for a guest. */
export function getLandingState(storage) {
  const role = storage.getItem(ROLE_KEY);
  if (!Object.hasOwn(ROLE_HOME, role)) return null;
  if (!hasSession(storage)) {
    storage.removeItem(ROLE_KEY);
    return null;
  }
  return { role, dashboard: `dashboard/${role}/index.html`, ...ROLE_HOME[role] };
}

/** Swaps the guest elements for the signed-in ones. */
export function applyLandingState(doc, state) {
  if (!state) return;
  doc.querySelectorAll('[data-auth="guest"]').forEach((el) => (el.hidden = true));
  doc.querySelectorAll('[data-auth="member"]').forEach((el) => (el.hidden = false));

  const dash = doc.querySelector("[data-dashboard-link]");
  if (dash) dash.href = state.dashboard;

  const book = doc.querySelector("[data-book-link]");
  if (book) book.href = state.book;
  const bookLabel = doc.querySelector("[data-book-label]");
  if (bookLabel) bookLabel.textContent = state.cta;

  const roleLabel = doc.querySelector("[data-role-label]");
  if (roleLabel) roleLabel.textContent = state.label;
}

async function handleSignOut(btn) {
  const buttons = document.querySelectorAll("[data-signout]");
  buttons.forEach((b) => (b.disabled = true));
  try {
    localStorage.removeItem(ROLE_KEY);
    const { signOut } = await import("./auth.js");
    await signOut("index.html");
  } catch {
    buttons.forEach((b) => (b.disabled = false));
    btn.textContent = "Log Out failed, try again";
  }
}

if (typeof document !== "undefined" && document.querySelector("[data-auth]")) {
  applyLandingState(document, getLandingState(localStorage));
  document.querySelectorAll("[data-signout]").forEach((btn) =>
    btn.addEventListener("click", () => handleSignOut(btn)),
  );
}
```

## 4. `js/auth.js`
- In `signOut(homePath)`, add `localStorage.removeItem("sakada.role");` as the **first** line, before `await supabase.auth.signOut();`.
- In `requireRole(...)`:
  - in the `if (!profile)` branch, add `localStorage.removeItem("sakada.role");` before the redirect;
  - just before the final `return profile;`, add `localStorage.setItem("sakada.role", profile.role);`.
- Nothing else in auth.js changes.

## 5. `css/nav.css`
- In the `.nav-btn` rule, add `font-family: inherit;` and `cursor: pointer;`, so the `<button>` version looks identical to the links.
- Add a `.nav-link-btn` rule so the mobile-menu Log Out button looks exactly like the other `.nav-links a` items. Reset the button: `background: none; border: 0; padding: 0; margin: 0; font: inherit; cursor: pointer; text-align: inherit;`, then copy the same font-size, font-weight, color and hover/focus color as `.nav-links a`. **Also** add `.nav-link-btn` next to `.nav-links a` in every selector inside the `@media (max-width: 1024px)` block that styles the menu links (padding, min-height, width, borders, etc.), so it lines up with the other menu items on mobile.
- Add the signed-in line in the Hero section, after the `.role-chips-label` rule:
  ```css
  .signed-in {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--text-muted);
  }
  .signed-in-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok-green);
  }
  ```

## 6. Tests: `tests/landing-auth.test.js` (new)
Use a small fake storage object (an object with `getItem`, `setItem`, `removeItem`, `key(i)` and a `length` getter over a Map). Tests:
1. No `sakada.role` → `getLandingState` returns `null`.
2. `sakada.role = "farmer"` but no `sb-…-auth-token` key → returns `null` **and** removes `sakada.role`.
3. `farmer` + `sb-abc-auth-token` → `book` is `dashboard/farmer/index.html#deliveryForm`, `cta` is `Book a Delivery`, `dashboard` is `dashboard/farmer/index.html`, `label` is `a farmer`.
4. `driver` + session → `cta` is `Find Deliveries`, `book` is `dashboard/driver/index.html`.
5. Unknown role (`"superuser"`) + session → `null`.
6. `applyLandingState` on a small jsdom fixture (`document.body.innerHTML = ...` with one guest element, one hidden member element, a `[data-book-link]` with a `[data-book-label]`, a `[data-dashboard-link]` and a `[data-role-label]`): after applying the vendor state, the guest element is hidden, the member element is visible, the hrefs/labels are the vendor ones, and the role label reads `a vendor`.
7. `applyLandingState(document, null)` changes nothing.

## Check before you finish
- `cd sakada-web && npx vitest run` passes: 48 old + 7 new = **55**.
- `node --check` is not enough for modules. Open `index.html` through `npx serve . -l 4321` and confirm the page looks exactly like before for a guest, with no console errors.
- Don't change anything about the guest page's look, copy, or links.
