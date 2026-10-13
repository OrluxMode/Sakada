# OpenCode task: admin pagination, status pills, notification panel, For Farmers copy

Four small, independent tasks, all from approved Figma mockups. Do them in order. Don't commit.

## Reference
Figma file `8q1102hOL3ZvFsiePuJrQv`, page "landing page", frames to the right of "Sakada v2 lp". Each frame has a cream notes panel beside it.
- **Part A:** "Idea 3 — Admin Messages with pages" (node `33:430`)
- **Part B:** "Idea 4 — Status pill tokens" (node `33:595`)
- **Part C:** "Idea 5 — Notification panel (open / close)" (node `33:686`)

## Files you may touch
- `sakada-web/js/pagination.js` (new)
- `sakada-web/tests/pagination.test.js` (new)
- `sakada-web/js/admin-data.js`
- `sakada-web/js/admin-dashboard.js`
- `sakada-web/dashboard/admin/index.html`
- `sakada-web/css/admin.css`
- `sakada-web/css/base.css` (tokens only)
- `sakada-web/css/dashboard.css` (status pill block only)
- `sakada-web/css/notifications.css`
- `sakada-web/js/dashboard-shared.js` (`renderNotifications` and `setupNotifications` only)
- `sakada-web/dashboard/farmer/index.html`, `dashboard/vendor/index.html`, `dashboard/driver/index.html` (bell button only)
- `sakada-web/pages/for-farmers.html` (one sentence)

Nothing else.

---

## Part A: Admin pagination (25 rows per page, all 4 tables)

Today each admin table renders every row, and Messages silently stops at 200. Paginate **on the client**: the stat cards and the name lookups need the full lists, so keep fetching the full lists and only slice what's shown.

### A1. `js/pagination.js` (new, exactly this)
```js
// Client-side pagination helpers for the admin tables. Pure functions,
// no DOM, so they're easy to test.

export const PAGE_SIZE = 25;

/** Slice `items` for one page. Out-of-range pages are clamped. */
export function paginate(items, page, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  const rows = items.slice(start, start + pageSize);
  return {
    rows,
    page: current,
    totalPages,
    total,
    from: total ? start + 1 : 0,
    to: start + rows.length,
  };
}

/**
 * Page numbers to show, with "…" for gaps: always the first and last page
 * plus the pages next to the current one. Up to 7 pages are all shown.
 */
export function pageList(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const keep = [1, totalPages, page - 1, page, page + 1]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of new Set(keep)) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
```

### A2. `tests/pagination.test.js` (new)
Tests:
1. 60 items, page 1: 25 rows, `from` 1, `to` 25, `totalPages` 3.
2. 212 items, page 9: 12 rows, `from` 201, `to` 212.
3. Page 99 on 60 items clamps to page 3. Page 0 and `NaN` clamp to page 1.
4. Empty list: `page` 1, `totalPages` 1, `from` 0, `to` 0, `rows` empty.
5. `pageList(1, 5)` is `[1,2,3,4,5]`.
6. `pageList(1, 9)` is `[1,2,"…",9]`.
7. `pageList(5, 9)` is `[1,"…",4,5,6,"…",9]`.
8. `pageList(9, 9)` is `[1,"…",8,9]`.

### A3. `js/admin-data.js`
In `getContactSubmissions()`, change `.limit(200)` to `.limit(1000)`. 1000 is Supabase's default maximum rows per request. Update the doc comment above it to say messages are paginated in the UI 25 at a time.

### A4. `dashboard/admin/index.html`
In each of the 4 panels, add a pager right **after** the `<div class="table-scroll">…</div>`, inside the panel:
- `panel-deliveries`: `<nav class="pager" id="deliveriesPager" aria-label="Deliveries pages"></nav>`
- `panel-users`: `<nav class="pager" id="usersPager" aria-label="Users pages"></nav>`
- `panel-feedback`: `<nav class="pager" id="feedbackPager" aria-label="Feedback pages"></nav>`
- `panel-messages`: `<nav class="pager" id="messagesPager" aria-label="Messages pages"></nav>`

