// Mapbox geocoding + driving-distance helpers, used to turn a typed
// address into coordinates and a real cost estimate.
//
// The token is a PUBLIC token (starts with pk.) — safe to use in browser
// code, same as the Supabase publishable key. It lives in config.js so
// there is exactly one place to change it; this file used to hardcode a
// second copy.

import { t } from "./i18n.js";
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
    ? (category ? category[0].toUpperCase() + category.slice(1) : t("Place"))
    : t(KIND[type] || "Place");
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
 * The road between two points, as Mapbox's encoded polyline at full detail
 * (it follows every bend; routeMapUrl thins it to fit the map URL), and the
 * drive time in minutes. Line is null if there's no route.
 */
export async function getRouteLine(origin, destination) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_TOKEN}&overview=full&geometries=polyline`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the route.");
  const data = await res.json();
  const route = data.routes?.[0];
  return { line: route?.geometry || null, minutes: routeMinutes(route) };
}

/** Encoded polyline (precision 5) → [[lat, lng], …]. A broken string gives []. */
export function decodeLine(text) {
  const points = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, byte;
    do {
      if (i >= text.length) return null;
      byte = text.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < text.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) return [];
    lat += dLat;
    lng += dLng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** [[lat, lng], …] → encoded polyline (precision 5). */
export function encodeLine(points) {
  let out = "", lat = 0, lng = 0;
  const put = (delta) => {
    let v = delta < 0 ? ~(delta << 1) : delta << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [a, b] of points) {
    const la = Math.round(a * 1e5), lo = Math.round(b * 1e5);
    put(la - lat);
    put(lo - lng);
    lat = la;
    lng = lo;
  }
  return out;
}

/** Douglas–Peucker: drop the points that sit within `tol` degrees of the road's shape. */
function thin(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop();
    const [ay, ax] = points[from], [by, bx] = points[to];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-12;
    let far = -1, worst = tol;
    for (let k = from + 1; k < to; k++) {
      const [py, px] = points[k];
      const off = Math.abs(dy * (px - ax) - dx * (py - ay)) / len;
      if (off > worst) { worst = off; far = k; }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([from, far], [far, to]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

/**
 * The road thinned only as much as the map URL needs: the smallest
 * tolerance (2 m and up) whose line fits in `budget` URL characters.
 * Null when even a rough line won't fit or the line can't be read.
 */
const fitted = new Map();
export function fitLine(line, budget) {
  if (!line) return null;
  if (encodeURIComponent(line).length <= budget) return line;
  const key = `${budget}:${line}`;
  if (fitted.has(key)) return fitted.get(key);
  const points = decodeLine(line);
  let best = null;
  if (points.length >= 2) {
    for (const tol of [0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005]) {
      const short = encodeLine(thin(points, tol));
      if (encodeURIComponent(short).length <= budget) { best = short; break; }
    }
  }
  if (fitted.size > 50) fitted.clear();
  fitted.set(key, best);
  return best;
}

/**
 * The part of a road still ahead of `at` (the truck): from `at` itself,
 * joined to the road where it passes nearest, on to the end. `off` is how
 * far `at` is from the road in metres, so a truck that left it can ask for
 * a new one. Null when the line can't be read.
 */
export function roadFrom(line, at) {
  const points = line ? decodeLine(line) : [];
  if (points.length < 2) return null;
  const kx = Math.cos((at.lat * Math.PI) / 180) * 111320, ky = 111320;
  let off = Infinity, seg = 0;
  for (let k = 0; k < points.length - 1; k++) {
    const x1 = (points[k][1] - at.lng) * kx, y1 = (points[k][0] - at.lat) * ky;
    const dx = (points[k + 1][1] - at.lng) * kx - x1, dy = (points[k + 1][0] - at.lat) * ky - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len2)) : 0;
    const d = Math.hypot(x1 + t * dx, y1 + t * dy);
    if (d < off) { off = d; seg = k; }
  }
  return { line: encodeLine([[at.lat, at.lng], ...points.slice(seg + 1)]), off };
}

/**
 * A static map of one booking. Before pickup: A, B and the planned road.
 * Once the truck is on the road: only the truck, B and the road between
 * them (`ahead`, starting at the truck), so the line moves with it and the
 * view zooms to what's left. B is drawn last so the truck never hides it.
 */
export function routeMapUrl(
  { pickup, dropoff, truck = null, line = null, ahead = null },
  { width = 600, height = 300 } = {},
) {
  const at = (p) => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`;
  const path = (style, l) => {
    const fit = fitLine(l, 6800);
    return fit ? [`path-${style}(${encodeURIComponent(fit)})`] : [];
  };
  const overlays = truck
    ? [...path("5+e0972f-0.95", ahead), `pin-l-car+e0972f(${at(truck)})`]
    : [...path("4+e0972f-0.95", line), `pin-s-a+b8b4a6(${at(pickup)})`];
  overlays.push(`pin-s-b+f3efe4(${at(dropoff)})`);
  // Almost there: fitting two pins 100 m apart would zoom to single houses,
  // so show the neighbourhood instead.
  const near = truck && Math.hypot((truck.lat - dropoff.lat) * 111320,
    (truck.lng - dropoff.lng) * 111320 * Math.cos((dropoff.lat * Math.PI) / 180)) < 800;
  const view = near
    ? `${((Number(truck.lng) + Number(dropoff.lng)) / 2).toFixed(5)},${((Number(truck.lat) + Number(dropoff.lat)) / 2).toFixed(5)},15/${width}x${height}@2x?`
    : `auto/${width}x${height}@2x?padding=72,84,28,28&`; // top right leaves room for Maximize
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlays.join(",")}/${view}access_token=${MAPBOX_TOKEN}`;
}
