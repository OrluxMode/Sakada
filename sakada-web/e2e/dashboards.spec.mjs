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
  test("farmer sees status counts and one card per active shipment", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Ana");
    await expect(page.getByRole("button", { name: "1 Waiting" })).toBeVisible();
    await expect(page.getByRole("button", { name: "2 On the road" })).toBeVisible();
    await expect(page.getByRole("button", { name: "1 Delivered" })).toBeVisible();
    const home = page.locator("#homeLists");
    await expect(page.getByRole("heading", { name: /Active shipments/ })).toBeVisible();
    // On the road first, then assigned, then waiting.
    await expect(home.locator(".rq-ship-what")).toHaveText([/SK-00003/, /SK-00002/, /SK-00001/]);
    await expect(home.locator("[data-delivery-id]", { hasText: "SK-00001" })).toContainText("Pickup date passed");
    await expect(home).not.toContainText("SK-00006"); // the vendor's
    await expect(home).not.toContainText("SK-00004"); // delivered: History only
    // Each card shows the real road on a map, with the truck once it's on the way.
    await expect(page.getByRole("img", { name: /Map of the road from Cabanatuan City to Marikina Public Market, with the truck/ })).toHaveCount(1);
    await expect(page.getByRole("img", { name: /Map of the road from Cabanatuan City/ })).toHaveCount(3);
    await page.goto("/dashboard/farmer/index.html#history");
    await expect(page.locator("#historyList")).toContainText("SK-00004");
    await expect(page.locator("#historyList")).toContainText("SK-00005");
    expect(errors).toEqual([]);
  });

  test("farmer can cancel a delivery that is still waiting", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const card = page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00001" });
    await card.getByRole("button", { name: "View details" }).click();
    const details = page.locator("#detailsSheet");
    await expect(details).toContainText("Cabanatuan City, Nueva Ecija");
    await details.getByRole("button", { name: "Cancel request" }).click();
    await expect(details).toBeHidden();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("a delivered notification opens the stars on that delivery", async ({ page }) => {
    const base = fixtures();
    const db = await mockSupabase(page, "farmer", {
      notifications: [{ ...base.notifications[0], delivery_id: base.deliveries[3].id, message: "Your delivery SK-00004 was delivered." }],
    });
    await page.goto("/dashboard/farmer/index.html");
    await page.locator("[data-open-notifs]").first().click();
    await page.locator("#notifList").getByText("SK-00004").click();
    const card = page.locator("#historyList [data-delivery-id]", { hasText: "SK-00004" });
    await expect(card.getByRole("radio", { name: "1 star" })).toBeFocused(); // the stars open, ready to pick
    await card.getByRole("radio", { name: "5 stars" }).click();
    await card.getByRole("button", { name: "Send rating" }).click();
    await expect.poll(() => db.ratings.length).toBe(1);
    await expect(page.locator("#historyList [data-delivery-id]", { hasText: "SK-00004" })).toContainText("You rated Carlo 5 of 5");
  });

  test("a late request is booked again with a new date", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    // Late requests wait in the notifications sheet, and count on the bell.
    await expect(page.locator("[data-open-notifs]").first()).toHaveAttribute("aria-label", "Notifications, 2 unread");
    await page.locator("[data-open-notifs]").first().click();
    const needs = page.locator("#notifNeeds");
    await expect(needs).toContainText("drivers can't see it anymore");
    await needs.getByRole("button", { name: "Book a new date" }).click();
    await expect(page.locator("#notifSheet")).toBeHidden();
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
    await expect(page.locator("#homeTitle")).toHaveText("Ben");
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
    await expect(page.locator("#bookedBanner")).toBeHidden({ timeout: 4000 }); // fades after 2 seconds
    expect(db.deliveries).toHaveLength(7);
    expect(db.deliveries[6]).toMatchObject({ goods_description: "Eggplant, 32 crates", quantity_kg: 800 });
    await expect(page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00007" })).toContainText("Waiting for a driver");
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

  test("Track finds a booking by its code", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const track = page.locator("#trackForm");
    await track.getByRole("button", { name: "Track" }).click();
    await expect(page.locator("#trackInputError")).toHaveText("Type a booking code, like SK-00142.");
    await page.fill("#trackInput", "SK-99999");
    await page.keyboard.press("Enter");
    await expect(page.locator("#trackInputError")).toContainText("Nothing on your account matches");
    await page.fill("#trackInput", "sk3");
    await page.keyboard.press("Enter");
    await expect(page.locator("#detailsSheet")).toBeVisible();
    await expect(page.locator("#detailsSheet")).toContainText("SK-00003");
    await expect(page.locator("#trackInputError")).toBeHidden();
  });

  test("on a phone the shipments are swiped one card at a time", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#shipPos")).toHaveText("1 of 3");
    await page.getByRole("button", { name: "Show SK-00001" }).click();
    await expect(page.locator("#shipPos")).toHaveText("3 of 3");
    await expect(page.getByRole("button", { name: "Show SK-00001" })).toHaveAttribute("aria-current", "true");
    // Tapping the card itself opens its details.
    await page.locator("#shipList [data-delivery-id]", { hasText: "SK-00001" }).locator(".rq-ship-ends").click();
    await expect(page.locator("#detailsSheet")).toContainText("Cabanatuan City, Nueva Ecija");
  });

  test("the Delivered tile opens History filtered to delivered", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await page.getByRole("button", { name: "1 Delivered" }).click();
    await expect(page.locator("#historyList")).toContainText("SK-00004");
    await expect(page.locator("#historyList")).not.toContainText("SK-00005");
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
