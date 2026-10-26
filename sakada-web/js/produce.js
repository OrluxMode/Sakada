// What a farmer or vendor ships, one row per produce (Figma 345:2174).
// Sakada moves fresh produce only: vegetables and fruits, no grains.
//
// The database keeps one goods line and one total weight, so several rows
// are saved as "Tomatoes 200 kg, Onions 150 kg" with the kg added up, and
// read back the same way for Book again. A single produce stays just its
// name ("Tomatoes"), like every booking made before rows existed.

export const MAX_PRODUCE = 5;
export const GOODS_LIMIT = 120; // deliveries.goods_description, migration 0021
export const KG_MAX = 100000;

// English (what the driver reads) and the Tagalog name people often type.
const VEGETABLES = [
  ["Tomatoes", "Kamatis"], ["Onions", "Sibuyas"], ["Garlic", "Bawang"], ["Ginger", "Luya"],
  ["Cabbage", "Repolyo"], ["Chinese cabbage", "Pechay Baguio"], ["Bok choy", "Pechay"],
  ["Eggplant", "Talong"], ["Squash", "Kalabasa"], ["Bitter gourd", "Ampalaya"],
  ["String beans", "Sitaw"], ["Green beans", "Baguio beans"], ["Okra", "Okra"],
  ["Water spinach", "Kangkong"], ["Potatoes", "Patatas"], ["Carrots", "Karot"],
  ["Sweet potatoes", "Kamote"], ["Cassava", "Kamoteng kahoy"], ["Taro", "Gabi"], ["Purple yam", "Ube"],
  ["Chili peppers", "Sili"], ["Bell peppers", "Atsal"], ["Cucumbers", "Pipino"],
  ["Bottle gourd", "Upo"], ["Sponge gourd", "Patola"], ["Chayote", "Sayote"], ["Radish", "Labanos"],
  ["Lettuce", "Litsugas"], ["Moringa leaves", "Malunggay"], ["Winged beans", "Sigarilyas"],
  ["Lima beans", "Patani"], ["Bean sprouts", "Togue"], ["Spring onions", "Dahon ng sibuyas"],
  ["Broccoli", "Brokoli"], ["Cauliflower", "Koliplor"], ["Celery", "Kintsay"], ["Jute leaves", "Saluyot"],
];
const FRUITS = [
  ["Mangoes", "Mangga"], ["Bananas", "Saging"], ["Saba bananas", "Saging na saba"], ["Pineapples", "Pinya"],
  ["Papayas", "Papaya"], ["Watermelons", "Pakwan"], ["Melons", "Melon"], ["Calamansi", "Kalamansi"],
  ["Pomelos", "Suha"], ["Oranges", "Dalandan"], ["Lanzones", "Lansones"], ["Rambutan", "Rambutan"],
  ["Mangosteen", "Mangostan"], ["Durian", "Durian"], ["Jackfruit", "Langka"], ["Avocados", "Abukado"],
  ["Guavas", "Bayabas"], ["Coconuts", "Niyog"], ["Young coconuts", "Buko"], ["Star apples", "Kaimito"],
  ["Chico", "Tsiko"], ["Santol", "Santol"], ["Bilimbi", "Kamias"], ["Tamarind", "Sampalok"],
  ["Sugar apples", "Atis"], ["Soursop", "Guyabano"], ["Dragon fruit", "Dragon fruit"],
  ["Strawberries", "Strawberry"], ["Grapes", "Ubas"],
];
export const PRODUCE = [
  ...VEGETABLES.map(([en, tl]) => ({ en, tl, kind: "Vegetable" })),
  ...FRUITS.map(([en, tl]) => ({ en, tl, kind: "Fruit" })),
];

