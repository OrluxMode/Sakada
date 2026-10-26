import { describe, it, expect, vi } from "vitest";

// The data calls aren't tested here (e2e covers them); only the pure helpers.
vi.mock("../js/supabase-client.js", () => ({ supabase: {} }));
const { savedMatches, savedAsPlace, isSaved, checkSavedLabel, savedErrorCopy, SAVED_LIMIT } = await import("../js/saved-addresses.js");
const { centreSquare } = await import("../js/avatar.js");

const rows = [
  { id: "a", label: "My farm", address: "Brgy. Sapang, Jaen, Nueva Ecija", lat: 15.33, lng: 120.91, city: "Jaen" },
  { id: "b", label: "Divisoria stall", address: "Divisoria Market, Tondo, Manila", lat: 14.6, lng: 120.97, city: "Manila" },
  { id: "c", label: "Balintawak warehouse", address: "EDSA, Balintawak, Quezon City", lat: 14.66, lng: 121.0, city: "Quezon City" },
];

describe("savedMatches", () => {
  it("returns every saved address for an empty field", () => expect(savedMatches(rows, "")).toHaveLength(3));
  it("matches the start of a word in the name", () => expect(savedMatches(rows, "far").map((r) => r.id)).toEqual(["a"]));
  it("puts name matches before address matches", () => {
    const more = [...rows, { id: "d", label: "Tita's place", address: "Farm road, Gapan", lat: 15.3, lng: 120.9 }];
    expect(savedMatches(more, "far").map((r) => r.id)).toEqual(["a", "d"]);
  });
  it("matches the address too, ignoring case", () => expect(savedMatches(rows, "TONDO").map((r) => r.id)).toEqual(["b"]));
  it("doesn't match the middle of a word", () => expect(savedMatches(rows, "arm")).toEqual([]));
  it("stops at the limit given", () => expect(savedMatches(rows, "", 2)).toHaveLength(2));
});

describe("savedAsPlace", () => {
  it("keeps the saved point for the fare", () =>
    expect(savedAsPlace(rows[0])).toEqual({
      name: "My farm",
      detail: "Brgy. Sapang, Jaen, Nueva Ecija",
      address: "Brgy. Sapang, Jaen, Nueva Ecija",
      geo: { lat: 15.33, lng: 120.91, placeName: "Brgy. Sapang, Jaen, Nueva Ecija", city: "Jaen" },
      saved: true,
    }));
  it("says Saved when it matched what was typed", () =>
    expect(savedAsPlace(rows[1], { matched: true }).detail).toBe("Saved · Divisoria Market, Tondo, Manila"));
});

describe("isSaved", () => {
  it("knows the same address", () => expect(isSaved(rows, { address: "divisoria market, tondo, manila", geo: { lat: 1, lng: 1 } })).toBe(true));
  it("knows the same point", () => expect(isSaved(rows, { address: "Somewhere", geo: { lat: 15.33, lng: 120.91 } })).toBe(true));
  it("a new place isn't saved", () => expect(isSaved(rows, { address: "Cabanatuan", geo: { lat: 15.48, lng: 120.96 } })).toBe(false));
});

describe("checkSavedLabel", () => {
  it("needs a name", () => expect(checkSavedLabel("  ", rows)).toBe("Give it a name, like My farm."));
  it("keeps it short", () => expect(checkSavedLabel("x".repeat(41), rows)).toBe("Keep the name under 40 characters."));
  it("won't repeat a name, ignoring case", () =>
    expect(checkSavedLabel(" my FARM ", rows)).toBe("You already have “my FARM”. Use another name."));
  it("an address can keep its own name when edited", () => expect(checkSavedLabel("My farm", rows, "a")).toBe(""));
});

describe("savedErrorCopy", () => {
  it("explains the limit", () =>
    expect(savedErrorCopy({ message: "saved address limit reached" })).toBe(`You can save up to ${SAVED_LIMIT} addresses. Delete one to add another.`));
  it("explains a repeated name", () => expect(savedErrorCopy({ code: "23505" })).toMatch(/already have/));
  it("falls back to a signal message", () => expect(savedErrorCopy(new Error("Failed to fetch"))).toMatch(/signal/));
});

describe("centreSquare", () => {
  it("cuts a landscape photo from the middle", () => expect(centreSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 }));
  it("cuts a portrait photo from the middle", () => expect(centreSquare(1080, 1920)).toEqual({ sx: 0, sy: 420, size: 1080 }));
  it("leaves a square as it is", () => expect(centreSquare(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 }));
});
