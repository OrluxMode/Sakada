// Mapbox geocoding + driving-distance helpers, used to turn a typed
// address into coordinates and a real cost estimate.
//
// The token is a PUBLIC token (starts with pk.) — safe to use in browser
// code, same as the Supabase publishable key. It lives in config.js so
// there is exactly one place to change it; this file used to hardcode a
// second copy.

import { config } from "./config.js";

const MAPBOX_TOKEN = config.mapboxToken;

/**
 * Turns a typed address into coordinates. Biased to the Philippines so
 * "Marikina" resolves correctly instead of matching some other country.
 */
export async function geocodeAddress(address) {
  const query = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=PH&limit=1`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error("Couldn't reach the map service. Try again in a moment.");

  const data = await res.json();
  if (!data.features || data.features.length === 0) {
    throw new Error(
      `Couldn't find "${address}". Try adding a city or province.`,
    );
  }

  const feature = data.features[0];
  const [lng, lat] = feature.center;
  return { lat, lng, placeName: feature.place_name, city: placeCity(feature) };
}

/**
 * Up to 5 places in the Philippines that match what's typed so far, for the
 * suggestion list under an address field. Countries and postcodes are left
 * out because neither is somewhere a truck can go.
 */
export async function suggestPlaces(text, { signal } = {}) {
  const query = encodeURIComponent(text);
  const types = "region,district,place,locality,neighborhood,address,poi";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=PH&autocomplete=true&limit=5&language=en&types=${types}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Couldn't reach the map service.");
  const data = await res.json();
  return (data.features || []).filter((f) => Array.isArray(f.center)).map(toSuggestion);
}

/**
 * The address at a point pinned on the map. The point itself is what the
 * fare uses, so it's kept exactly; Mapbox only supplies the words. When it
 * has none (open fields, the sea), the coordinates stand in for them.
 */
export async function placeAt(lat, lng, { signal } = {}) {
  const types = "address,poi,neighborhood,locality,place";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=${types}&limit=1&language=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Couldn't reach the map service.");
  const feature = (await res.json()).features?.[0];
  return pinnedPlace(lat, lng, feature);
}

/** A pinned point with Mapbox's address for it (or just the coordinates). */
export function pinnedPlace(lat, lng, feature) {
  const at = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const address = feature ? toSuggestion(feature).address : `Pinned spot (${at})`;
  return { address, geo: { lat, lng, placeName: feature?.place_name || address, city: feature ? placeCity(feature) : "" } };
}

/** Mapbox's dark map as 512px tiles, for the draggable pin map. */
export function mapTilesUrl() {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/512/{z}/{x}/{y}{r}?access_token=${MAPBOX_TOKEN}`;
}

const KIND = { region: "Province", district: "District", place: "City or town", locality: "Area", neighborhood: "Area", address: "Street" };

/**
 * One geocoding result as a suggestion row: the place's own name, what kind
 * of place it is with the town/province it sits in, the full address that
 * goes in the field, and the point the fare is worked out from.
 */
export function toSuggestion(feature) {
  const type = feature.place_type?.[0];
  const category = String(feature.properties?.category || "").split(",")[0].trim();
  const kind = type === "poi"
    ? (category ? category[0].toUpperCase() + category.slice(1) : "Place")
    : (KIND[type] || "Place");
  const where = (feature.context || [])
    .filter((c) => /^(place|region)\./.test(String(c.id)))
    .map((c) => c.text)
    .filter((t, i, all) => t && t !== feature.text && all.indexOf(t) === i);
  const address = String(feature.place_name || feature.text || "").replace(/,\s*Philippines$/, "");
  const [lng, lat] = feature.center;
  return {
    name: feature.text || address.split(",")[0],
    detail: [kind, where.join(", ")].filter(Boolean).join(" · "),
    address,
    geo: { lat, lng, placeName: feature.place_name || address, city: placeCity(feature) },
  };
}

/**
 * The city or town a geocoding result sits in ("Marikina" for "Marikina
 * Public Market, Marikina, Metro Manila"), or "" when Mapbox doesn't say.
 */
export function placeCity(feature) {
  if (feature?.place_type?.includes("place")) return feature.text || "";
  return feature?.context?.find((c) => String(c.id).startsWith("place."))?.text || "";
}

/**
 * Real driving distance in kilometers between two geocoded points, and how
 * long Mapbox says the drive takes, in minutes (no traffic, no stops).
 */
export async function getDrivingRoute(origin, destination) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_TOKEN}&overview=false`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error("Couldn't calculate a route between those two points.");

  const data = await res.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No driving route found between those two points.");
  }

  const route = data.routes[0];
  return { distanceKm: route.distance / 1000, minutes: routeMinutes(route) };
}

/** A Mapbox route's duration in minutes, or null when it doesn't give one. */
export function routeMinutes(route) {
  const seconds = Number(route?.duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds / 60 : null;
}

/**
 * Cost formula — a simple, transparent placeholder: a base fare plus a
 * per-kilometer rate plus a per-kilogram rate. Easy to tune later once
 * you have real pricing data; the important part for the MVP is that it's
 * driven by a real calculated distance, not a guess.
 */
const BASE_FARE = 150;
const RATE_PER_KM = 15;
const RATE_PER_KG = 2;

export function estimateCost(distanceKm, quantityKg) {
  const cost =
    BASE_FARE + distanceKm * RATE_PER_KM + (quantityKg || 0) * RATE_PER_KG;
  return Math.round(cost);
}

/**
 * A simple static map image centered on a point, used for Phase 7
 * tracking. Deliberately not an interactive map library — a refreshed
 * image is enough to show "here's roughly where your delivery is right
 * now" without adding a whole mapping dependency for an MVP.
 */
export function staticMapUrl(
  lat,
  lng,
  { width = 600, height = 320, zoom = 13 } = {},
) {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+e0972f(${lng},${lat})/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
}

/**
 * The road a booking takes, as Mapbox's encoded polyline (simplified, so
 * the static map URL stays short), and the drive time in minutes. Line is
 * null if there's no route.
 */
export async function getRouteLine(origin, destination) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_TOKEN}&overview=simplified&geometries=polyline`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the route.");
  const data = await res.json();
  const route = data.routes?.[0];
  return { line: route?.geometry || null, minutes: routeMinutes(route) };
}

/**
 * A static map of one booking: the road in amber, A at pickup, B at
 * drop-off, and the truck when its position is known. The view fits
 * whatever is drawn. A route too long for a URL is left out (pins only).
 */
export function routeMapUrl(
  { pickup, dropoff, truck = null, line = null },
  { width = 600, height = 300 } = {},
) {
  const at = (p) => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`;
  const overlays = [];
  const path = line ? `path-4+e0972f-0.95(${encodeURIComponent(line)})` : "";
  if (path && path.length < 6000) overlays.push(path);
  overlays.push(`pin-s-a+b8b4a6(${at(pickup)})`, `pin-s-b+f3efe4(${at(dropoff)})`);
  if (truck) overlays.push(`pin-l-car+e0972f(${at(truck)})`);
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlays.join(",")}/auto/${width}x${height}@2x?padding=36&access_token=${MAPBOX_TOKEN}`;
}
