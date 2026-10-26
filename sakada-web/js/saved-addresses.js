// Saved addresses ("My farm", "Divisoria stall"): kept in Profile, offered
// first when typing an address on Book. Each keeps its exact point, so a
// booking from a saved address uses the same spot every time.
// Table and rules: sakada-backend 0026 (own rows only, at most 10).

import { t } from "./i18n.js";
import { supabase } from "./supabase-client.js";

export const SAVED_LIMIT = 10;
const COLUMNS = "id, label, address, lat, lng, city, created_at";

export async function listSaved() {
  const { data, error } = await supabase.from("saved_addresses").select(COLUMNS).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addSaved(row) {
  const { data, error } = await supabase.from("saved_addresses").insert(row).select(COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function updateSaved(id, row) {
  const { data, error } = await supabase.from("saved_addresses").update(row).eq("id", id).select(COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function deleteSaved(id) {
  const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
  if (error) throw error;
}

/** A saved address as a row in Book's place list. */
export function savedAsPlace(row, { matched = false } = {}) {
  return {
    name: row.label,
    detail: matched ? `Saved · ${row.address}` : row.address,
    address: row.address,
    geo: { lat: Number(row.lat), lng: Number(row.lng), placeName: row.address, city: row.city || "" },
    saved: true,
  };
}

const fold = (s) => String(s || "").toLocaleLowerCase("en-PH").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Saved addresses that match what's typed: a word of the name or address
 * starting with it ("far" → "My farm"), names first. Empty text: the first `max`.
 */
export function savedMatches(rows, text, max = 3) {
  const q = fold(text).trim();
  if (!q) return rows.slice(0, max);
  const starts = (s) => fold(s).split(/[\s,.-]+/).some((w) => w.startsWith(q)) || fold(s).startsWith(q);
  const byName = rows.filter((r) => starts(r.label));
  const byAddress = rows.filter((r) => !byName.includes(r) && starts(r.address));
  return [...byName, ...byAddress].slice(0, max);
}

/** True when this place (picked or pinned) is already one of the saved addresses. */
export function isSaved(rows, place) {
  if (!place?.geo) return false;
  return rows.some((r) =>
    (fold(r.address) === fold(place.address)) ||
    (Math.abs(Number(r.lat) - place.geo.lat) < 0.0001 && Math.abs(Number(r.lng) - place.geo.lng) < 0.0001));
}

/** A name for a saved address: 1–40 characters, not one they already use. */
export function checkSavedLabel(value, rows = [], ownId = null) {
  const v = String(value || "").trim();
  if (!v) return t("Give it a name, like My farm.");
  if (v.length > 40) return t("Keep the name under 40 characters.");
  if (rows.some((r) => r.id !== ownId && fold(r.label).trim() === fold(v))) return t("You already have “{name}”. Use another name.", { name: v });
  return "";
}

/** Plain words for a failed save. */
export function savedErrorCopy(error) {
  const msg = String(error?.message || "");
  if (/limit/i.test(msg)) return t("You can save up to {n} addresses. Delete one to add another.", { n: SAVED_LIMIT });
  if (error?.code === "23505" || /duplicate|unique/i.test(msg)) return t("You already have an address with that name. Use another name.");
  return t("It didn't save. Check your signal and try again.");
}
