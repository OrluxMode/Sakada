import { describe, it, expect } from "vitest";
import { estimateCost, staticMapUrl, routeMapUrl, placeCity, routeMinutes } from "../js/mapbox-client.js";

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

describe("routeMapUrl", () => {
  const pickup = { lat: 15.4865, lng: 120.9667 };
  const dropoff = { lat: 14.6507, lng: 121.1029 };

  it("draws A and B and fits the view to them", () => {
    const url = routeMapUrl({ pickup, dropoff });
    expect(url).toContain("pin-s-a+b8b4a6(120.96670,15.48650)");
    expect(url).toContain("pin-s-b+f3efe4(121.10290,14.65070)");
    expect(url).toContain("/auto/600x300@2x?padding=36");
    expect(url).not.toContain("path-");
    expect(url).not.toContain("pin-l-car");
  });

  it("adds the road and the truck when known", () => {
    const url = routeMapUrl({ pickup, dropoff, truck: { lat: 15.1, lng: 121 }, line: "a~l~Fjk~uOwHJy@P" });
    expect(url).toContain(`path-4+e0972f-0.95(${encodeURIComponent("a~l~Fjk~uOwHJy@P")})`);
    expect(url).toContain("pin-l-car+e0972f(121.00000,15.10000)");
  });

  it("leaves out a road too long for a URL", () => {
    const url = routeMapUrl({ pickup, dropoff, line: "x".repeat(7000) });
    expect(url).not.toContain("path-");
    expect(url).toContain("pin-s-a");
  });
});

describe("placeCity", () => {
  it("finds the city a result sits in", () => {
    expect(placeCity({ place_type: ["poi"], text: "Marikina Public Market", context: [{ id: "locality.1", text: "Sto. Niño" }, { id: "place.9", text: "Marikina" }] })).toBe("Marikina");
    expect(placeCity({ place_type: ["place"], text: "Cabanatuan City" })).toBe("Cabanatuan City");
    expect(placeCity({ place_type: ["address"], text: "Rizal Ave" })).toBe("");
  });
});

describe("routeMinutes", () => {
  it("turns Mapbox seconds into minutes", () => expect(routeMinutes({ duration: 8880 })).toBe(148));
  it("is null when the route has no duration", () => {
    expect(routeMinutes({})).toBeNull();
    expect(routeMinutes(undefined)).toBeNull();
    expect(routeMinutes({ duration: 0 })).toBeNull();
  });
});
