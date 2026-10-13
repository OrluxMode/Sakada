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