### A5. `js/admin-dashboard.js`
- `import { paginate, pageList } from "./pagination.js";`
- Add this helper below `renderTableSkeletons`:
  ```js
  const CHEVRON_LEFT = `<svg aria-hidden="true" width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M6.5 1 1.5 6l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CHEVRON_RIGHT = `<svg aria-hidden="true" width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="m1.5 1 5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /** Renders "Showing 1–25 of 212 messages" + Previous / 1 2 … 9 / Next. */
  function renderPager(nav, state, noun, onPage) {
    if (state.total === 0) {
      nav.innerHTML = "";
      return;
    }
    const range = `<p class="pager-range">Showing ${state.from}–${state.to} of ${state.total} ${noun}</p>`;
    if (state.totalPages === 1) {
      nav.innerHTML = range;
      return;
    }
    const nums = pageList(state.page, state.totalPages)
      .map((p) =>
        p === "…"
          ? `<span class="pager-gap" aria-hidden="true">…</span>`
          : `<button type="button" class="pager-btn pager-num" data-page="${p}"${p === state.page ? ' aria-current="page"' : ""} aria-label="Page ${p}">${p}</button>`,
      )
      .join("");
    nav.innerHTML = `${range}
      <div class="pager-controls">
        <button type="button" class="pager-btn" data-page="${state.page - 1}"${state.page === 1 ? " disabled" : ""}>${CHEVRON_LEFT}Previous</button>
        ${nums}
        <button type="button" class="pager-btn" data-page="${state.page + 1}"${state.page === state.totalPages ? " disabled" : ""}>Next${CHEVRON_RIGHT}</button>
      </div>`;
    nav.onclick = (e) => {
      const btn = e.target.closest("button[data-page]");
      if (btn && !btn.disabled) onPage(Number(btn.dataset.page));
    };
  }
  ```
- Restructure each loader into **fetch** and **render**. Keep the module-level lists and the current page per table:
  ```js
  const pages = { users: 1, deliveries: 1, feedback: 1, messages: 1 };
  let usersData = [];
  let deliveriesData = [];
  let ratingsData = [];
  let messagesData = [];
  ```
  - `loadStatsAndUsers()` keeps doing everything it does now: skeletons, error handling, `profilesById` and the three stat counts, all from the **full** list. Then it stores `usersData = profiles` and calls `renderUsers()`. Its row HTML moves into `renderUsers()`.
  - `renderUsers()` runs `const state = paginate(usersData, pages.users)`, sets `pages.users = state.page`, renders `state.rows` with the **exact same row HTML as today**, then calls `renderPager(document.getElementById("usersPager"), state, "users", (p) => { pages.users = p; renderUsers(); })`.
  - Do the same for deliveries (`deliveriesData`, `renderDeliveries`, noun `"deliveries"`). The stat counts and `deliveryCodeById` still come from the **full** list in `loadDeliveries()`. The cancel-button listeners move into `renderDeliveries()` and attach after the rows render. After a successful cancel it still calls `loadDeliveries()`. The page is kept because `pages.deliveries` isn't reset, and `paginate` clamps it.
  - Feedback: `ratingsData`, `renderFeedback`, noun `"ratings"`.
  - Messages: `messagesData`, `renderMessages`, noun `"messages"`.
  - Keep the existing empty-state rows ("No feedback yet." / "No messages yet.") when a list is empty. The pager is then empty (`total === 0`).
- Keep all existing `sanitizeText` calls exactly where they are.

### A6. `css/admin.css`: add at the end
```css
/* ---------- Table pager ---------- */
.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  padding-top: 20px;
}
.pager:empty {
  display: none;
}
.pager-range {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}
.pager-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 44px;
  min-height: 44px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: var(--radius-btn);
  color: var(--text-cream);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}
.pager-num {
  padding: 0;
}
.pager-btn:hover:not(:disabled) {
  border-color: var(--text-muted);
}
.pager-btn[aria-current="page"] {
  background: var(--accent-amber);
  border-color: var(--accent-amber);
  color: var(--text-on-amber);
  font-weight: 700;
}
.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pager-gap {
  min-width: 44px;
  text-align: center;
  color: var(--text-muted);
}
@media (max-width: 600px) {
  .pager {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

---

## Part B: Status pill colours (dashboards)

Today Picked Up and In Transit share one blue, and the colours are hard-coded. The `--status-*` tokens already exist in `base.css` (added for the How It Works page).

### B1. `css/base.css`
Add right after `--status-cancelled`:
```css
  --status-pending-text: #d6d2c4;
  --status-assigned-text: #f0b25a;
  --status-picked-up-text: #9fd0d8;
  --status-in-transit-text: #9cc3ee;
  --status-delivered-text: #a9d18f;
  --status-cancelled-text: #f2a98a;
```

### B2. `css/dashboard.css`
Replace the whole block from `.status-pill {` through the `.status-pill[data-status="cancelled"] { … }` rule with:
```css
.status-pill {
  --pill: var(--status-pending);
  --pill-text: var(--status-pending-text);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--pill) 45%, transparent);
  background: color-mix(in srgb, var(--pill) 14%, transparent);
  color: var(--pill-text);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.status-pill::before {
  content: "";
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pill);
}
.status-pill[data-status="pending"]::before {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--pill);
}
.status-pill[data-status="driver_assigned"] {
  --pill: var(--status-assigned);
  --pill-text: var(--status-assigned-text);
}
.status-pill[data-status="picked_up"] {
  --pill: var(--status-picked-up);
  --pill-text: var(--status-picked-up-text);
}
.status-pill[data-status="in_transit"] {
  --pill: var(--status-in-transit);
  --pill-text: var(--status-in-transit-text);
}
.status-pill[data-status="delivered"] {
  --pill: var(--status-delivered);
  --pill-text: var(--status-delivered-text);
}
.status-pill[data-status="cancelled"] {
  --pill: var(--status-cancelled);
  --pill-text: var(--status-cancelled-text);
}
```
Don't change the pill markup in any JS file. They already render `<span class="status-pill" data-status="…">`.

---

## Part C: Notification panel

### C1. Bell button in the 3 dashboards (farmer, vendor, driver `index.html`)
Replace the bell button:
```html
<button
  class="notif-bell"
  id="notifBell"
  type="button"
  aria-label="Notifications"