/** Lower case, no accents, single spaces: "  Sibúyas " → "sibuyas". */
export function fold(text) {
  return String(text).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const detailOf = (p) => (fold(p.tl) === fold(p.en) ? p.kind : `${p.tl} · ${p.kind}`);

/**
 * Produce matching what's typed, in English or Tagalog, best first:
 * names that start with it, then a later word that starts with it, then
 * anywhere. "kam" → Tomatoes (Kamatis), Sweet potatoes (Kamote), …
 */
export function matchProduce(text, limit = 5) {
  const q = fold(text);
  if (!q) return [];
  const rank = (name) => {
    const n = fold(name);
    if (n.startsWith(q)) return 0;
    if (n.split(" ").some((w) => w.startsWith(q))) return 1;
    return n.includes(q) ? 2 : 3;
  };
  return PRODUCE
    .map((p, i) => ({ p, i, r: Math.min(rank(p.en), rank(p.tl)) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map(({ p }) => ({ name: p.en, detail: detailOf(p), icon: "leaf" }));
}

/** The English name when the text is exactly a known produce (either language). */
export function knownProduce(text) {
  const q = fold(text);
  return PRODUCE.find((p) => fold(p.en) === q || fold(p.tl) === q)?.en || "";
}

/**
 * The kg wheel's stops: 5 kg up to 100, 10 kg up to 1,000, then 50 kg up to
 * 10,000. Short enough to flick through; anything else is typed.
 */
export const KG_STEPS = (() => {
  const steps = [];
  for (let kg = 5; kg <= 100; kg += 5) steps.push(kg);
  for (let kg = 110; kg <= 1000; kg += 10) steps.push(kg);
  for (let kg = 1050; kg <= 10000; kg += 50) steps.push(kg);
  return steps;
})();

/** The wheel's stops plus `kg` itself when it's in between (a typed 235 stays on the wheel). */
export function kgStepsWith(kg) {
  const n = Number(kg);
  if (!Number.isInteger(n) || n < 1 || n > KG_MAX || KG_STEPS.includes(n)) return KG_STEPS;
  return [...KG_STEPS, n].sort((a, b) => a - b);
}

export const kgLabel = (kg) => `${Number(kg).toLocaleString("en-PH")} kg`;

/** Rows with a produce name, trimmed. */
export function namedItems(rows) {
  return rows
    .map((r) => ({ name: String(r.name || "").trim(), kg: r.kg ? Number(r.kg) : null }))
    .filter((r) => r.name);
}

export const totalKg = (items) => items.reduce((sum, r) => sum + (r.kg || 0), 0);

/** The goods line saved with the booking. */
export function formatGoods(items) {
  if (items.length === 1) return items[0].name;
  return items.map((r) => `${r.name} ${r.kg} kg`).join(", ");
}

/**
 * Rows back from a saved booking. A line this module wrote
 * ("Tomatoes 200 kg, Onions 150 kg" adding up to the total) splits into
 * rows; anything else ("Onions · 20 sacks") is one row with the total kg.
 */
export function parseGoods(goods, kg) {
  const text = String(goods || "").trim();
  const total = kg === "" || kg == null ? null : Number(kg);
  if (!text) return [];
  const parts = text.split(", ").map((part) => part.match(/^(.+) (\d+) kg$/));
  if (parts.length > 1 && parts.every(Boolean)) {
    const items = parts.map((m) => ({ name: m[1], kg: Number(m[2]) }));
    if (totalKg(items) === total) return items;
  }
  return [{ name: text, kg: total }];
}

/**
 * The first problem with the rows, or null. `row` is the index of the row
 * to point at (in `rows`, empty rows included).
 */
export function checkProduce(rows) {
  const at = (i, message) => ({ row: i, message });
  let named = 0;
  for (let i = 0; i < rows.length; i++) {
    const name = String(rows[i].name || "").trim();
    const kg = rows[i].kg;
    if (!name && !kg) continue;
    if (!name) return at(i, `Add the produce for the ${kgLabel(kg)}.`);
    if (name.length < 2) return at(i, "Write the produce name, like tomatoes or mangoes.");
    if (!kg) return at(i, `Set the kg for ${name}.`);
    named++;
  }
  if (!named) return at(0, "Add what you're shipping, like tomatoes or mangoes.");
  const items = namedItems(rows);
  if (totalKg(items) > KG_MAX) return at(-1, "That's over 100 tonnes in total. Check the kg.");
  if (formatGoods(items).length > GOODS_LIMIT) return at(-1, "That list is too long to send. Use shorter names or fewer produce.");
  return null;
}
