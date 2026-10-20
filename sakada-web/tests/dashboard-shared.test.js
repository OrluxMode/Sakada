import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

// Mock the notifications module (it imports from https URLs)
vi.mock("../js/notifications.js", () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

// Inject into global so sanitize.js can use it (same as sanitize.test.js)
globalThis.DOMPurify = DOMPurify(new JSDOM("").window);

import {
  statusLabel,
  timeAgo,
  HISTORY_STATUSES,
  renderRatingBlock,
  isQuoteStale,
  renderDriverLine,
  rebookValues,
  findDelivery,
  shipmentProgress,
} from "../js/dashboard-shared.js";

describe("HISTORY_STATUSES", () => {
  it("contains delivered and cancelled", () => {
    expect(HISTORY_STATUSES).toContain("delivered");
    expect(HISTORY_STATUSES).toContain("cancelled");
  });

  it("does not contain active statuses", () => {
    expect(HISTORY_STATUSES).not.toContain("pending");
    expect(HISTORY_STATUSES).not.toContain("driver_assigned");
    expect(HISTORY_STATUSES).not.toContain("picked_up");
    expect(HISTORY_STATUSES).not.toContain("in_transit");
  });
});

describe("statusLabel", () => {
  it("returns human-readable labels for all known statuses", () => {
    expect(statusLabel("pending")).toBe("Pending");
    expect(statusLabel("driver_assigned")).toBe("Driver Assigned");
    expect(statusLabel("picked_up")).toBe("Picked Up");
    expect(statusLabel("in_transit")).toBe("In Transit");
    expect(statusLabel("delivered")).toBe("Delivered");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });

  it("returns the raw status for unknown values", () => {
    expect(statusLabel("unknown_status")).toBe("unknown_status");
    expect(statusLabel("")).toBe("");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("2d ago");
  });

  it("handles exactly 1 minute", () => {
    const d = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1m ago");
  });

  it("handles exactly 1 hour", () => {
    const d = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1h ago");
  });

  it("handles exactly 1 day", () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1d ago");
  });
});

describe("renderRatingBlock", () => {
  const delivered = {
    id: "delivery-1",
    status: "delivered",
    driver_id: "driver-123",
    requester_id: "requester-456",
  };

  it("rates the requester when the viewer is the driver", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated the requester",
      "driver-123",
    );
    expect(html).toContain('data-other-user-id="requester-456"');
  });

  it("rates the driver when the viewer is the requester", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated this delivery",
      "requester-456",
    );
    expect(html).toContain('data-other-user-id="driver-123"');
  });
});

describe("isQuoteStale", () => {
  const quote = {
    pickupAddress: "La Trinidad, Benguet",
    dropoffAddress: "Baguio City",
    quantityKg: 400,
  };

  it("returns false when the form matches the quote (addresses trimmed)", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "  La Trinidad, Benguet  ",
        dropoffAddress: " Baguio City ",
        quantityKg: "400",
      }),
    ).toBe(false);
  });

  it("returns true when the pickup changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "Bugallon, Pangasinan",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the drop-off changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Dagupan City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the load changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "500",
      }),
    ).toBe(true);
  });

  it("returns true when there is no quote", () => {
    expect(
      isQuoteStale(null, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });
});

describe("renderDriverLine", () => {
  it("returns an empty string without a driver or a name", () => {
    expect(renderDriverLine(undefined)).toBe("");
    expect(renderDriverLine({ driver_name: null })).toBe("");
  });

  it("shows name, vehicle type and plate", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: "Isuzu Elf",
      vehicle_plate: "NBC 1234",
    });
    expect(html).toContain("Juan Dela Cruz");
    expect(html).toContain("Isuzu Elf · NBC 1234");
    expect(html).toContain('class="delivery-driver"');
  });

  it("says the vehicle isn't added yet when both fields are missing", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).toContain("Vehicle not added yet");
  });

  it("sanitizes the driver name", () => {
    const html = renderDriverLine({
      driver_name: "<img src=x onerror=alert(1)>Ana",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).not.toContain("<img");
  });
});

