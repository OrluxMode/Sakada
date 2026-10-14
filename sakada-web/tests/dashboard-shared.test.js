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
        goods_description: "Rice",
        quantity_kg: 500,
      }),
    ).toEqual({
      pickupAddress: "A",
      dropoffAddress: "B",
      goodsDescription: "Rice",
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
