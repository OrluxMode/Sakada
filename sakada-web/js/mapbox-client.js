// Mapbox geocoding + driving-distance helpers, used to turn a typed
// address into coordinates and a real cost estimate.
//
// The token below is a PUBLIC token (starts with pk.) — safe to use in
// browser code, same as the Supabase publishable key. If you ever need to
// change it, update it here and nowhere else.

const MAPBOX_TOKEN = "pk.eyJ1IjoicWFkcmlhbmNhcmxvIiwiYSI6ImNtdTJpMW5iYzA3MHMyeXNlcW1oYnpsODkifQ.eIvugh9G7UAa-sTCkJmZ7g";

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

  const [lng, lat] = data.features[0].center;
  return { lat, lng, placeName: data.features[0].place_name };
}

/** Real driving distance in kilometers between two geocoded points. */
export async function getDrivingDistanceKm(origin, destination) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${MAPBOX_TOKEN}&overview=false`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error("Couldn't calculate a route between those two points.");

  const data = await res.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No driving route found between those two points.");
  }

  return data.routes[0].distance / 1000; // meters -> km
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
