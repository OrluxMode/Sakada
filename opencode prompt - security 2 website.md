# OpenCode task: website half of the security fixes, plus inner-page footers

This task changes only the website (`sakada-web/`). It pairs with the database migrations 0015–0018, which were written separately. Don't touch `sakada-backend/`. Don't commit.

The finding numbers (N2, N3…) refer to `claude read and analyze.md` in the project root.

## Files you may touch
- `sakada-web/pages/*.html` and `sakada-web/404.html`: footer class only (item 1)
- `sakada-web/js/dashboard-shared.js`
- `sakada-web/js/driver-dashboard.js`, `farmer-dashboard.js`, `vendor-dashboard.js`: only the lines named below
- `sakada-web/js/deliveries.js`
- `sakada-web/js/auth.js`
- `sakada-web/js/callback.js`
- `sakada-web/auth/callback.html`
- `sakada-web/vercel.json` **does not exist**. The Vercel config is the root `vercel.json` (`/home/orlux/Desktop/Sakada/vercel.json`), so edit that one (item 6).
- `sakada-web/tests/*` (only to add tests, item 8)

---

## 1. Inner-page footers: tap targets on phones
The landing page footer has class `site-footer lp-footer`. With that class the links are 15px, and on phones they're at least 44px tall. The 7 inner pages and `404.html` still use plain `site-footer`, so their links are about 18px tall on phones.

In `pages/about.html`, `contact.html`, `features.html`, `for-drivers.html`, `for-farmers.html`, `for-vendors.html`, `how-it-works.html` and `404.html`, change
```html
<footer class="site-footer">
```
to
```html
<footer class="site-footer lp-footer">
```
That's the only change in those files. The `.lp-footer` rules already live in `css/nav.css`, which every page loads through `style.css`.

## 2. [N3] Rate the OTHER person, not yourself
`renderRatingBlock()` in `js/dashboard-shared.js` sets `data-other-user-id="${d.driver_id || d.requester_id}"`. On the driver dashboard `d.driver_id` is the driver, so drivers rate themselves.
- Change the signature to `renderRatingBlock(d, existingRating, ratedLabel, viewerId)`.
- Compute the other person: `const otherUserId = d.driver_id === viewerId ? d.requester_id : d.driver_id;`. Use it in `data-other-user-id` (still wrapped in `sanitizeText`).
- Update the 3 callers to pass the signed-in user's id as the 4th argument (`profile.id`):
  - `js/driver-dashboard.js` (line ~226)
  - `js/farmer-dashboard.js` (line ~262)
  - `js/vendor-dashboard.js` (line ~262)

## 3. [N11] Show rating errors
In `wireRatingControls()` (`js/dashboard-shared.js`), when `submitRatingFn` returns an error, the button resets and nothing tells the user why. In that `if (error)` branch, also call `toastError("Couldn't save your rating: " + error.message)`. Import `toastError` from `./toast.js` at the top of the file. Remove the pointless `return { error };` / `return {};` from the event handler.

## 4. [N8] Notification text is plain text
In `js/dashboard-shared.js`, the notification list renders `${sanitizeHTML(n.message)}`. Messages contain user-typed addresses, so render them as text: `${sanitizeText(n.message)}`. If `sanitizeHTML` is no longer used anywhere in that file, remove it from the import.

## 5. [N6] Stop calling the client-side rate limiter
The database now enforces rate limits itself (0018). In `js/deliveries.js`:
- delete the `enforceRateLimit` function
- remove its 3 calls (in `createDelivery`, `acceptDelivery` and `updateDeliveryStatus`)

Keep everything else in those functions exactly as it is. A rate-limit error from the database comes back as a normal `error` with a readable message, and the dashboards already show `error.message`.

## 6. [N10] Security headers on Vercel
Edit the root `vercel.json` (`/home/orlux/Desktop/Sakada/vercel.json`). Keep the 4 existing keys exactly, and add:
```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Content-Security-Policy", "value": "frame-ancestors 'none'" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=(), payment=()" }
    ]
  }
]
```
Note: the header CSP contains **only** `frame-ancestors`. The full CSP stays in each page's `<meta>` tag, and browsers enforce both. Don't copy the meta CSP into the header. Make sure the file is still valid JSON.

