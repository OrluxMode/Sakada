# OpenCode task: final backlog cleanup (N12, N13, N17–N20, N22, N23)

These are the last low-priority items from `claude read and analyze.md`. Each one is small. Do them **in order**, and **don't change any behavior** beyond what's described. No database changes. Don't commit.

---

## 1. [N12] Merge the duplicate farmer/vendor dashboard scripts
`sakada-web/js/farmer-dashboard.js` and `js/vendor-dashboard.js` are identical except line 28 (`"farmer"` vs `"vendor"`). Run `diff` to confirm that's still the only difference. If it isn't, **stop and report** instead of merging.

- Create `sakada-web/js/requester-dashboard.js` as a copy of `farmer-dashboard.js`. Then:
  - Add this right before the `requireRole(...)` call:
    ```js
    // One script serves both requester dashboards; the page says which role it's for.
    const ROLE = document.body.dataset.role;
    if (ROLE !== "farmer" && ROLE !== "vendor") {
      throw new Error(`requester-dashboard.js: unexpected data-role "${ROLE}"`);
    }
    ```
  - Change the first argument of `requireRole(` from `"farmer"` to `ROLE`.
- In `sakada-web/dashboard/farmer/index.html`:
  - change `<body>` to `<body data-role="farmer">`
  - change the script tag to `<script type="module" src="../../js/requester-dashboard.js"></script>`
- In `sakada-web/dashboard/vendor/index.html`: the same, with `data-role="vendor"`.
- Delete `js/farmer-dashboard.js` and `js/vendor-dashboard.js`.
- Run `grep -rn "farmer-dashboard\|vendor-dashboard" sakada-web --include=*.html --include=*.js`. It must return nothing outside `node_modules`.

## 2. [N13] Remove the stale "Coming in Phase 9" note
In `dashboard/farmer/index.html` and `dashboard/vendor/index.html` (around line 153), there's a note starting `<strong>Coming in Phase 9:</strong> ratings and feedback…`. Ratings already ship. Delete that whole note element (the full element that wraps it, not just the `<strong>`). Don't touch anything around it.

## 3. [N17] "Back online" is good news
In `sakada-web/js/offline.js` `handleOnline()`, change `toastWarning("You're back online")` to `toastSuccess("You're back online")`. Fix the import: add `toastSuccess`, and remove `toastWarning` only if nothing else in the file uses it (it's still used by `handleOffline`, so keep it).

## 4. [N18] Admin can read contact-form messages, and Feedback stops double-loading
**a) `js/admin-data.js`:** add
```js
/** Contact-form messages, newest first (admins only, via the 0014 RLS policy). */
export async function getContactSubmissions() {
  return await supabase
    .from("contact_submissions")
    .select("id, name, email, phone, role, purpose, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
}
```

**b) `dashboard/admin/index.html`:**
- Add a 4th tab button after Feedback: `<button type="button" data-tab="messages">Messages</button>`.
- Add a 4th panel after `panel-feedback`, copying the Feedback panel's structure exactly:
  - `id="panel-messages"`
  - a table with columns **Received, Name, Email, Phone, Role, Purpose, Message**
  - `<tbody id="messagesTableBody">` with a 7-column "Loading…" row

**c) `js/admin-dashboard.js`:**
- **Stop double-loading.** `loadDeliveries()` already fetches every delivery, and `loadFeedback()` fetches them all **again** just to look up delivery codes. Store a map in `loadDeliveries()`, and make `loadFeedback()` use it instead of calling `getAllDeliveries()` again:
  - declare `let deliveryCodeById = new Map();` near the top, next to `profilesById`
  - fill it in `loadDeliveries()` after a successful fetch
  - in `loadFeedback()`, delete the second `getAllDeliveries()` call and the local map
