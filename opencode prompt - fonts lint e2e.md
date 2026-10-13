# OpenCode task: self-hosted fonts everywhere, a code checker, and smoke tests

Three parts. Do them in order and run each part's checks before moving on. Don't commit.

## Files you may touch
- **Part 1:** `sakada-web/css/fonts.css`, `sakada-web/assets/fonts/` (2 new files), and the `<head>` of these 15 pages:
  - `sakada-web/pages/`: `about.html`, `contact.html`, `features.html`, `for-drivers.html`, `for-farmers.html`, `for-vendors.html`
  - `sakada-web/auth/`: `login.html`, `register.html`, `admin-login.html`, `callback.html`
  - `sakada-web/dashboard/{admin,driver,farmer,vendor}/index.html`
  - `sakada-web/404.html`
- **Part 2:** `sakada-web/package.json`, `sakada-web/package-lock.json` (via npm), `sakada-web/eslint.config.mjs` (new), and the **smallest possible** edits to JS files the linter flags
- **Part 3:** `sakada-web/playwright.config.mjs` (new), `sakada-web/e2e/smoke.spec.mjs` (new), `.gitignore` (repo root)
- **Both 2 and 3:** `.github/workflows/test.yml`

Nothing else.

---

## Part 1: self-hosted fonts on the 15 remaining pages

The landing page and How It Works already load fonts from `assets/fonts/`. These 15 pages still download them from Google on every visit.

### 1a. Two more font weights
These pages use Barlow Condensed **600** and **700**, which aren't self-hosted yet:
```bash
cd sakada-web/assets/fonts
curl -L -o barlow-condensed-600.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-600-normal.woff2"
curl -L -o barlow-condensed-700.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-700-normal.woff2"
```
Both must be over 5 KB.

In `css/fonts.css`, add two `@font-face` rules **right after the existing Barlow Condensed 900 rule**. Copy that rule exactly, including the same latin `unicode-range`, and change only `font-weight` (600 / 700) and the file name (`barlow-condensed-600.woff2` / `barlow-condensed-700.woff2`).

### 1b. The `<head>` of each of the 15 pages
For each page, with `P` = `../` for `pages/*` and `auth/*`, `../../` for `dashboard/*/`, and nothing for `404.html`:
1. **Delete** the `<link rel="preconnect" href="https://fonts.googleapis.com" />` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` lines (where present).
2. **Delete** the whole `<link … href="https://fonts.googleapis.com/css2?…" … />` stylesheet link. It spans several lines.
3. **Add** `<link rel="stylesheet" href="Pcss/fonts.css" />` on the line **directly before** the existing `Pcss/style.css` link.
4. **In the CSP meta** (all pages except `404.html`, which has none):
   - in `style-src`, remove ` https://fonts.googleapis.com` and keep everything else;
   - replace `font-src https://fonts.gstatic.com` with `font-src 'self'`.

Change nothing else in those pages.

**Checks:**
- `grep -rln "fonts.googleapis\|fonts.gstatic" sakada-web --include=*.html` returns **nothing**.
- `grep -c "css/fonts.css" <each of the 15 files>` gives 1 each.

---

## Part 2: code checker (ESLint)

### 2a. Install
```bash
cd sakada-web
npm install --save-dev eslint@9 @eslint/js@9 globals
```

### 2b. `sakada-web/eslint.config.mjs` (new, exactly this)
```js
// ESLint "flat" config. Run with: npm run lint
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  {
    // Browser code. All of it is ES modules except js/main.js.
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        DOMPurify: "readonly", // loaded from cdnjs in the dashboards
      },
    },
  },
  {
    files: ["js/main.js"],
    languageOptions: { sourceType: "script" },
  },
  {
    // Unit tests, smoke tests and config files.
    files: ["tests/**/*.js", "e2e/**/*.mjs", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
];
```

### 2c. `package.json` scripts
Replace the placeholder `"lint"` script and add one for the smoke tests:
```json
"lint": "eslint .",
"test:e2e": "playwright test"
```
Keep `dev`, `test` and `test:watch` as they are.

### 2d. Fix what the linter finds, minimally
Run `npm run lint`.
- **Fix only reported errors, with the smallest change.** For example, delete an unused import or variable, or rename an unused function argument to `_name`.
- **Don't refactor, reformat or change behaviour.** If an error can only be fixed by changing behaviour, don't fix it. Write it in your final summary instead (file:line + message), and add `// eslint-disable-next-line <rule> -- <reason>` on that line so lint passes.
- At the end, list every file you changed in this step and why.

**Checks:** `npm run lint` exits 0. `npx vitest run` still passes (66).

---

## Part 3: smoke tests with a robot browser (Playwright)

These tests open the real pages in Chromium, served locally. They do **not** log in to Supabase. The logged-in state is faked through localStorage, the same way `js/landing-auth.js` reads it.

### 3a. Install
```bash
cd sakada-web
npm install --save-dev @playwright/test serve
npx playwright install chromium
```