## 7. [N5 + N2 + N16] Booking distance, Google role choice, callback fallback

**a) Booking sends the route distance (N5).** In `js/farmer-dashboard.js` and `js/vendor-dashboard.js`, in the `createDelivery({...})` payload, add one line after `estimated_cost: pendingQuote.cost,`:
```js
distance_km: pendingQuote.distanceKm,
```
Keep `estimated_cost` (the database recalculates it, but keep sending it). Change nothing else in those files.

**b) Google sign-up remembers the chosen role (N2).** `signInWithOAuth` ignores `options.data`, so the role never reaches the database. In `js/auth.js` `loginWithGoogle(role)`:
- Remove `data: role ? { role } : undefined,` from `options`.
- Before calling `signInWithOAuth`, if `role` is `farmer`, `vendor` or `driver`, save it:
  ```js
  localStorage.setItem("sakada.pendingRole", JSON.stringify({ role, at: Date.now() }));
  ```
  If `role` is missing, `localStorage.removeItem("sakada.pendingRole")`.
- Update the doc comment above the function to explain this: the role is stored locally and applied by `callback.js` via the `set_initial_role` RPC, because OAuth can't carry signup metadata.

**c) Rewrite `js/callback.js` (N2 + N16).** Requirements:
- One guarded async function `finish()` that runs **once**, no matter whether `onAuthStateChange` (`SIGNED_IN`) or the 2.5s timeout fires first. Use a `let done = false` flag.
- In `finish()`:
  1. `let profile = await getCurrentProfile();`. If there's no profile, return (the next trigger or the fallback will handle it).
  2. Read and parse `localStorage["sakada.pendingRole"]` (wrap it in try/catch), then **always remove the key**.
  3. If the stored role exists, is less than 15 minutes old (`Date.now() - at < 15 * 60 * 1000`), is one of `farmer|vendor|driver`, `profile.role_confirmed_at` is null, and the role differs from `profile.role`:
     - call `await supabase.rpc("set_initial_role", { p_role: role })`
     - if there's no error, reload the profile with `getCurrentProfile()`
     - if there is an error, ignore it (log nothing) and continue with the current profile
  4. If the stored role equals `profile.role` and `role_confirmed_at` is null, call the same RPC anyway. That confirms the role so it can't be changed later. Ignore errors.
  5. Set `done = true` and redirect with the existing `DASHBOARD_PATHS` map (fallback `../index.html`).
- **Fallback (N16):** if after **10 seconds** nothing has redirected, replace the "Signing you in…" text with:
  > We couldn't finish signing you in. [Try logging in again](login.html)

  Use DOM methods (`textContent` plus an `<a>` element), not `innerHTML`.
- In `auth/callback.html`, give the `<p>` an `id="callbackStatus"` and `role="status"` so the script can find it and screen readers announce the change. Remove the `p` element's inline `style` attribute and add `class="auth-callback-status"`. Then add this rule at the end of `css/auth.css`. This is the one exception to the touch-list above, and it's allowed:
  ```css
  .auth-callback-status { color: var(--text-muted); font-size: 14px; }
  ```

## 8. Tests
Add to `sakada-web/tests/dashboard-shared.test.js` (create the `describe` block if needed):
- `renderRatingBlock` for a delivered delivery, with `viewerId` = the driver's id, puts the **requester's** id in `data-other-user-id`.
- With `viewerId` = the requester's id, it puts the **driver's** id there.

Follow the style of the existing tests in that file (Vitest + jsdom).

---

## Rules
- No new libraries. Plain ES modules, matching the surrounding code style.
- Don't change any behavior not listed here.
- `npm test` must pass, including your new tests.

## When you're done
Run `npm test` inside `sakada-web`, then reply with:
- the files you changed
- the test result (number passed)
- anything you couldn't do and why

The reviewer (Claude Code) will check everything before anything is deployed.
