import { describe, it, expect } from "vitest";
import {
  PRODUCE, fold, matchProduce, knownProduce, KG_STEPS, kgStepsWith, kgLabel,
  formatGoods, parseGoods, checkProduce, MAX_PRODUCE,
} from "../js/produce.js";

describe("produce list", () => {
  it("is vegetables and fruits only, with no repeated names", () => {
    expect(new Set(PRODUCE.map((p) => p.kind))).toEqual(new Set(["Vegetable", "Fruit"]));
    const names = PRODUCE.map((p) => fold(p.en));
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain("rice");
    expect(names).not.toContain("corn");
  });
});

describe("matchProduce", () => {
  it("matches Tagalog names and shows them as the detail", () => {
    const found = matchProduce("kam");
    expect(found.slice(0, 2).map((p) => p.name)).toEqual(["Tomatoes", "Sweet potatoes"]);
    expect(found[0]).toEqual({ name: "Tomatoes", detail: "Kamatis · Vegetable", icon: "leaf" });
    expect(found.map((p) => p.name)).toContain("Bilimbi");
  });
  it("matches English, ignoring capitals and accents", () => {
    expect(matchProduce("MANG")[0].name).toBe("Mangoes");
    expect(matchProduce("sibúyas")[0].name).toBe("Onions");
  });
  it("puts names that start with the text before a later word", () => {
    const names = matchProduce("on").map((p) => p.name);
    expect(names[0]).toBe("Onions");
    expect(names).toContain("Spring onions");
  });
  it("shows only the kind when both names are the same", () => {
    expect(matchProduce("okra")[0].detail).toBe("Vegetable");
  });
  it("returns nothing for empty text or no match, and at most the limit", () => {
    expect(matchProduce("  ")).toEqual([]);
    expect(matchProduce("xyzzy")).toEqual([]);
    expect(matchProduce("a").length).toBe(5);
  });
});

describe("knownProduce", () => {
  it("gives the English name for either language", () => {
    expect(knownProduce("kamatis")).toBe("Tomatoes");
    expect(knownProduce(" tomatoes ")).toBe("Tomatoes");
    expect(knownProduce("kam")).toBe("");
  });
});

describe("kg wheel steps", () => {
  it("goes 5 → 100 by 5, then by 10 to 1,000, then by 50 to 10,000", () => {
    expect(KG_STEPS.slice(0, 3)).toEqual([5, 10, 15]);
    expect(KG_STEPS).toContain(100);
    expect(KG_STEPS[KG_STEPS.indexOf(100) + 1]).toBe(110);
    expect(KG_STEPS[KG_STEPS.indexOf(1000) + 1]).toBe(1050);
    expect(KG_STEPS.at(-1)).toBe(10000);
  });
  it("adds a typed weight in its place", () => {
    const steps = kgStepsWith(235);
    expect(steps.slice(steps.indexOf(230), steps.indexOf(230) + 3)).toEqual([230, 235, 240]);
    expect(kgStepsWith(200)).toBe(KG_STEPS);
    expect(kgStepsWith(0)).toBe(KG_STEPS);
  });
  it("labels with thousands separators", () => {
    expect(kgLabel(1050)).toBe("1,050 kg");
  });
});

describe("saving and reading back", () => {
  it("keeps one produce as just its name", () => {
    expect(formatGoods([{ name: "Tomatoes", kg: 200 }])).toBe("Tomatoes");
  });
  it("lists several with their kg", () => {
    expect(formatGoods([{ name: "Tomatoes", kg: 200 }, { name: "Onions", kg: 150 }])).toBe("Tomatoes 200 kg, Onions 150 kg");
  });
  it("splits a saved list back into rows when the kg add up", () => {
    expect(parseGoods("Tomatoes 200 kg, Onions 150 kg", 350)).toEqual([{ name: "Tomatoes", kg: 200 }, { name: "Onions", kg: 150 }]);
    expect(parseGoods("Tomatoes", "200")).toEqual([{ name: "Tomatoes", kg: 200 }]);
  });
  it("keeps older free text as one row with the total", () => {
    expect(parseGoods("Onions · 20 sacks", 800)).toEqual([{ name: "Onions · 20 sacks", kg: 800 }]);
    expect(parseGoods("Eggplant, 32 crates", 800)).toEqual([{ name: "Eggplant, 32 crates", kg: 800 }]);
    expect(parseGoods("Tomatoes 200 kg, Onions 150 kg", 999)).toEqual([{ name: "Tomatoes 200 kg, Onions 150 kg", kg: 999 }]);
    expect(parseGoods("", "")).toEqual([]);
  });
});

describe("checkProduce", () => {
  const row = (name, kg = null) => ({ name, kg });
  it("needs at least one produce", () => {
    expect(checkProduce([row("")])).toEqual({ row: 0, message: "Add what you're shipping, like tomatoes or mangoes." });
  });
  it("names the produce that has no kg, and ignores the empty last row", () => {
    expect(checkProduce([row("Tomatoes", 200), row("Onions"), row("")])).toEqual({ row: 1, message: "Set the kg for Onions." });
    expect(checkProduce([row("Tomatoes", 200), row("")])).toBeNull();
  });
  it("asks what a kg without a name is", () => {
    expect(checkProduce([row("", 50)]).message).toBe("Add the produce for the 50 kg.");
  });
  it("stops lists that won't fit the 120-character goods line", () => {
    const long = Array.from({ length: MAX_PRODUCE }, (_, i) => row(`Very long produce name number ${i}`, 10));
    expect(checkProduce(long).message).toMatch(/too long to send/);
  });
  it("stops a total over 100 tonnes", () => {
    expect(checkProduce([row("Mangoes", 60000), row("Bananas", 50000)]).message).toMatch(/over 100 tonnes/);
  });
});
