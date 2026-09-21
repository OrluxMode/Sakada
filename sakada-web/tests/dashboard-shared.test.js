import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the notifications module (it imports from https URLs)
vi.mock("../js/notifications.js", () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

import {
  statusLabel,
  timeAgo,
  HISTORY_STATUSES,
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