describe("rebookValues", () => {
  it("copies route, goods and weight, stringifying the weight", () => {
    expect(
      rebookValues({
        pickup_address: "A",
        dropoff_address: "B",
        goods_description: "Eggplant",
        quantity_kg: 500,
      }),
    ).toEqual({
      pickupAddress: "A",
      dropoffAddress: "B",
      goodsDescription: "Eggplant",
      quantityKg: "500",
    });
  });

  it("turns missing fields into empty strings", () => {
    expect(rebookValues({})).toEqual({
      pickupAddress: "",
      dropoffAddress: "",
      goodsDescription: "",
      quantityKg: "",
    });
  });
});

import {
  renderStageStepper,
  initialsFor,
  groupActive,
  homeSummary,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  bookingErrorCopy,
  contactUrl,
} from "../js/dashboard-shared.js";

describe("renderStageStepper", () => {
  it("labels the current step for screen readers", () => {
    const html = renderStageStepper("in_transit");
    expect(html).toContain('aria-label="Step 4 of 5, In transit"');
    expect(html.match(/rq-step--done/g)).toHaveLength(3);
    expect(html.match(/rq-step--current/g)).toHaveLength(1);
    expect(html).toContain("Next: Delivered");
  });
  it("shows Pending as waiting, not as progress", () => {
    const html = renderStageStepper("pending");
    expect(html).toContain("Step 1 of 5, Waiting for a driver");
    expect(html).toContain("rq-step--waiting");
  });
  it("draws nothing for cancelled", () => {
    expect(renderStageStepper("cancelled")).toBe("");
  });
});

describe("initialsFor", () => {
  it("uses first and last name", () => expect(initialsFor("Ana Maria Reyes")).toBe("AR"));
  it("handles one name and blanks", () => {
    expect(initialsFor("carlo")).toBe("C");
    expect(initialsFor("  ")).toBe("?");
  });
  it("skips a name suffix", () => {
    expect(initialsFor("Maria Concepcion Villanueva-Dela Cruz III")).toBe("MC");
    expect(initialsFor("Juan Santos Jr.")).toBe("JS");
    expect(initialsFor("Jr")).toBe("J");
  });
});

describe("groupActive and homeSummary", () => {
  const list = [
    { status: "pending" },
    { status: "driver_assigned" },
    { status: "picked_up" },
    { status: "in_transit" },
  ];
  it("splits active deliveries into Home sections", () => {
    const g = groupActive(list);
    expect(g.onRoad).toHaveLength(2);
    expect(g.assigned).toHaveLength(1);
    expect(g.waiting).toHaveLength(1);
  });
  it("leaves zeros out of the summary", () => {
    expect(homeSummary({ onRoad: 1, waiting: 2 })).toBe("1\u00a0on\u00a0the\u00a0road\u00a0· 2\u00a0waiting");
    expect(homeSummary({})).toBe("");
  });
});

describe("formatPeso and fareBreakdown", () => {
  it("formats pesos", () => expect(formatPeso(3550)).toBe("₱3,550"));
  it("shows the real distance", () =>
    expect(fareBreakdown(118.43, 800)).toBe("₱150 base + 118.4 km × ₱15 + 800 kg × ₱2, rounded. Tolls included."));
});

describe("pickupPassed", () => {
  const today = new Date(2026, 9, 17);
  it("is true for a waiting delivery whose date is before today", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-16T00:00:00" }, today)).toBe(true);
  });
  it("is false for today, for other statuses, and with no date", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-17T08:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "driver_assigned", scheduled_pickup_at: "2026-10-10T00:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: null }, today)).toBe(false);
  });
});