>
  🔔<span class="notif-badge" id="notifBadge">0</span>
</button>
```
with:
```html
<button
  class="notif-bell"
  id="notifBell"
  type="button"
  aria-label="Notifications"
  aria-expanded="false"
  aria-controls="notifPanel"
>
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2.5a5 5 0 0 0-5 5v3.2l-1.5 2.8h13L15 10.7V7.5a5 5 0 0 0-5-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 16a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="notif-badge" id="notifBadge">0</span>
</button>
```
Leave the `notif-panel` div and everything else alone.

### C2. `js/dashboard-shared.js`
- In `renderNotifications`, add a header to both branches:
  ```js
  const head = `<div class="notif-head">Notifications</div>`;
  ```
  - Empty list: `notifPanel.innerHTML = `${head}<div class="notif-empty"><strong>No notifications yet.</strong><span>Updates on your deliveries show up here.</span></div>`;`
  - Non-empty: `notifPanel.innerHTML = head + list.map(…).join("");`. The item template stays the same.
- In `setupNotifications`, replace the two click listeners with:
  ```js
  const setOpen = (open) => {
    notifPanel.classList.toggle("open", open);
    notifBell.setAttribute("aria-expanded", String(open));
  };

  notifBell.addEventListener("click", () => {
    setOpen(!notifPanel.classList.contains("open"));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-wrap")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && notifPanel.classList.contains("open")) {
      setOpen(false);
      notifBell.focus();
    }
  });
  ```

### C3. `css/notifications.css`
- `.notif-bell`: change `width`/`height` to `44px` and remove `font-size: 16px`. Add `display: inline-flex; align-items: center; justify-content: center;`.
- Replace the `.notif-panel` and `.notif-panel.open` rules with:
  ```css
  .notif-panel {
    position: absolute;
    top: 52px;
    right: 0;
    width: 320px;
    max-width: calc(100vw - 40px);
    max-height: 400px;
    overflow-y: auto;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    z-index: 20;
    visibility: hidden;
    opacity: 0;
    transform: translateY(-6px);
    pointer-events: none;
    transition:
      opacity 0.12s ease-in,
      transform 0.12s ease-in,
      visibility 0s linear 0.12s;
  }
  .notif-panel.open {
    visibility: visible;
    opacity: 1;
    transform: none;
    pointer-events: auto;
    transition:
      opacity 0.16s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
      visibility 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    .notif-panel,
    .notif-panel.open {
      transform: none;
    }
  }
  .notif-head {
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }
  ```
- Replace the `.notif-item` and `.notif-item.unread` rules with the ones below. This swaps the 2px amber left border for an amber dot:
  ```css
  .notif-item {
    position: relative;
    padding: 12px 12px 12px 30px;
    border-radius: 6px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-muted);
    cursor: pointer;
  }
  .notif-item.unread {
    background: rgba(224, 151, 47, 0.08);
    color: var(--text-cream);
    font-weight: 500;
  }
  .notif-item.unread::before {
    content: "";
    position: absolute;
    left: 12px;
    top: 19px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-amber);
  }
  ```
- Replace `.notif-empty` with:
  ```css
  .notif-empty {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 28px 12px;
    text-align: center;
  }
  .notif-empty strong {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-cream);
  }
  .notif-empty span {
    font-size: 14px;
    color: var(--text-muted);
  }
  ```
- Keep `.notif-wrap`, `.notif-badge`, `.notif-item:hover` and `.notif-time` as they are.

---

## Part D: For Farmers copy
In `pages/for-farmers.html`, change:
```html
<p>Your request goes live to available drivers nearby.</p>
```
to:
```html
<p>Your request goes live to available drivers.</p>
```
Drivers are notified nationwide, not by distance.

---

## Checks before you finish
1. `cd sakada-web && npx vitest run` passes: 55 old + 8 new = **63**.
2. `grep -rn "nearby" sakada-web --include=*.html` returns nothing.
3. `grep -rn "🔔" sakada-web/dashboard` returns nothing.
4. `node --check` each changed JS file through a `.mjs` copy, e.g. `cp js/admin-dashboard.js /tmp/a.mjs && node --check /tmp/a.mjs`.
5. Don't change any other file.
