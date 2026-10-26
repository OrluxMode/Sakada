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
const ymdOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    // View details opens the booking's Track page.
    const track = page.locator("#trackPage");
    await expect(page).toHaveURL(/#track\/SK-00001$/);
    await expect(track).toContainText("Cabanatuan City, Nueva Ecija");
    await expect(track).toContainText(/About\s2\sh\s30\smin\sdrive/); // filled in once the route loads
    await track.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#trackTitle")).toContainText("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("a delivered notification opens the stars on its Track page", async ({ page }) => {
    const base = fixtures();
    const db = await mockSupabase(page, "farmer", {
      notifications: [{ ...base.notifications[0], delivery_id: base.deliveries[3].id, message: "Your delivery SK-00004 was delivered." }],
    });
    await page.goto("/dashboard/farmer/index.html");
    await page.locator("[data-open-notifs]").first().click();
    await page.locator("#notifList").getByText("SK-00004").click();
    const track = page.locator("#trackPage");
    await expect(page.locator("#trackTitle")).toContainText("arrived");
    await expect(track.getByRole("radio", { name: "1 star" })).toBeFocused(); // the stars, ready to pick
    await track.getByRole("radio", { name: "5 stars" }).click();
    await track.getByRole("button", { name: "Send rating" }).click();
    await expect.poll(() => db.ratings.length).toBe(1);
    await expect(track).toContainText("You rated Carlo 5 of 5");
    // The driver's average is the real one, now including this rating.
    await expect(track.locator('[aria-label="Rated 5.0 out of 5"]')).toBeVisible();
    await expect(track).toContainText("1 rating");
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

  test("farmer books a shipment in three steps", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const errors = trackErrors(page);
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    // 1 of 3: route, day and time
    await page.locator("#toDetails").click();
    await expect(page.locator("#pickupAddressError")).toBeVisible();
    // Addresses picked from the places suggested while typing
    const lookups = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/geocoding/") && !u.searchParams.has("autocomplete")) lookups.push(u.pathname);
    });
    const pickup = page.locator("#pickupAddress");
    await pickup.pressSequentially("Cabanatuan City");
    await expect(page.locator("#pickupAddressPlaces [role=option]")).toHaveCount(2);
    await expect(pickup).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#pickupAddressPlaces [role=option]").first()).toContainText("City or town · Nueva Ecija");
    await pickup.press("ArrowDown");
    await expect(pickup).toHaveAttribute("aria-activedescendant", "pickupAddressPlaces-0");
    await pickup.press("Enter"); // picks the place, doesn't leave the step
    await expect(pickup).toHaveValue("Cabanatuan City, Nueva Ecija");
    await expect(pickup).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#bookTitle")).toHaveText("Book a shipment");
    await expect(page.locator("#pickupAddressError")).toBeHidden();
    await expect(page.locator("#dropoffAddress")).toBeFocused();
    await page.locator("#dropoffAddress").pressSequentially("Marikina");
    await page.locator("#dropoffAddressPlaces").getByRole("option", { name: /Marikina Public Market/ }).click();
    await expect(page.locator("#dropoffAddress")).toHaveValue("Marikina Public Market, Marikina, Metro Manila");
    await expect(page.locator("#dropoffAddressPlaces")).toBeHidden();
    await page.locator("#quickDates button").nth(2).click();
    await expect(page.locator("#quickDates button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await page.locator("#openTime").click();
    await page.locator("#timeSheet").getByRole("button", { name: "10:00 AM–12:00 PM" }).click();
    await page.locator("#useTime").click();
    await expect(page.locator("#timeSheet")).toBeHidden();
    await expect(page.locator("#pickupTimeValue")).toHaveText("10:00 AM–12:00 PM");
    await page.locator("#toDetails").click();
    // 2 of 3: recipient and cargo
    await expect(page.locator("#bookTitle")).toHaveText("Shipment details");
    await page.locator("#toReview").click();
    await expect(page.locator("#recipientNameError")).toHaveText("Enter the name of the person who receives the goods.");
    await expect(page.locator("#recipientName")).toBeFocused();
    await page.fill("#recipientName", "Maria Santos");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#notes", "Use the side gate.");
    await page.locator("#toReview").click();
    // 3 of 3: the ticket with the fare
    await expect(page.locator("#bookTitle")).toHaveText("Check your booking");
    const ticket = page.locator("#reviewTicket");
    await expect(ticket).toContainText("₱3,526"); // 150 + 118.4 km × 15 + 800 kg × 2
    await expect(ticket).toContainText(/118\skm by road · About\s2\sh\s30\smin\sdrive/); // Mapbox's 8,880 s
    await expect(ticket).toContainText("Maria Santos");
    await expect(ticket).toContainText("10:00 AM–12:00 PM");
    await expect(ticket).toContainText("Use the side gate.");
    expect(lookups).toEqual([]); // the fare used the picked places' own points
    expect(db.deliveries).toHaveLength(6); // nothing booked until Request booking
    await page.locator("#confirmBtn").click();
    // Request sent
    await expect(page.locator("#bookTitle")).toHaveText("Request sent.");
    await expect(page.locator(".rq-bcode-value")).toHaveText("SK-00007");
    await expect(page.locator("#sentStatus")).toHaveText("Waiting for a driver");
    expect(db.deliveries).toHaveLength(7);
    expect(db.deliveries[6]).toMatchObject({
      goods_description: "Eggplant, 32 crates",
      quantity_kg: 800,
      recipient_name: "Maria Santos",
      pickup_window: "10-12",
      notes: "Use the side gate.",
    });
    await expect(page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00007" })).toContainText("Waiting for a driver");
    // Copy code puts the code on the clipboard and reads "Copied" for a moment
    const copy = page.locator("#copyCode");
    await copy.click();
    await expect(copy).toHaveAttribute("data-copied", "");
    await expect(page.locator("#copyStatus")).toHaveText("Booking code SK-00007 copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("SK-00007");
    await expect(copy).not.toHaveAttribute("data-copied", "", { timeout: 3000 });
    // Desktop: the panel starts a fresh booking
    await page.getByRole("button", { name: "Book another shipment" }).click();
    await expect(page.locator("#bookTitle")).toHaveText("Book a shipment");
    await expect(page.locator("#pickupAddress")).toHaveValue("");
    expect(errors).toEqual([]);
  });

  test("the pickup date sheet keeps past days off and sets the day", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.locator("#openDate").click();
    const sheet = page.locator("#dateSheet");
    await expect(sheet).toBeVisible();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.getMonth() === new Date().getMonth()) {
      await expect(sheet.locator(`[data-cal-date="${ymdOf(yesterday)}"]`)).toBeDisabled();
    }
    await sheet.getByRole("button", { name: "Next month" }).click();
    const next = new Date();
    next.setDate(15);
    next.setMonth(next.getMonth() + 1);
    await sheet.locator(`[data-cal-date="${ymdOf(next)}"]`).click();
    await page.locator("#useDate").click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#pickupDateValue")).toContainText(` ${next.getDate()} `);
    await expect(page.locator("#quickDates [aria-pressed='true']")).toHaveCount(0);
  });

  test("an address Mapbox can't find sends you back to the route", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "nowhere");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.locator("#toDetails").click();
    await page.fill("#recipientName", "Maria Santos");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.locator("#toReview").click();
    await expect(page.locator("#bookTitle")).toHaveText("Book a shipment");
    await expect(page.locator("#pickupAddressError")).toHaveText("We couldn't find this address. Add the town and province.");
    await expect(page.locator("#pickupAddress")).toBeFocused();
  });

  test("a typed address with no matching place says so", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    const pickup = page.locator("#pickupAddress");
    await pickup.pressSequentially("nowhere");
    await expect(page.locator(".rq-places[data-open] .rq-places-empty")).toHaveText(/No places match “nowhere”.*Check the spelling/);
    await expect(page.locator("#pickupAddressPlaces [role=option]")).toHaveCount(0);
    await pickup.press("Escape");
    await expect(pickup).toHaveAttribute("aria-expanded", "false");
    await expect(pickup).toBeFocused();
    await pickup.fill("ab"); // under 3 letters: no list
    await expect(pickup).toHaveAttribute("aria-expanded", "false");
  });

  test("pin the pickup on the map from your location", async ({ page, context }) => {
    const errors = trackErrors(page);
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 15.4865, longitude: 120.9672 });
    await page.setViewportSize(PHONE);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.getByRole("button", { name: "Pin pickup on the map" }).click();
    const sheet = page.locator("#mapSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("#mapSheetTitle")).toHaveText("Pin pickup location");
    await expect(sheet.locator(".leaflet-container")).toBeVisible(); // Leaflet loaded on demand
    await expect(sheet.locator("#mapSpotAddress")).toHaveText("Burgos Avenue, Cabanatuan City, Nueva Ecija");
    await expect(sheet.locator("#useSpot")).toBeEnabled();
    await sheet.locator("#useSpot").click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("#pickupAddress")).toHaveValue("Burgos Avenue, Cabanatuan City, Nueva Ecija");
    await expect(page.locator("#pickupPinned")).toBeVisible();
    // Opening it again starts on the pinned spot
    await page.getByRole("button", { name: "Pin pickup on the map" }).click();
    await expect(sheet.locator("#mapSpotAddress")).toHaveText("Burgos Avenue, Cabanatuan City, Nueva Ecija");
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    // Typing over it drops the pin
    await page.locator("#pickupAddress").fill("Cabanatuan City, Nueva Ecija");
    await expect(page.locator("#pickupPinned")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("with location off the map says how to pin by hand", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.locator("#dropoffAddress").pressSequentially("nowhere");
    await page.getByRole("button", { name: "Pin it on the map instead" }).click();
    const sheet = page.locator("#mapSheet");
    await expect(sheet.locator("#mapSheetTitle")).toHaveText("Pin drop-off location");
    await expect(sheet.locator("#mapSpotHint")).toHaveText(/Location is off for this site|Couldn't find your location/);
    await expect(sheet.locator("#mapSpotHint")).toHaveClass(/is-warn/);
    await expect(sheet.locator("#useSpot")).toBeEnabled(); // the spot in view can still be used
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.locator("#dropoffAddress")).toHaveValue("nowhere");
  });

  test("on a phone each Book step is a Back step", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "Cabanatuan City, Nueva Ecija");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.locator("#toDetails").click();
    await expect(page.locator("#bookTitle")).toHaveText("Shipment details");
    await page.fill("#recipientName", "Maria Santos");
    await page.goBack();
    await expect(page.locator("#bookTitle")).toHaveText("Book a shipment");
    await expect(page.locator("#dropoffAddress")).toHaveValue("Marikina Public Market, Marikina");
    await page.locator("#toDetails").click();
    await expect(page.locator("#recipientName")).toHaveValue("Maria Santos"); // kept when going back
    await page.locator("#bookBack").click();
    await expect(page.locator("#bookTitle")).toHaveText("Book a shipment");
  });

  test("Request sent opens the new booking on Track", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "Cabanatuan City, Nueva Ecija");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.locator("#toDetails").click();
    await page.fill("#recipientName", "Maria Santos");
    await page.fill("#goodsDescription", "Tomatoes, 20 crates");
    await page.fill("#quantityKg", "400");
    await page.locator("#toReview").click();
    await page.locator("#confirmBtn").click();
    await expect(page.locator(".rq-bcode-value")).toHaveText("SK-00007");
    await expect(page.getByRole("button", { name: "Back to Home" })).toBeVisible();
    await page.getByRole("button", { name: "Track this shipment" }).click();
    await expect(page).toHaveURL(/#track\/SK-00007$/);
    await expect(page.locator("#trackPage")).toContainText("SK-00007");
  });

  test("profile: log out asks first", async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(PHONE);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#profile");
    await expect(page.locator("#profileEmail")).toHaveText("farmer@example.com");
    await page.getByRole("button", { name: "Log out" }).click();
    const sheet = page.locator("#logoutSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Stay logged in" })).toBeFocused();
    await sheet.getByRole("button", { name: "Stay logged in" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#profile$/);
    await page.getByRole("button", { name: "Log out" }).click();
    await sheet.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/:4400\/(index\.html)?$/); // the landing page
    expect(errors).toEqual([]);
  });

  test("profile: How it works stays in the app and links out only on request", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#profile");
    await page.getByRole("button", { name: "How it works" }).click();
    const sheet = page.locator("#howSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".rq-how li")).toHaveCount(4);
    const web = sheet.getByRole("link", { name: /Read the full guide/ });
    await expect(web).toHaveAttribute("target", "_blank");
    await expect(web).toHaveAttribute("href", "../../pages/how-it-works.html");
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#profile$/);
  });

  test("profile: Contact Support sends from the app with the account's name and email", async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize(PHONE);
    const db = await mockSupabase(page, "vendor");
    await page.goto("/dashboard/vendor/index.html#profile");
    await page.getByRole("button", { name: "Contact Support" }).click();
    const sheet = page.locator("#contactSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("#contactReply")).toHaveText("We reply by email to vendor@example.com.");
    await expect(sheet.locator("#contactCodeField")).toBeHidden(); // no topic yet
    await sheet.getByRole("button", { name: "Send message" }).click();
    await expect(sheet.locator("#contactMessageError")).toHaveText("Write your message.");
    await sheet.getByText("Problem at drop-off").click();
    await sheet.locator("#contactCode").fill("SK12");
    await sheet.locator("#contactMessage").fill("The receiver wasn't at the stall.");
    await sheet.getByRole("button", { name: "Send message" }).click();
    await expect(sheet.locator("#contactCodeError")).toHaveText("Booking codes look like SK-00142.");
    await sheet.locator("#contactCode").fill("sk-00004");
    await sheet.getByRole("button", { name: "Send message" }).click();
    await expect(sheet.locator("#contactSentTitle")).toBeFocused();
    await expect(sheet.locator("#contactSentLead")).toHaveText("We'll reply by email to vendor@example.com. Your message is about SK-00004.");
    expect(db.contact_submissions).toHaveLength(1);
    expect(db.contact_submissions[0]).toMatchObject({
      name: "Ben Cruz",
      email: "vendor@example.com",
      role: "vendor",
      purpose: "support",
      message: "Booking code: SK-00004\n\nThe receiver wasn't at the stall.",
    });
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();
    // Opening it again starts a fresh message
    await page.getByRole("button", { name: "Contact Support" }).click();
    await expect(sheet.locator("#contactMessage")).toHaveValue("");
    await expect(sheet.locator("#contactSent")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("a shipment's Something wrong? link opens Contact Support about it", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#track/SK-00003");
    await page.getByRole("button", { name: "Something wrong? Contact Support about SK-00003" }).click();
    const sheet = page.locator("#contactSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "A booking" })).toBeChecked();
    await expect(sheet.locator("#contactCode")).toHaveValue("SK-00003");
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
    // The code opens that booking's Track page.
    await expect(page).toHaveURL(/#track\/SK-00003$/);
    const shipment = page.locator("#trackPage");
    await expect(shipment).toContainText("SK-00003");
    await expect(page.locator("#trackTitle")).toContainText("on the road");
    await expect(shipment).toContainText("Carlo Santos");
    await expect(shipment).toContainText("No ratings yet"); // a driver nobody has rated yet: no made-up stars
    await expect(shipment).toContainText("Truck here");
    await expect(shipment).not.toContainText("Message Driver");
    // Back returns to Home, where the search was.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator("#trackInput")).toBeVisible();
    await expect(page.locator("#trackInputError")).toBeHidden();
  });

  test("on a phone the Track tab lists active shipments and opens one", async ({ page }) => {
    await page.setViewportSize(PHONE);
    const base = fixtures();
    const rating = (n, by, value) => ({
      id: `00000000-0000-4000-8000-0000000a000${n}`, delivery_id: base.deliveries[3].id,
      rated_by: by, rated_user_id: IDS.driver, rating: value, comment: null, created_at: "2026-10-12T00:00:00.000Z",
    });
    // Two real ratings from two different requesters: average 4.5.
    await mockSupabase(page, "farmer", { ratings: [rating(1, IDS.farmer, 5), rating(2, IDS.vendor, 4)] });
    await page.goto("/dashboard/farmer/index.html");
    await page.locator(".rq-tabs").getByRole("link", { name: "Track" }).click();
    const track = page.locator("#trackPage");
    await expect(track.locator(".rq-track-row")).toHaveText([/SK-00003/, /SK-00002/, /SK-00001/]); // on the road first
    await track.getByRole("link", { name: /SK-00002/ }).click();
    await expect(page).toHaveURL(/#track\/SK-00002$/);
    await expect(page.locator("#trackTitle")).toContainText("assigned");
    await expect(track.locator('[aria-label="Rated 4.5 out of 5"]')).toBeVisible();
    await expect(track).toContainText("2 ratings");
    await expect(track).toContainText("The truck shows on the map once Carlo picks up your goods.");
    await page.getByRole("button", { name: "Back" }).click();
    await expect(track.locator(".rq-track-row")).toHaveCount(3);
  });

  test("the Track tab opens a lone booking, says when nothing is moving, and handles a wrong code", async ({ page }) => {
    await mockSupabase(page, "vendor"); // one booking, still waiting, and its pickup date (Oct 15) has passed
    await page.goto("/dashboard/vendor/index.html#track");
    await expect(page.locator("#trackTitle")).toContainText("Pickup date");
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0); // it's the tab itself
    await expect(page.locator("#trackPage").getByRole("button", { name: "Book a new date" })).toBeVisible();
    await expect(page.locator("#trackPage").getByRole("button", { name: "Cancel request" })).toBeVisible();

    const past = fixtures().deliveries.filter((d) => d.status === "delivered" || d.status === "cancelled");
    await mockSupabase(page, "farmer", { deliveries: past });
    await page.goto("/dashboard/farmer/index.html#track");
    await expect(page.locator("#trackTitle")).toContainText("Nothing on");
    await expect(page.locator("#trackPage").getByRole("link", { name: "Book a truck" })).toBeVisible();
    await page.goto("/dashboard/farmer/index.html#track/SK-99999");
    await expect(page.locator("#trackTitle")).toContainText("found");
    await expect(page.locator("#trackPage")).toContainText("We couldn't find SK-99999 on your account.");
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
    await expect(page.locator("#trackPage")).toContainText("Cabanatuan City, Nueva Ecija");
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
    await expect(page.locator("#trackTitle")).toBeFocused();
    await expect(page.locator("#trackPage")).toContainText("SK-00003");
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