describe("bookingErrorCopy", () => {
  it("maps each known error to plain words", () => {
    expect(bookingErrorCopy({ message: 'Couldn\'t find "San Roque". Try adding a city or province.', which: "pickup" })).toMatchObject({ kind: "not-found", field: "pickup" });
    expect(bookingErrorCopy({ message: "No driving route found between those two points." })).toMatchObject({ kind: "no-route", field: "dropoff" });
    expect(bookingErrorCopy({ message: "Too many requests. Please wait a minute and try again." }).kind).toBe("rate");
    expect(bookingErrorCopy({ message: "The route distance does not match the pickup and drop-off locations." }).kind).toBe("mismatch");
    expect(bookingErrorCopy(new TypeError("Failed to fetch")).kind).toBe("offline");
  });
  it("never passes the raw message through", () => {
    expect(bookingErrorCopy({ message: "duplicate key value violates unique constraint" }).message).not.toMatch(/duplicate/);
  });
});

describe("contactUrl", () => {
  it("adds the booking code", () =>
    expect(contactUrl("../../pages/contact.html", "SK-00003")).toBe("../../pages/contact.html?code=SK-00003"));
  it("leaves the link alone without a code", () =>
    expect(contactUrl("../../pages/contact.html", "")).toBe("../../pages/contact.html"));
});

describe("driver dashboard helpers", () => {
  it("renderDriverStepper: 4 steps with the current one marked", async () => {
    const { renderDriverStepper } = await import("../js/dashboard-shared.js");
    const html = renderDriverStepper("picked_up");
    expect(html).toContain('aria-label="Step 2 of 4, Picked up"');
    expect(html.match(/rq-step--done/g)).toHaveLength(1);
    expect(html.match(/rq-step--next/g)).toHaveLength(2);
    expect(renderDriverStepper("pending")).toBe("");
  });

  it("driverAction: the next step per status; delivered opens the cash check", async () => {
    const { driverAction } = await import("../js/dashboard-shared.js");
    expect(driverAction("driver_assigned")).toMatchObject({ next: "picked_up", label: "I've picked up the load" });
    expect(driverAction("picked_up")).toMatchObject({ next: "in_transit", seen: "In transit" });
    expect(driverAction("in_transit")).toMatchObject({ next: "delivered", cashCheck: true });
    expect(driverAction("delivered")).toBeNull();
  });

  it("activeJobs + pickCurrentJob: keeps the picked job, else the moving one", async () => {
    const { activeJobs, pickCurrentJob } = await import("../js/dashboard-shared.js");
    const list = [
      { id: "b", status: "in_transit", created_at: "2026-10-14T02:00:00Z" },
      { id: "a", status: "driver_assigned", created_at: "2026-10-14T01:00:00Z" },
      { id: "c", status: "delivered", created_at: "2026-10-13T01:00:00Z" },
    ];
    const active = activeJobs(list);
    expect(active.map((d) => d.id)).toEqual(["a", "b"]);
    expect(pickCurrentJob(active, null).id).toBe("b");
    expect(pickCurrentJob(active, "a").id).toBe("a");
    expect(pickCurrentJob(active, "gone").id).toBe("b");
    expect(pickCurrentJob([], null)).toBeNull();
  });

  it("mapsUrl prefers coordinates", async () => {
    const { mapsUrl } = await import("../js/dashboard-shared.js");
    expect(mapsUrl(14.65, 121.1, "Marikina")).toBe("https://www.google.com/maps/dir/?api=1&destination=14.65%2C121.1");
    expect(mapsUrl(null, null, "Gapan City")).toContain("destination=Gapan%20City");
  });

  it("pickupDayLabel: today, tomorrow, a date, or null", async () => {
    const { pickupDayLabel } = await import("../js/dashboard-shared.js");
    const today = new Date(2026, 9, 15, 9);
    expect(pickupDayLabel(new Date(2026, 9, 15, 0).toISOString(), today)).toBe("today");
    expect(pickupDayLabel(new Date(2026, 9, 16, 0).toISOString(), today)).toBe("tomorrow");
    expect(pickupDayLabel(new Date(2026, 9, 20, 0).toISOString(), today)).toBe("Oct 20");
    expect(pickupDayLabel(null, today)).toBeNull();
  });

  it("shortPlace keeps the first part", async () => {
    const { shortPlace } = await import("../js/dashboard-shared.js");
    expect(shortPlace("Marikina Public Market, Marikina")).toBe("Marikina Public Market");
    expect(shortPlace("")).toBe("");
  });

  it("jobErrorCopy maps errors to plain words", async () => {
    const { jobErrorCopy } = await import("../js/dashboard-shared.js");
    expect(jobErrorCopy({ message: "Too many requests. Please wait a minute and try again." }).kind).toBe("rate");
    expect(jobErrorCopy({ message: "You already have 2 active jobs. Finish one to accept more." }).kind).toBe("cap");
    expect(jobErrorCopy({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }).kind).toBe("gone");
    expect(jobErrorCopy({ message: "TypeError: Failed to fetch" }).kind).toBe("offline");
    const unknown = jobErrorCopy({ message: "permission denied for table deliveries" });
    expect(unknown.kind).toBe("unknown");
    expect(unknown.message).not.toContain("permission");
  });

  it("locationProblem reads the geolocation error code", async () => {
    const { locationProblem } = await import("../js/dashboard-shared.js");
    expect(locationProblem(null)).toBe("unsupported");
    expect(locationProblem({ code: 1 })).toBe("blocked");
    expect(locationProblem({ code: 2 })).toBe("off");
    expect(locationProblem({ code: 3 })).toBe("weak");
  });

  it("undoSeconds gives keyboard users longer", async () => {
    const { undoSeconds } = await import("../js/dashboard-shared.js");
    expect(undoSeconds(false)).toBe(8);
    expect(undoSeconds(true)).toBe(10);
  });

  it("paymentLine says whether the receiver paid", async () => {
    const { paymentLine } = await import("../js/dashboard-shared.js");
    expect(paymentLine({ payment_status: "paid" })).toBe("delivered and paid in cash");
    expect(paymentLine({ payment_status: "unpaid" })).toMatch(/not paid/);
    expect(paymentLine({ payment_status: null })).toBe("delivered");
  });
});

