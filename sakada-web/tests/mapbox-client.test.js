import { describe, it, expect } from "vitest";
import { estimateCost, staticMapUrl } from "../js/mapbox-client.js";

describe("estimateCost", () => {
  it("calculates cost with base fare + distance + weight", () => {
    // BASE_FARE=150, RATE_PER_KM=15, RATE_PER_KG=2
    // 10km * 15 + 5kg * 2 + 150 = 150 + 10 + 150 = 310
    expect(estimateCost(10, 5)).toBe(310);
  });

  it("returns base fare for zero distance and weight", () => {
    expect(estimateCost(0, 0)).toBe(150);
  });

  it("handles null/undefined quantity gracefully", () => {
    expect(estimateCost(10, null)).toBe(300);
    expect(estimateCost(10, undefined)).toBe(300);
  });

  it("rounds to nearest integer", () => {
    // 1.5km * 15 = 22.5, 0.5kg * 2 = 1, total = 150 + 22.5 + 1 = 173.5 -> 174
    expect(estimateCost(1.5, 0.5)).toBe(174);
  });

  it("handles large distances", () => {
    // 100km * 15 + 150 = 1650
    expect(estimateCost(100, 0)).toBe(1650);
  });

  it("handles large weights", () => {
    // 500kg * 2 + 150 = 1150
    expect(estimateCost(0, 500)).toBe(1150);
  });
});

describe("staticMapUrl", () => {
  it("generates a valid Mapbox static map URL", () => {
    const url = staticMapUrl(14.5995, 120.9842);
    expect(url).toContain("api.mapbox.com");
    expect(url).toContain("14.5995");
    expect(url).toContain("120.9842");
    expect(url).toContain("600x320");
  });

  it("accepts custom dimensions and zoom", () => {
    const url = staticMapUrl(14.5995, 120.9842, {
      width: 800,
      height: 600,
      zoom: 15,
    });
    expect(url).toContain("800x600");
    expect(url).toContain(",15/");
  });

  it("includes the access token", () => {
    const url = staticMapUrl(14.5995, 120.9842);
    expect(url).toContain("access_token=");
  });
});
