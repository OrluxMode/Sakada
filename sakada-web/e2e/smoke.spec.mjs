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
    await expect(page.locator('[data-auth-cta="drive"]').first()).toHaveAttribute(
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
    const btn = page.locator('[data-auth-cta="drive"]').first();
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

test.describe("contact form", () => {
  test("empty send shows field errors and sends nothing", async ({ page }) => {
    let posted = false;
    await page.route("**/rest/v1/contact_submissions**", (route) => {
      posted = true;
      return route.abort();
    });
    await page.goto("/pages/contact.html");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactNameError")).toHaveText("Enter your name.");
    await expect(page.locator("#contactEmailError")).toHaveText("Enter your email.");
    await expect(page.locator("#contactMessageError")).toHaveText("Write your message.");
    await expect(page.locator("#contactName")).toBeFocused();
    expect(posted).toBe(false);
  });

  test("booking code field only shows for booking topics", async ({ page }) => {
    await page.goto("/pages/contact.html");
    await expect(page.locator("#contactCodeField")).toBeHidden();
    await page.selectOption("#contactPurpose", "booking");
    await expect(page.locator("#contactCodeField")).toBeVisible();
    await page.selectOption("#contactPurpose", "other");
    await expect(page.locator("#contactCodeField")).toBeHidden();
  });

  test("a failed send keeps the message and offers Try again", async ({ page }) => {
    await page.route("**/rest/v1/contact_submissions**", (route) => route.abort());
    await page.goto("/pages/contact.html");
    await page.fill("#contactName", "Ana Reyes");
    await page.fill("#contactEmail", "ana.reyes@email.com");
    await page.fill("#contactMessage", "Test message");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactSendError")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("#contactMessage")).toHaveValue("Test message");
  });

  test("has no phone field and no fake contact details", async ({ page }) => {
    await page.goto("/pages/contact.html");
    await expect(page.locator("#contactPhone")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("hello@sakadalogistics.ph");
    expect(body).not.toContain("8800");
    expect(body).not.toContain("2 hours");
  });
});


test.describe("email typos are caught", () => {
  test("register blocks gmail.co and one tap fixes it", async ({ page }) => {
    let called = false;
    await page.route("**/auth/v1/**", (route) => {
      called = true;
      return route.abort();
    });
    await page.goto("/auth/register.html");
    await page.fill("#fullName", "Ana Reyes");
    await page.fill("#email", "name@gmail.co");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.locator("#emailError")).toContainText("Did you mean name@gmail.com?");
    expect(called).toBe(false);
    await page.getByRole("button", { name: "Use name@gmail.com" }).click();
    await expect(page.locator("#email")).toHaveValue("name@gmail.com");
    await expect(page.locator("#emailError")).toBeHidden();
  });

  test("contact blocks gmail.co", async ({ page }) => {
    let posted = false;
    await page.route("**/rest/v1/contact_submissions**", (route) => {
      posted = true;
      return route.abort();
    });
    await page.goto("/pages/contact.html");
    await page.fill("#contactName", "Ana Reyes");
    await page.fill("#contactEmail", "name@gmail.co");
    await page.fill("#contactMessage", "Hello");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactEmailError")).toContainText("Did you mean name@gmail.com?");
    expect(posted).toBe(false);
  });

  test("login rejects a badly formed email", async ({ page }) => {
    await page.goto("/auth/login.html");
    await page.fill("#email", "juan@gmail");
    await page.fill("#password", "x");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.locator("#emailError")).toContainText("doesn't look right");
  });
});

test("₱ and → use our own fonts, not a system fallback", async ({ page }) => {
  await page.goto("/pages/for-farmers.html");
  await page.waitForLoadState("networkidle");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => f.unicodeRange.toUpperCase());
  });
  expect(loaded.some((r) => r.includes("U+20B1") && r.includes("U+2192"))).toBe(true);
});

test.describe("landing theme on the inner pages", () => {
  for (const path of ["/pages/how-it-works.html", "/pages/for-farmers.html", "/pages/for-vendors.html", "/pages/for-drivers.html", "/pages/contact.html"]) {
    test(`${path} has the dusk photo hero and the grid`, async ({ page }) => {
      await page.goto(path);
      const result = await page.evaluate(() => {
        const hero = document.querySelector(".hiw-hero, .rp-hero, .ct-hero");
        return {
          themed: document.body.classList.contains("theme-dusk"),
          grid: getComputedStyle(document.body).backgroundImage.includes("linear-gradient"),
          photo: getComputedStyle(hero, "::before").backgroundImage.includes("hero"),
        };
      });
      expect(result).toEqual({ themed: true, grid: true, photo: true });
    });
  }

  test("the landing page is untouched", async ({ page }) => {
    await page.goto("/index.html");
    expect(await page.evaluate(() => document.body.classList.contains("theme-dusk"))).toBe(false);
  });
});
