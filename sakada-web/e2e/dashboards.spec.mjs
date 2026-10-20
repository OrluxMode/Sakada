// Dashboards load with a fake signed-in user (e2e/support/mock-supabase.mjs).
// These are the safety net for the dashboard redesign: each page loads with
// no errors and shows its real data.
import { test, expect } from "@playwright/test";
import { mockSupabase, fixtures, IDS } from "./support/mock-supabase.mjs";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

// The driver holds one job (SK-00002, accepted); SK-00001 and SK-00006 are open.
const oneJob = () => fixtures().deliveries.filter((d) => d.delivery_code !== "SK-00003");
const PHONE = { width: 390, height: 844 }; // the next-step bar is phone-only
const code = (db, c) => db.deliveries.find((d) => d.delivery_code === c);
// Pickup dates must be today or later, so book two days ahead of whenever the test runs.
const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
    // Things that need the farmer sit on top: the late request and the rating.
    await expect(section("Needs you")).toContainText("drivers can't see it anymore");
    await expect(section("Needs you").getByRole("button", { name: /Rate 1 driver/ })).toBeVisible();
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
    await expect(card.getByRole("button", { name: "Cancel request" })).toBeHidden(); // rows start closed
    await card.locator(".rq-item-head").click();
    await card.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("rating drivers one by one keeps the skipped ones on Home", async ({ page }) => {
    const base = fixtures().deliveries;
    const second = { ...base[3], id: "00000000-0000-4000-8000-0000000de009", delivery_code: "SK-00009" };
    const db = await mockSupabase(page, "farmer", { deliveries: [...base, second] });
    await page.goto("/dashboard/farmer/index.html");
    await page.getByRole("button", { name: /Rate 2 drivers/ }).click();
    const sheet = page.locator("#rateSheet");
    await expect(sheet).toContainText("1 of 2");
    await sheet.getByRole("radio", { name: "5 stars" }).click();
    await sheet.getByRole("button", { name: "Send rating" }).click();
    await expect(sheet).toContainText("2 of 2");
    await sheet.getByRole("button", { name: "Skip for now" }).click();
    await expect(sheet).toBeHidden();
    expect(db.ratings).toHaveLength(1);
    await expect(page.getByRole("button", { name: /Rate 1 driver/ })).toBeVisible(); // the skipped one stays
  });

  test("a late request is booked again with a new date", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const needs = page.locator(".rq-needs");
    await needs.getByRole("button", { name: "Book a new date" }).click();
    const sheet = page.locator("#newDateSheet");
    await expect(sheet).toContainText("Eggplant, 32 crates");
    await expect(sheet).toContainText("₱3,550"); // 150 + 120 km × 15 + 800 kg × 2, the same fare
    await sheet.getByRole("button", { name: /Confirm booking/ }).click();
    await expect(page.locator("#newDateError")).toHaveText("Pick a pickup date.");
    await page.fill("#newDateInput", futureDate());
    await sheet.getByRole("button", { name: /Confirm booking/ }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => code(db, "SK-00001").status).toBe("cancelled");
    expect(db.deliveries.filter((d) => d.status === "pending" && d.goods_description === "Eggplant, 32 crates")).toHaveLength(1);
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
    await page.fill("#scheduledPickup", futureDate());
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
    await page.fill("#scheduledPickup", futureDate());
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

  test("driver sees their 2 jobs, the cap on new jobs and their vehicle", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("2 jobs in progress");
    await expect(page.locator(".dv-job")).toContainText("SK-00003"); // on the road, so it's shown first
    await expect(page.locator(".dv-job")).toContainText("Receiver is at stall 14");
    await expect(page.getByRole("img", { name: "Step 3 of 4, In transit" })).toBeVisible();
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("#jobsList")).toContainText("SK-00001");
    await expect(page.locator("#jobsMessage")).toContainText("You have 2 jobs");
    await expect(page.locator("[data-accept-id]")).toHaveCount(0); // Accept is off at the cap
    await page.goto("/dashboard/driver/index.html#profile");
    await expect(page.locator("#vehicleType")).toHaveValue("6-wheeler truck");
    expect(errors).toEqual([]);
  });

  test("driver marks picked up; it saves after the Undo time", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.clock.install();
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html");
    const bar = page.locator("#actionBar");
    await bar.getByRole("button", { name: "I've picked up the load" }).click();
    await expect(page.locator("#snackbar")).toContainText("Marked picked up");
    expect(code(db, "SK-00002").status).toBe("driver_assigned"); // not yet: Undo is still open
    await page.clock.runFor(9000);
    await expect.poll(() => code(db, "SK-00002").status).toBe("picked_up");
    await expect(page.locator("#snackbar")).toContainText('The sender sees "Picked up"');
    await expect(bar.getByRole("button", { name: "I'm driving to drop-off" })).toBeVisible();
  });

  test("Undo leaves the job as it was", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.clock.install();
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html");
    await page.locator("#actionBar").getByRole("button", { name: "I've picked up the load" }).click();
    await page.locator("#snackbar").getByRole("button", { name: "Undo" }).click();
    await page.clock.runFor(12000);
    expect(code(db, "SK-00002").status).toBe("driver_assigned");
    await expect(page.locator("#actionBar").getByRole("button", { name: "I've picked up the load" })).toBeVisible();
  });

  test("delivered without payment closes the job and flags it Unpaid", async ({ page }) => {
    await page.setViewportSize(PHONE);
    const db = await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await page.locator("#actionBar").getByRole("button", { name: "I've delivered it" }).click();
    const sheet = page.locator("#deliveredSheet");
    await expect(sheet).toContainText("₱3,550 in cash?");
    await sheet.getByRole("button", { name: "Delivered, not paid" }).click();
    await expect.poll(() => code(db, "SK-00003").status).toBe("delivered");
    expect(code(db, "SK-00003").payment_status).toBe("unpaid");
    await expect(page.locator(".dv-rated")).toContainText("Marked Unpaid");
    await page.goto("/dashboard/driver/index.html#history");
    await expect(page.locator("#historyList [data-delivery-id]", { hasText: "SK-00003" })).toContainText("Unpaid");
  });

  test("driver accepts a job after a confirm", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    await expect(page.locator("#acceptSheet")).toContainText("Once you accept, only Sakada can cancel it.");
    await page.locator("#acceptConfirm").click();
    await expect.poll(() => code(db, "SK-00001").status).toBe("driver_assigned");
    expect(code(db, "SK-00001").driver_id).toBe(IDS.driver);
    await expect(page.locator("#homeTitle")).toHaveText("2 jobs in progress");
    await expect(page.locator(".dv-job")).toContainText("SK-00001");
  });

  test("a job someone else took shows 'no longer available'", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    Object.assign(code(db, "SK-00001"), { status: "driver_assigned", driver_id: "someone-else" });
    await page.locator("#acceptConfirm").click();
    await expect(page.locator("#jobsMessage")).toContainText("This job is no longer available");
    await expect(page.locator("#jobsList")).not.toContainText("SK-00001");
  });

  test("the database's 2-job rule shows in plain words", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    Object.assign(code(db, "SK-00006"), { status: "driver_assigned", driver_id: IDS.driver }); // took one on another phone
    await page.locator("#acceptConfirm").click();
    await expect(page.locator("#jobsMessage")).toContainText("You have 2 jobs");
    expect(code(db, "SK-00001").status).toBe("pending");
  });

  test("a new driver adds their vehicle before accepting", async ({ page }) => {
    const db = await mockSupabase(page, "driver", {
      deliveries: fixtures().deliveries.filter((d) => d.status === "pending"),
      driver_profiles: [{ id: IDS.driver, vehicle_type: null, vehicle_plate: null, is_available: true }],
    });
    await page.goto("/dashboard/driver/index.html");
    await expect(page.getByRole("heading", { name: "Add your vehicle" })).toBeVisible();
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("#jobsMessage")).toContainText("Add your vehicle first");
    await expect(page.locator("[data-accept-id]")).toHaveCount(0);
    await page.goto("/dashboard/driver/index.html#profile");
    await page.fill("#vehicleType", "Isuzu Elf");
    await page.fill("#vehiclePlate", "abc 123");
    await page.locator("#vehicleSaveBtn").click();
    await expect(page.locator("#snackbar")).toContainText("Vehicle saved");
    expect(db.driver_profiles[0].vehicle_plate).toBe("ABC 123");
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("[data-accept-id]").first()).toBeVisible();
  });

  test("admin sees the stats and the deliveries table", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "admin");
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#userName")).toHaveText("Dina Admin");
    await expect(page.getByRole("cell", { name: "SK-00001" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("admin sees deliveries the receiver didn't pay for", async ({ page }) => {
    const deliveries = fixtures().deliveries;
    Object.assign(deliveries[3], { payment_status: "unpaid" }); // SK-00004, delivered
    await mockSupabase(page, "admin", { deliveries });
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#statUnpaid")).toHaveText("1");
    await expect(page.getByRole("row", { name: /SK-00004/ })).toContainText("Unpaid");
  });

  test("a farmer opening the driver dashboard is sent home", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/driver/index.html");
    await expect(page).toHaveURL(/\/index(\.html)?$|\/$/);
  });
});