describe("findDelivery", () => {
  const rows = [
    { delivery_code: "SK-00012", goods_description: "Tomatoes, 40 crates", status: "delivered" },
    { delivery_code: "SK-00013", goods_description: "Tomatoes, 10 crates", status: "pending" },
    { delivery_code: "SK-00142", goods_description: "Mangoes", status: "in_transit" },
  ];
  it("matches a code however it's typed", () => {
    expect(findDelivery(rows, "SK-00142").delivery_code).toBe("SK-00142");
    expect(findDelivery(rows, "sk142").delivery_code).toBe("SK-00142");
    expect(findDelivery(rows, " 12 ").delivery_code).toBe("SK-00012");
  });
  it("matches goods, preferring an active booking", () => {
    expect(findDelivery(rows, "tomatoes").delivery_code).toBe("SK-00013");
    expect(findDelivery(rows, "mango").delivery_code).toBe("SK-00142");
  });
  it("returns null when nothing matches", () => {
    expect(findDelivery(rows, "SK-99999")).toBeNull();
    expect(findDelivery(rows, "rice")).toBeNull();
    expect(findDelivery(rows, "")).toBeNull();
  });
});

describe("shipmentProgress", () => {
  it("runs from 0 waiting to 1 delivered", () => {
    expect(shipmentProgress("pending")).toBe(0);
    expect(shipmentProgress("picked_up")).toBe(0.5);
    expect(shipmentProgress("delivered")).toBe(1);
    expect(shipmentProgress("cancelled")).toBe(0);
  });
});
