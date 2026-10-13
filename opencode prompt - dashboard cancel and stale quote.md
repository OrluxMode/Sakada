# OpenCode task: fix the stale quote (N15) and let requesters cancel (N14)

Two user-facing bugs in the farmer and vendor dashboards. The finding numbers refer to `claude read and analyze.md`. Don't commit.

`js/farmer-dashboard.js` and `js/vendor-dashboard.js` are identical apart from the role name. **Make the exact same changes in both.** Don't merge them into one file; that's a separate task (N12).

## Files you may touch
- `sakada-web/js/farmer-dashboard.js`
- `sakada-web/js/vendor-dashboard.js`
- `sakada-web/js/deliveries.js`
- `sakada-web/js/dashboard-shared.js`
- `sakada-web/css/dashboard.css`
- `sakada-web/tests/dashboard-shared.test.js`

Nothing else. The database side is already done: RLS and the 0016 guard trigger allow a requester to change their own delivery from `pending` to `cancelled`, and nothing else.

---

## 1. [N15] A quote must match the form when you book
**Bug:** the user clicks "Get Estimated Cost", then edits the pickup, drop-off or load, then clicks "Confirm Delivery". The booking uses the **old** addresses and load stored in `pendingQuote`.

**a) Add a pure helper to `js/dashboard-shared.js`:**
```js
/**
 * True when the form no longer matches the quote the user saw, so the
 * quote must not be booked. Addresses compare trimmed; load compares
 * as a number.
 */
export function isQuoteStale(quote, form) {
  if (!quote) return true;
  return (
    quote.pickupAddress !== form.pickupAddress.trim() ||
    quote.dropoffAddress !== form.dropoffAddress.trim() ||
    quote.quantityKg !== parseFloat(form.quantityKg)
  );
}
```

**b) Drop the quote as soon as the form changes.** In both dashboards, after `let pendingQuote = null;`, add an `input` listener on the three fields `#pickupAddress`, `#dropoffAddress` and `#quantityKg`. When one fires and a quote exists:
- set `pendingQuote = null`
- remove `visible` from `costPreview`
- call `toastInfo("Details changed. Get a new estimate before booking.")`

Import `toastInfo` alongside the existing `toastSuccess` and `toastError`. Only show the toast when a quote was actually showing, not on every keystroke.

**c) Double-check in the confirm handler.** At the top of the `confirmBtn` click handler, right after `if (!pendingQuote) return;`, add:
```js
if (isQuoteStale(pendingQuote, {
  pickupAddress: document.getElementById("pickupAddress").value,
  dropoffAddress: document.getElementById("dropoffAddress").value,
  quantityKg: document.getElementById("quantityKg").value,
})) {
  pendingQuote = null;
  costPreview.classList.remove("visible");
  toastError("Details changed. Get a new estimate before booking.");
  return;
}
```
Import `isQuoteStale` from `./dashboard-shared.js`.

## 2. [N14] Farmers and vendors can cancel their own pending request
**a) In `js/deliveries.js`**, add the function below after `createDelivery`:
```js
/**
 * Requester cancels their own delivery. Only works while it is still
 * pending. The .eq() filters keep a stale screen from cancelling a
 * delivery a driver has just accepted, and RLS plus the 0016 guard
 * trigger enforce the same rule in the database.
 */
export async function cancelMyDelivery(deliveryId, requesterId) {
  return await supabase
    .from("deliveries")
    .update({ status: "cancelled" })
    .eq("id", deliveryId)
    .eq("requester_id", requesterId)
    .eq("status", "pending")
    .select()
    .single();
}
```

**b) In both dashboards' `loadDeliveries()`**, add this as the last line inside each **active** delivery card (after `${renderMapBlock(d)}`), shown **only when `d.status === "pending"`**:
```html
<div class="delivery-card-actions">
  <button type="button" class="btn-small danger" data-cancel-id="${sanitizeText(d.id)}">Cancel request</button>
</div>
```

**c) Wire the buttons.** Right after `activeEl.innerHTML = …`, wire every `[data-cancel-id]` inside `activeEl`. Follow the same pattern as the admin dashboard (`js/admin-dashboard.js` ~line 148):
- If `getIsOffline()`: `toastError("Can't cancel — you're offline")`, then stop.
- Ask `confirm("Cancel this delivery request? This can't be undone.")`. If the user says no, stop.
- Disable the button and set `btn.innerHTML = '<span class="spinner"></span>Cancelling…'`.
- Call `cancelMyDelivery(btn.dataset.cancelId, profile.id)`.
- **On error:**
  - re-enable the button and restore its text to "Cancel request"
  - `toastError("Couldn't cancel: " + error.message)`
  - if the message suggests no row matched (a driver accepted it meanwhile), call `loadDeliveries()` to refresh
- **On success:** `toastSuccess("Delivery request cancelled")`, then `loadDeliveries()`.

Import `cancelMyDelivery` from `./deliveries.js`.

**d) Styles in `css/dashboard.css`** (append at the end). The red outline style currently exists only inside the admin table (`css/admin.css`, `.data-table .btn-small.danger`). Add a general version for cards, with a proper tap size:
```css
.delivery-card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.btn-small.danger {
  background: transparent;
  border: 1px solid #e0542f;
  color: #f2a98a;
  min-height: 44px;
}
.btn-small.danger:hover:not(:disabled),
.btn-small.danger:focus-visible {
  background: rgba(224, 84, 47, 0.12);
}
```

## 3. Tests
In `sakada-web/tests/dashboard-shared.test.js`, add a `describe("isQuoteStale")` block with these cases:
- same values (with extra spaces around the addresses) → `false`
- changed pickup → `true`
- changed drop-off → `true`
- changed load (`"500"` vs a quote of `400`) → `true`
- `quote` is `null` → `true`

---

## Rules
- Plain ES modules and the existing code style. No new libraries.
- No other behavior changes. Admin and driver dashboards stay untouched.
- `npm test` must pass.

## When you're done
Run `npm test` inside `sakada-web`, then reply with:
- the files you changed
- the test count
- anything you couldn't do

The reviewer (Claude Code) will check it.
