// Dashboards load with a fake signed-in user (e2e/support/mock-supabase.mjs).
// These are the safety net for the dashboard redesign: each page loads with
// no errors and shows its real data.
import { test, expect } from "@playwright/test";
import { mockSupabase } from "./support/mock-supabase.mjs";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test.describe("dashboards (fake sign-in)", () => {
  test("farmer sees their deliveries grouped by stage", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ana");
    const home = page.locator("#homeLists");
    const section = (name) => home.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(section("On the road")).toContainText("SK-00003");
    await expect(section("Driver assigned")).toContainText("SK-00002");
    await expect(section("Waiting for a driver")).toContainText("SK-00001");
    await expect(section("Rate your driver")).toContainText("SK-00004");
    await expect(home).not.toContainText("SK-00006"); // the vendor's
    await expect(page.getByRole("img", { name: /Step 4 of 5/ })).toBeVisible();
    await page.goto("/dashboard/farmer/index.html#history");
    await expect(page.locator("#historyList")).toContainText("SK-00004");
    await expect(page.locator("#historyList")).toContainText("SK-00005");
    expect(errors).toEqual([]);
  });

  test("farmer can cancel a delivery that is still waiting", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const card = page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00001" });
    await card.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("vendor sees only their own deliveries", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "vendor");
    await page.goto("/dashboard/vendor/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ben");
    await expect(page.locator("#homeLists")).toContainText("SK-00006");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
    expect(errors).toEqual([]);
  });

  test("farmer books a truck: fare first, then confirm", async ({ page }) => {
    const errors = trackErrors(page);
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "Cabanatuan City, Nueva Ecija");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#quoteAmount")).toHaveText("₱3,526"); // 150 + 118.4 km × 15 + 800 kg × 2
    expect(db.deliveries).toHaveLength(6); // nothing booked until confirm
    await page.locator("#confirmBtn").click();
    await expect(page.locator("#bookedBanner")).toBeVisible();
    expect(db.deliveries).toHaveLength(7);
    expect(db.deliveries[6]).toMatchObject({ goods_description: "Eggplant, 32 crates", quantity_kg: 800 });
    await expect(
      page.locator("#homeLists section").filter({ has: page.getByRole("heading", { name: "Waiting for a driver" }) }),
    ).toContainText("SK-00007");
    expect(errors).toEqual([]);
  });

  test("an address Mapbox can't find gets a plain error and no fare", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "nowhere");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#pickupAddressError")).toHaveText("We couldn't find this address. Add the town and province.");
    await expect(page.locator("#pickupAddress")).toBeFocused();
    await expect(page.locator("#quote")).toBeHidden();
  });

  test("on a phone the tabs switch views and the landing link opens Book", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#deliveryForm");
    await expect(page.locator("#deliveryForm")).toBeVisible();
    const tabs = page.locator(".rq-tabs");
    await tabs.getByRole("link", { name: "History" }).click();
    await expect(page.locator("#historyList")).toBeVisible();
    await expect(page.locator("#deliveryForm")).toBeHidden();
    await tabs.getByRole("link", { name: "Home" }).click();
    await expect(page.locator("#homeLists")).toBeVisible();
  });

  test("a notification opens its delivery", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await page.locator("[data-open-notifs]").first().click();
    await expect(page.locator("#notifSheet")).toBeVisible();
    await page.locator("#notifList").getByText("SK-00003").click();
    await expect(page.locator("#notifSheet")).toBeHidden();
    await expect(page.locator("[data-delivery-id]", { hasText: "SK-00003" })).toBeFocused();
    await expect.poll(() => db.notifications[0].is_read).toBe(true);
  });

  test("driver sees available jobs, their own jobs and their vehicle", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await expect(page.locator("#userName")).toHaveText("Carlo Santos");
    await expect(page.getByText("SK-00001")).toBeVisible(); // available (pending, no driver)
    await expect(page.getByText("SK-00003")).toBeVisible(); // assigned to them, in transit
    await expect(page.locator("#vehicleType")).toHaveValue("6-wheeler truck");
    expect(errors).toEqual([]);
  });

  test("admin sees the stats and the deliveries table", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "admin");
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#userName")).toHaveText("Dina Admin");
    await expect(page.getByRole("cell", { name: "SK-00001" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a farmer opening the driver dashboard is sent home", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/driver/index.html");
    await expect(page).toHaveURL(/\/index(\.html)?$|\/$/);
  });
});
