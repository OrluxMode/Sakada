# OpenCode task: run the tests on every push, plus 2 small fixes

Three small tasks. Don't commit.

## Files you may touch
- `.github/workflows/test.yml` (new, at the **repo root**, not inside `sakada-web/`)
- `sakada-web/js/admin-dashboard.js` (`renderPager` only)
- `sakada-web/css/admin.css` (pager block only)
- `sakada-web/js/dashboard-shared.js` (`renderNotifications` only)
- `sakada-web/css/notifications.css`

Nothing else.

---

## Part 1: GitHub Actions runs the tests on every push

Create `.github/workflows/test.yml` at the repo root with exactly this content:
```yaml
name: Tests

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: sakada-web
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: sakada-web/package-lock.json

      - run: npm ci

      - run: npm test
```
Notes:
- `npm test` runs `vitest run` (see `sakada-web/package.json`). Don't change package.json.
- Vercel isn't affected. This only adds a ✓/✗ check on GitHub.

---

## Part 2: Admin pager fits on a phone

Today on a 390px screen the pager wraps "Next" onto a second line. On narrow screens, show **[‹] Page 5 of 9 [›]**: icon-only Previous/Next buttons plus a status line, and hide the number buttons.

### 2a. `renderPager` in `js/admin-dashboard.js`
Change only the `nav.innerHTML = …` template in the multi-page branch to:
```js
  nav.innerHTML = `${range}
    <div class="pager-controls">
      <button type="button" class="pager-btn" data-page="${state.page - 1}" aria-label="Previous page"${state.page === 1 ? " disabled" : ""}>${CHEVRON_LEFT}<span class="pager-label">Previous</span></button>
      ${nums}
      <span class="pager-status">Page ${state.page} of ${state.totalPages}</span>
      <button type="button" class="pager-btn" data-page="${state.page + 1}" aria-label="Next page"${state.page === state.totalPages ? " disabled" : ""}><span class="pager-label">Next</span>${CHEVRON_RIGHT}</button>
    </div>`;
```
Everything else in `renderPager` stays the same.

### 2b. `css/admin.css`
Add right after the `.pager-gap` rule:
```css
.pager-status {
  display: none;
  font-size: 14px;
  color: var(--text-muted);
}
```
Replace the existing `@media (max-width: 600px) { .pager { … } }` block with:
```css
@media (max-width: 600px) {
  .pager {
    flex-direction: column;
    align-items: stretch;
  }
  .pager-controls {
    justify-content: space-between;
    flex-wrap: nowrap;
  }
  .pager-num,
  .pager-gap,
  .pager-label {
    display: none;
  }
  .pager-status {
    display: block;
  }
  .pager-btn {
    padding: 0;
  }
}
```

---

## Part 3: Delivery codes don't break at the hyphen in notifications

Notification messages contain codes like "SK-00142", and the browser can break the line after "SK-". In `renderNotifications` (`js/dashboard-shared.js`), wrap codes in a no-wrap span **after** sanitizing:
- Above `renderNotifications`, add:
  ```js
  // Keep delivery codes like "SK-00142" on one line. Runs on text that
  // sanitizeText already escaped, and only matches letters, digits and "-",
  // so it can't inject markup.
  const keepCodesTogether = (safeText) =>
    safeText.replace(/\bSK-\d+\b/g, (code) => `<span class="notif-code">${code}</span>`);
  ```
- In the item template, change `${sanitizeText(n.message)}` to `${keepCodesTogether(sanitizeText(n.message))}`.

In `css/notifications.css`, add after the `.notif-time` rule:
```css
.notif-code {
  white-space: nowrap;
}
```

---

## Checks before you finish
1. `cd sakada-web && npx vitest run` still passes (63).
2. `cp js/admin-dashboard.js /tmp/a.mjs && node --check /tmp/a.mjs`, and the same for `js/dashboard-shared.js`.
3. `cat .github/workflows/test.yml` (from the repo root) shows the file. YAML indentation must be spaces, not tabs.
