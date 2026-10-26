// Every English string the farmer/vendor app and log in / sign up show has
// a Filipino and a Taglish version, with the same {placeholders}.
import { describe, it, expect, beforeEach } from "vitest";
import FIL from "../js/i18n-fil.js";
import TAGLISH from "../js/i18n-taglish.js";
import { t, useLanguage, LANGUAGES } from "../js/i18n.js";
import { allKeys } from "./i18n-keys.js";

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("translations", () => {
  const keys = allKeys();
  for (const [name, table] of [["Filipino", FIL], ["Taglish", TAGLISH]]) {
    it(`${name} has every string the app shows`, () => {
      const missing = keys.filter((k) => !(k in table));
      expect(missing).toEqual([]);
    });
    it(`${name} keeps every {placeholder}`, () => {
      const wrong = Object.entries(table).filter(([en, tr]) => holes(en) !== holes(tr)).map(([en]) => en);
      expect(wrong).toEqual([]);
    });
    it(`${name} two-line headlines keep two lines`, () => {
      const wrong = Object.entries(table).filter(([en, tr]) => en.includes("\n") !== tr.includes("\n")).map(([en]) => en);
      expect(wrong).toEqual([]);
    });
  }
});

describe("t()", () => {
  beforeEach(() => useLanguage("en"));
  it("is English unless a page chose a language", () => {
    expect(t("Review booking")).toBe("Review booking");
    expect(t("Set the kg for {name}.", { name: "Onions" })).toBe("Set the kg for Onions.");
  });
  it("uses the account's language and fills values in", () => {
    useLanguage("fil");
    expect(t("Review booking")).toBe(FIL["Review booking"]);
    expect(t("Set the kg for {name}.", { name: "Onions" })).toContain("Onions");
    useLanguage("taglish");
    expect(t("Review booking")).toBe(TAGLISH["Review booking"]);
  });
  it("falls back to English for unknown text and ignores unknown languages", () => {
    useLanguage("fil");
    expect(t("Something brand new")).toBe("Something brand new");
    expect(useLanguage("es")).toBe("fil"); // keeps the phone's saved choice
  });
  it("offers English, Filipino and Taglish", () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(["en", "fil", "taglish"]);
  });
});
