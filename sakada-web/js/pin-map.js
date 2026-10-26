// The draggable map behind "Pin on the map": the pin stays in the middle and
// the map moves under it. When the map stops, Mapbox is asked what address
// is under the pin; the pinned point itself is kept exactly for the fare.
//
// Leaflet (vendor/leaflet, ~42 KB gzipped) loads the first time the map
// opens, so the Book page itself stays as light as before.

import { mapTilesUrl, placeAt, pinnedPlace } from "./mapbox-client.js";

const LUZON = { lat: 15.48, lng: 120.97 }; // central Luzon, when there's nothing better
const PH_BOUNDS = [[3.5, 115.5], [21.5, 128]];

let leafletLoad = null;
function loadLeaflet() {
  leafletLoad ??= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = new URL("../vendor/leaflet/leaflet.css", import.meta.url).href;
    const script = document.createElement("script");
    script.src = new URL("../vendor/leaflet/leaflet.js", import.meta.url).href;
    script.onload = () => resolve(window.L);
    script.onerror = () => {
      leafletLoad = null; // try again next time
      script.remove();
      reject(new Error("The map didn't load."));
    };
    document.head.append(css, script);
  });
  return leafletLoad;
}

const HINT = "Move the map so the pin sits on the exact spot.";
const LOCATION_COPY = {
  unavailable: "Location isn't available here. Move the map to your spot.",
  denied: "Location is off for this site. Move the map to your spot, or turn location on in your browser settings.",
  failed: "Couldn't find your location. Move the map to your spot.",
};

/**
 * @param {object} o
 * @param {HTMLElement} o.area      the map area (gets .is-moving while dragging)
 * @param {HTMLElement} o.mapEl     where Leaflet draws
 * @param {HTMLElement} o.addressEl the address under the pin
 * @param {HTMLElement} o.hintEl    the line under it (amber when location is off)
 * @param {HTMLButtonElement} o.useBtn    "Use this spot", enabled once there's an address
 * @param {HTMLButtonElement} o.locateBtn "Use my location"
 * @param {() => boolean} o.isOffline
 */
export function createPinMap({ area, mapEl, addressEl, hintEl, useBtn, locateBtn, isOffline }) {
  let map = null;
  let spot = null;
  let timer = 0;
  let lookup = null;
  let locating = false;

  function hint(text = HINT, warn = false) {
    hintEl.textContent = text;
    hintEl.classList.toggle("is-warn", warn);
  }

  function waiting(text = "Finding the address…") {
    spot = null;
    useBtn.disabled = true;
    addressEl.textContent = text;
    addressEl.classList.add("is-finding");
  }

  function moving() {
    area.classList.add("is-moving");
    clearTimeout(timer);
    lookup?.abort();
    waiting();
  }

  function settled() {
    area.classList.remove("is-moving");
    clearTimeout(timer);
    timer = setTimeout(lookUp, 250);
  }

  async function lookUp() {
    const { lat, lng } = map.getCenter();
    lookup = new AbortController();
    try {
      spot = isOffline() ? pinnedPlace(lat, lng, null) : await placeAt(lat, lng, { signal: lookup.signal });
    } catch (err) {
      if (err.name === "AbortError") return;
      spot = pinnedPlace(lat, lng, null); // no words for it, the point still counts
    }
    addressEl.textContent = spot.address;
    addressEl.classList.remove("is-finding");
    useBtn.disabled = false;
  }

  async function ready() {
    if (map) return map;
    const L = await loadLeaflet();
    map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      maxBounds: PH_BOUNDS,
      maxBoundsViscosity: 0.8,
      minZoom: 5,
      maxZoom: 19,
    });
    L.tileLayer(mapTilesUrl(), { tileSize: 512, zoomOffset: -1, maxZoom: 19 }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution('© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a>')
      .addTo(map);
    map.on("movestart", moving);
    map.on("moveend", settled);
    return map;
  }

  /** Centre the map on the user's location. Resolves false (with a note) if it can't. */
  function locate() {
    if (locating) return Promise.resolve(false);
    if (!navigator.geolocation || !window.isSecureContext) {
      hint(LOCATION_COPY.unavailable, true);
      return Promise.resolve(false);
    }
    locating = true;
    locateBtn.setAttribute("aria-busy", "true");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          hint();
          map?.setView([coords.latitude, coords.longitude], 17);
          resolve(true);
        },
        (err) => {
          hint(err.code === err.PERMISSION_DENIED ? LOCATION_COPY.denied : LOCATION_COPY.failed, true);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    }).finally(() => {
      locating = false;
      locateBtn.removeAttribute("aria-busy");
    });
  }

  locateBtn.addEventListener("click", () => locate());

  return {
    /**
     * Show the map at `start` ({lat, lng}) and `zoom`, or, with no start,
     * over central Luzon while the user's own location is asked for.
     */
    async open(start, zoom = 16) {
      hint();
      if (isOffline()) {
        waiting("The map needs a connection. Check your signal and try again.");
        return;
      }
      waiting("Loading the map…");
      try {
        await ready();
      } catch {
        waiting("The map didn't load. Check your connection and try again.");
        return;
      }
      map.invalidateSize();
      map.setView(start ? [start.lat, start.lng] : [LUZON.lat, LUZON.lng], start ? zoom : 8, { animate: false });
      waiting();
      settled();
      if (!start) locate();
    },
    /** The sheet changed size (it finished opening, the window resized). */
    resize() {
      map?.invalidateSize();
    },
    /** The address and exact point under the pin, or null while it's being found. */
    spot: () => spot,
  };
}