### 3b. `sakada-web/playwright.config.mjs` (new, exactly this)
```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4400",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx serve . -l 4400",
    url: "http://localhost:4400",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

### 3c. `sakada-web/e2e/smoke.spec.mjs` (new, exactly this)
```js
// Smoke tests: every public page loads cleanly, links aren't broken, and
// the logged-in nav / buttons point to the right place. No real Supabase
// login. The signed-in state is faked the same way js/landing-auth.js
// reads it (a role hint plus a session key in localStorage).
import { test, expect } from "@playwright/test";

const PUBLIC_PAGES = [
  "/index.html",
  "/pages/how-it-works.html",
  "/pages/for-farmers.html",
  "/pages/for-vendors.html",
  "/pages/for-drivers.html",
  "/pages/features.html",
  "/pages/about.html",
  "/pages/contact.html",
  "/auth/login.html",
  "/auth/register.html",
];

function fakeLogin(page, role) {
  return page.addInitScript((r) => {
    localStorage.setItem("sakada.role", r);
    localStorage.setItem("sb-test-auth-token", "{}");
  }, role);
}

test.describe("every public page", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} loads with no errors`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      const res = await page.goto(path);
      expect(res.ok()).toBeTruthy();
      await page.waitForLoadState("networkidle");
      expect(await page.title()).not.toBe("");
      expect(errors).toEqual([]);
    });

    test(`${path} has no broken internal links`, async ({ page, request }) => {
      await page.goto(path);
      const hrefs = await page.$$eval("a[href]", (as) =>
        as.map((a) => a.href).filter((h) => h.startsWith(location.origin)),
      );
      for (const href of new Set(hrefs.map((h) => h.split("#")[0]))) {
        const res = await request.get(href);
        expect(res.ok(), `broken link ${href}`).toBeTruthy();
      }
    });
  }
});

test.describe("logged out", () => {
  test("landing Book a Delivery goes to sign-up", async ({ page }) => {
    await page.goto("/index.html");
    const book = page.locator("[data-book-link]");
    await expect(book).toHaveAttribute("href", /auth\/register\.html/);
  });

  test("For Drivers button opens driver sign-up", async ({ page }) => {
    await page.goto("/pages/for-drivers.html");
    await expect(page.locator('[data-auth-cta="drive"]')).toHaveAttribute(
      "href",
      /register\.html\?role=driver/,
    );
  });
});

test.describe("logged in (faked)", () => {
  test("farmer sees My Dashboard and the booking form link on How It Works", async ({ page }) => {
    await fakeLogin(page, "farmer");
    await page.goto("/pages/how-it-works.html");
    const dash = page.locator(".nav-actions [data-dashboard-link]");
    await expect(dash).toBeVisible();
    await expect(dash).toHaveAttribute("href", /dashboard\/farmer\/index\.html$/);
    await expect(page.locator('.nav-actions [data-auth="guest"]').first()).toBeHidden();
    await expect(page.locator(".hiw-fare-card [data-auth-cta='book']")).toHaveAttribute(
      "href",
      /dashboard\/farmer\/index\.html#deliveryForm$/,
    );
    await expect(page.locator('[data-auth-cta="drive"]').first()).toBeHidden();
  });

  test("driver sees Find Deliveries on For Drivers", async ({ page }) => {
    await fakeLogin(page, "driver");
    await page.goto("/pages/for-drivers.html");
    const btn = page.locator('[data-auth-cta="drive"]');
    await expect(btn).toHaveText("Find Deliveries");
    await expect(btn).toHaveAttribute("href", /dashboard\/driver\/index\.html$/);
  });

  test("a made-up role stays logged out", async ({ page }) => {
    await fakeLogin(page, "superuser");
    await page.goto("/index.html");
    await expect(page.locator(".nav-actions [data-dashboard-link]")).toBeHidden();
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu opens and Escape closes it", async ({ page }) => {
    await page.goto("/index.html");
    const toggle = page.locator(".nav-toggle");
    await toggle.click();
    await expect(page.locator("#primary-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#primary-menu")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
```

### 3d. `.gitignore` (repo root)
Add under the "Live Server / local tooling" section:
```
# Playwright output
sakada-web/playwright-report/
sakada-web/test-results/
```

### 3e. Run it locally
`cd sakada-web && npm run test:e2e`. All tests must pass.
- If a test fails because the **site** is wrong, report it (file, what the test saw) instead of weakening the test.
- If it fails because a test assumption doesn't match the markup (e.g. a selector), fix the **test** minimally and say what you changed.

---

## Part 4: CI (`.github/workflows/test.yml`)

Replace the file with this. It adds the lint step and a second job for the smoke tests:
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

      - run: npm run lint

      - run: npm test

  e2e:
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

      - run: npx playwright install --with-deps chromium

      - run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: sakada-web/playwright-report
          retention-days: 7
```

## Final checks
1. `grep -rln "fonts.googleapis\|fonts.gstatic" sakada-web --include=*.html` returns nothing.
2. `cd sakada-web && npm run lint && npx vitest run && npm run test:e2e` all pass.
3. In your summary, list the JS files changed in step 2d and why.