- Add `loadMessages()`, following the same pattern as `loadFeedback()`:
  - skeleton rows (7 columns, 3 rows)
  - on error, `showMessage(...)` + `toastError("Failed to load messages")`
  - one row per message:
    - date: `new Date(m.created_at).toLocaleString()`
    - name, email, phone, role, purpose: each through `sanitizeText`, or "—" if empty
    - message: `sanitizeText(m.message)`
  - empty state: "No messages yet." (same markup style as Feedback's empty row)
- Call `await loadMessages();` after `await loadFeedback();` at the bottom.
- Import `getContactSubmissions`.

## 5. [N19] Use the Supabase auth lock again
In `sakada-web/js/supabase-client.js`, delete the line `lock: false,`. supabase-js then uses its default cross-tab lock, which prevents token-refresh races when several tabs are open. Keep the other 3 auth options unchanged.

## 6. [N20] Same DOMPurify version in production and tests
The tests use DOMPurify **3.4.15** (npm), but the 4 dashboards load **3.1.6** from cdnjs. In `dashboard/admin/index.html`, `dashboard/driver/index.html`, `dashboard/farmer/index.html` and `dashboard/vendor/index.html`, replace
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.1.6/purify.min.js"></script>
```
with
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js" integrity="sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N" crossorigin="anonymous"></script>
```
The `integrity` hash was computed from the exact cdnjs file. Copy it exactly. If any other HTML file loads DOMPurify 3.1.6 (`grep -rn "dompurify/3.1.6" sakada-web --include=*.html`), update it the same way.

## 7. [N22] Role pickers: correct ARIA
Both role pickers are single-choice button groups, not tabs.

**a) `auth/register.html`:**
- On the `<div class="role-tabs" role="tablist" aria-label="Account type">`, change `role="tablist"` to `role="group"`.
- On each button inside it: remove any `role="tab"` / `aria-selected`. Add `aria-pressed="true"` to the initially active button and `aria-pressed="false"` to the others.

**b) `js/register.js`:** where the active tab is switched (`setActiveTab`), also set `aria-pressed` on every button (`"true"` on the selected one, `"false"` on the rest).

**c) `pages/contact.html` + `js/contact.js`:**
- `contact.js` currently sets `aria-selected` on the buttons, which isn't valid on a button. Change both `setAttribute("aria-selected", …)` calls to `setAttribute("aria-pressed", …)`.
- In `contact.html`, add `aria-pressed="true"` to the initially active `farmer` button and `aria-pressed="false"` to the other three.

Don't change any styling or classes.

## 8. [N23] Fix docs that no longer match the code
- **`things-to-improve.md`** (project root), line ~23 and lines ~172–174: the CSP is no longer report-only. Change the wording to say the pages use an **enforcing** `Content-Security-Policy` meta tag. Also note that `frame-ancestors` and other security headers are now set in the root `vercel.json` (added 2026-10-13). Don't rewrite anything else in that file.
- **`sakada-backend/docs/SCHEMA.md`**, the `notifications` paragraph (~line 57): replace it with this text:
  > **`notifications`** — one row per notification. Created by database triggers: `0008_notifications_trigger.sql` notifies the requester on every status change, and `0009`/`0011` notify recently active drivers when a new delivery is posted. Users can only mark their own notifications as read (`is_read`, enforced by column grants in `0016`).
- **`sakada-backend/docs/SETUP.md`**, section "6. Run remaining migrations": after the `0014` line, add lines 15–18 for `0015`–`0018`. Copy the one-line descriptions from `sakada-backend/Readme.md`. Then add one note:
  > Run 0015–0017 first, deploy the website, then run 0018 (it requires the website to send `distance_km`).
- **`sakada-backend/Readme.md`:** change "All migrations 0001–0018 are complete." to "Migrations 0001–0018 are written and applied." Nothing else.

## 9. Small leftover: noisy console warning
In `sakada-web/js/auth.js` `updateLastLogin()`, delete the `console.warn(...)` line, so a failed last-login update fails silently. Keep the function otherwise unchanged, and keep the `error` destructuring only if it's still used. If it isn't, simplify to `await supabase.rpc("update_my_last_login");`.

---

## Rules
- Plain ES modules, existing code style, no new libraries.
- `npm test` inside `sakada-web` must pass.
- The farmer dashboard, vendor dashboard and admin dashboard must still load. Make sure no import or script path is broken.

## When you're done
Reply with:
- the files changed, added and deleted
- the `diff` result from step 1
- the test result
- anything you skipped and why

The reviewer (Claude Code) will check everything.
