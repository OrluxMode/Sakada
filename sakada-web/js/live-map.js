// The maximized map (Figma 365:3008 phone, 365:3042 desktop): the real map
// you can pinch, drag and zoom, with the truck moving as the driver sends
// positions and the line starting at the truck.
//
// Leaflet loads the first time a map opens (shared with "Pin on the map").

import { t } from "./i18n.js";
import { mapTilesUrl, decodeLine } from "./mapbox-client.js";
import { loadLeaflet } from "./pin-map.js";

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => matchMedia("(max-width: 1023px)").matches;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** A map pin as Leaflet HTML: amber with a car for the truck, cream B, grey A. */
function pin(L, kind) {
  const look = {
    truck: { fill: "#e0972f", mark: '<path d="M11 15.5h14v5H11zM13 15.5l1.6-3h6.8l1.6 3" fill="none" stroke="#17150c" stroke-width="1.6" stroke-linejoin="round"/><circle cx="14" cy="21" r="1.4" fill="#17150c"/><circle cx="22" cy="21" r="1.4" fill="#17150c"/>' },
    dropoff: { fill: "#f3efe4", mark: '<text x="18" y="21" text-anchor="middle" font-family="Public Sans, sans-serif" font-size="12" font-weight="700" fill="#17150c">B</text>' },
    pickup: { fill: "#b8b4a6", mark: '<text x="18" y="21" text-anchor="middle" font-family="Public Sans, sans-serif" font-size="12" font-weight="700" fill="#17150c">A</text>' },
  }[kind];
  return L.divIcon({
    className: `rq-live-pin rq-live-pin--${kind}`,
    html: `<svg width="36" height="44" viewBox="0 0 36 44" aria-hidden="true"><path d="M18 43s14-13.2 14-24.5a14 14 0 0 0-28 0C4 29.8 18 43 18 43z" fill="${look.fill}" stroke="#0b0c09" stroke-opacity="0.35"/>${look.mark}</svg>`,
    iconSize: [36, 44],
    iconAnchor: [18, 43],
  });
}

/**
 * @param {object} o
 * @param {HTMLElement} o.mapEl
 * @param {HTMLButtonElement} o.zoomIn
 * @param {HTMLButtonElement} o.zoomOut
 * @param {HTMLButtonElement} o.centerBtn  "Center on the truck"
 * @param {() => boolean} o.isOffline
 * @param {(text: string) => void} o.onProblem  the map couldn't load ("" clears it)
 */
export function createLiveMap({ mapEl, zoomIn, zoomOut, centerBtn, isOffline, onProblem }) {
  let L = null;
  let map = null;
  let route = null;
  const marks = {};
  let view = null;
  let following = true; // the map keeps the truck in sight until you drag it away
  let glide = 0;

  function padding() {
    // Room for the Close/caption row and the controls (and the panel on desktop)
    return isPhone()
      ? { paddingTopLeft: [40, 96], paddingBottomRight: [80, 40] }
      : { paddingTopLeft: [70, 100], paddingBottomRight: [100, 150] };
  }

  async function ready() {
    if (map) return;
    L = await loadLeaflet();
    map = L.map(mapEl, { zoomControl: false, attributionControl: false, minZoom: 5, maxZoom: 19 });
    L.tileLayer(mapTilesUrl(), { tileSize: 512, zoomOffset: -1, maxZoom: 19 }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution('© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> <a href="https://www.mapbox.com/map-feedback/" target="_blank" rel="noopener">Improve this map</a>')
      .addTo(map);
    route = L.polyline([], { color: "#e0972f", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
    map.on("dragstart", () => {
      following = false;
      centerBtn.setAttribute("aria-pressed", "false");
    });
  }

  function setMark(kind, at) {
    if (!at) {
      marks[kind]?.remove();
      delete marks[kind];
      return;
    }
    const ll = [Number(at.lat), Number(at.lng)];
    if (!marks[kind]) {
      marks[kind] = L.marker(ll, { icon: pin(L, kind), keyboard: false, interactive: false, zIndexOffset: { pickup: 0, truck: 500, dropoff: 1000 }[kind] }).addTo(map);
      return;
    }
    if (kind !== "truck" || reduceMotion()) return marks[kind].setLatLng(ll);
    // The truck glides to its new spot instead of jumping (600ms, ease-in-out).
    cancelAnimationFrame(glide);
    const from = marks.truck.getLatLng();
    const start = performance.now();
    const step = (now) => {
      const k = easeInOut(Math.min(1, (now - start) / 600));
      marks.truck.setLatLng([from.lat + (ll[0] - from.lat) * k, from.lng + (ll[1] - from.lng) * k]);
      if (k < 1) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }

  /** Everything worth seeing: the truck and B once it's moving, else A, B and the road. */
  function fit(animate) {
    const points = [view.dropoff, view.truck || view.pickup].map((p) => [Number(p.lat), Number(p.lng)]);
    const bounds = L.latLngBounds([...points, ...route.getLatLngs()]);
    map.fitBounds(bounds, { ...padding(), maxZoom: 16, animate });
  }

  function draw() {
    route.setLatLngs(view.line ? decodeLine(view.line) : []);
    setMark("pickup", view.truck ? null : view.pickup);
    setMark("truck", view.truck);
    setMark("dropoff", view.dropoff);
    centerBtn.hidden = !view.truck;
  }

  zoomIn.addEventListener("click", () => map?.zoomIn());
  zoomOut.addEventListener("click", () => map?.zoomOut());
  centerBtn.addEventListener("click", () => {
    if (!map || !view?.truck) return;
    following = true;
    centerBtn.setAttribute("aria-pressed", "true");
    map.setView([Number(view.truck.lat), Number(view.truck.lng)], Math.max(map.getZoom(), 15), { animate: !reduceMotion() });
  });

  return {
    /** Open on one booking: { pickup, dropoff, truck|null, line } (line = encoded road). */
    async show(next) {
      view = next;
      following = true;
      centerBtn.setAttribute("aria-pressed", "true");
      if (isOffline()) return onProblem(t("The map needs a connection. Check your signal and try again."));
      onProblem("");
      try {
        await ready();
      } catch {
        return onProblem(t("The map didn't load. Check your connection and try again."));
      }
      cancelAnimationFrame(glide);
      for (const kind of Object.keys(marks)) setMark(kind, null); // another booking's truck mustn't glide over
      map.invalidateSize();
      draw();
      fit(false);
    },
    /** A new truck position or road for the booking that's open. */
    update(next) {
      if (!map || !view) return;
      view = next;
      draw();
      if (following && view.truck) map.panTo([Number(view.truck.lat), Number(view.truck.lng)], { animate: !reduceMotion() });
    },
    /** The window changed size (it finished opening, the window resized). */
    resize() {
      map?.invalidateSize();
    },
    close() {
      cancelAnimationFrame(glide);
      view = null;
    },
  };
}
