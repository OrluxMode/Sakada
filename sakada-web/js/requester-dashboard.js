import { sanitizeText } from "./sanitize.js";
import { supabase } from "./supabase-client.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  estimateCost,
  getRouteLine,
  routeMapUrl,
} from "./mapbox-client.js";
import {
  cancelMyDelivery,
  createDelivery,
  getMyDeliveries,
  getMyDeliveryDrivers,
  subscribeToDeliveryUpdates,
} from "./deliveries.js";
import { submitRating, getMyRatingsForDeliveries } from "./ratings.js";
import {
  getMyNotifications,
  markNotificationRead,
  subscribeToNotifications,
} from "./notifications.js";
import {
  HISTORY_STATUSES,
  statusLabel,
  timeAgo,
  isQuoteStale,
  rebookValues,
  renderStageStepper,
  STAGES,
  initialsFor,
  groupActive,
  findDelivery,
  shipmentProgress,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  shortPlace,
  bookingErrorCopy,
  contactUrl,
  parseTrackHash,
  trackHeadline,
  ratingSummary,
} from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { enableSheetDrag } from "./sheet-drag.js";
import { paginate } from "./pagination.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";
import {
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
  checkTrackQuery,
  localDateString,
} from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";

// One script serves both requester dashboards; the page says which role it's for.
const ROLE = document.body.dataset.role;
if (ROLE !== "farmer" && ROLE !== "vendor") {
  throw new Error(`requester-dashboard.js: unexpected data-role "${ROLE}"`);
}
const CONTACT = "../../pages/contact.html";

const profile = await requireRole(ROLE, "../../auth/login.html", "../../index.html");
if (!profile) throw new Error("redirecting");

document.getElementById("pageLoader")?.classList.add("page-loader--hidden");
initOfflineDetection();
updateLastLogin();

const $ = (id) => document.getElementById(id);
const firstName = profile.full_name.split(" ")[0];
document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = profile.full_name));
document.querySelector(".rq-account")?.setAttribute("title", profile.full_name); // long names are cut off there
document.querySelectorAll("[data-initials]").forEach((el) => (el.textContent = initialsFor(profile.full_name)));
// Greeting only: "yayan" reads as "Yayan". The saved name is left as typed.
$("homeTitle").textContent = `${firstName.charAt(0).toLocaleUpperCase("en-PH")}${firstName.slice(1)}`;
supabase.auth.getUser().then(({ data }) => {
  if (data?.user?.email) $("profileEmail").textContent = ` · ${data.user.email}`;
});
$("signOutBtn").addEventListener("click", () => signOut("../../index.html"));

// ---------- Tabs (hash sections in one page, so realtime stays connected) ----------
const VIEWS = ["home", "track", "book", "history", "profile"];
let viewsReady = false;
// The booking the Track page shows (#track/SK-00142), or null for the Track tab itself.
let trackCode = null;
function showView(hash, { focus = false } = {}) {
  let view = hash;
  const track = parseTrackHash(hash);
  if (track) {
    view = "track";
    trackCode = track.code;
  }
  if (view === "deliveryForm") view = "book"; // the landing page's "Book a Delivery" link
  if (!VIEWS.includes(view)) view = "home";
  const changed = document.body.dataset.view !== view;
  document.body.dataset.view = view;
  // Moving inside Track (list -> one shipment) gets the same small entrance as a tab switch.
  if (view === "track") renderTrack({ animate: !changed && viewsReady });
  if (changed && viewsReady) enterView(view);
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (focus) {
    const heading = $(`view-${view}`)?.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}
window.addEventListener("hashchange", () => showView(location.hash.slice(1), { focus: true }));
/**
 * Switch view from code that then moves focus itself (pushState fires no
 * hashchange). The entry is marked so the Track page's Back can return here.
 */
function goTo(view) {
  if (location.hash !== `#${view}`) history.pushState({ back: true }, "", `#${view}`);
  showView(view);
  window.scrollTo({ top: 0 });
}

/**
 * Switching tabs: the new page fades in while rising 6px, 180ms. Tabs are
 * used many times a day, so it stays this small, has no exit, and never
 * delays the switch. Desktop's Book panel is always on screen, so it stays put.
 */
function enterView(view) {
  const el = $(`view-${view}`);
  if (!el || (view === "book" && matchMedia("(min-width: 1024px)").matches)) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.animate(
    still ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
    { duration: still ? 120 : 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}

// ---------- Sheets ----------
// Sheets slide up from the bottom (phones) or fade in centred (desktop) and
// leave the same way. Every close path goes through closeSheet.
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => matchMedia("(max-width: 1023px)").matches;

// iOS Safari only applies :active press styles once a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });

function openSheet(dialog) {
  if (dialog._closing) {
    cancelClose(dialog);
    return;
  }
  dialog._returnFocus = document.activeElement;
  dialog.showModal();
  // Two frames so the off-screen start position paints before it moves.
  requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add("is-shown")));
}
/** A finger or tap caught a closing sheet: bring it back from where it is. */
function cancelClose(dialog) {
  if (!dialog._closing) return;
  dialog._closing.cancel();
  dialog.classList.add("is-shown");
}
/** Resolves once the sheet has finished leaving and is closed. */
function closeSheet(dialog, { immediate = false } = {}) {
  if (!dialog.open) return Promise.resolve();
  if (dialog._closing && !immediate) return dialog._closing.done;
  dialog._closing?.cancel();
  let finish;
  let timer;
  const done = new Promise((resolve) => {
    finish = () => {
      clearTimeout(timer);
      dialog.removeEventListener("transitionend", onEnd);
      dialog._closing = null;
      dialog.close();
      resolve();
    };
  });
  const onEnd = (e) => {
    if (e.target === dialog && e.propertyName === "transform") finish();
  };
  dialog.classList.remove("is-shown");
  if (immediate || reduceMotion()) {
    finish();
    return done;
  }
  dialog.addEventListener("transitionend", onEnd);
  timer = setTimeout(finish, 360);
  dialog._closing = {
    done,
    cancel: () => {
      clearTimeout(timer);
      dialog.removeEventListener("transitionend", onEnd);
      dialog._closing = null;
    },
  };
  return done;
}
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => dialog._returnFocus?.focus?.());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeSheet(dialog); // tap on the scrim
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault(); // Escape / Android back: leave the same way as Close
    closeSheet(dialog);
  });
  dialog.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", () => closeSheet(dialog)));
  enableSheetDrag(dialog, {
    canDrag: isPhone,
    onGrab: () => cancelClose(dialog),
    onDismiss: ({ offscreen }) => closeSheet(dialog, { immediate: offscreen }),
  });
});

// ---------- Booking form ----------
const form = $("deliveryForm");
const estimateBtn = $("estimateBtn");
const confirmBtn = $("confirmBtn");
const quoteEl = $("quote");
const quoteStaleEl = $("quoteStale");
const messageEl = $("formMessage");
const inputs = {
  pickupAddress: $("pickupAddress"),
  dropoffAddress: $("dropoffAddress"),
  goodsDescription: $("goodsDescription"),
  quantityKg: $("quantityKg"),
  scheduledPickup: $("scheduledPickup"),
  notes: $("notes"),
};
inputs.scheduledPickup.min = localDateString(); // no pickups in the past

const BOOKING_RULES = [
  [inputs.pickupAddress, (v) => checkAddress(v, "pickup")],
  [inputs.dropoffAddress, (v) => checkAddress(v, "drop-off")],
  [inputs.goodsDescription, checkGoods],
  [inputs.quantityKg, checkKg],
  [inputs.scheduledPickup, (v) => checkPickupDate(v)],
  [inputs.notes, checkNotes],
];
clearWhenFixed(BOOKING_RULES);

let pendingQuote = null;

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}
function clearMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy ? `<span class="spinner" aria-hidden="true"></span>${label}` : label;
}
/** Ease an element in each time it's revealed (restarts the animation). */
function arrive(el) {
  el.classList.remove("rq-arrive");
  void el.offsetWidth;
  el.classList.add("rq-arrive");
}
// "Booked." stays for 2 seconds, then fades and folds away so Home slides up instead of jumping.
let bookedTimer = 0;
function showBooked() {
  const el = $("bookedBanner");
  clearTimeout(bookedTimer);
  el.getAnimations().forEach((a) => a.cancel()); // a second booking mid-fade starts fresh
  el.hidden = false;
  arrive(el);
  bookedTimer = setTimeout(hideBooked, 2000);
}
async function hideBooked() {
  const el = $("bookedBanner");
  if (el.hidden) return;
  try {
    if (reduceMotion()) {
      await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" }).finished;
    } else {
      await el.animate(
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }],
        { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
      ).finished;
      const { marginBottom, paddingTop, paddingBottom } = getComputedStyle(el);
      await el.animate(
        [
          { height: `${el.offsetHeight}px`, marginBottom, paddingTop, paddingBottom, opacity: 0 },
          { height: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px", borderWidth: "0px", opacity: 0 },
        ],
        { duration: 220, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
      ).finished;
    }
  } catch {
    return; // cancelled by a new booking, which shows the banner again
  }
  el.hidden = true;
  el.getAnimations().forEach((a) => a.cancel());
}

function resetQuote({ stale = false } = {}) {
  pendingQuote = null;
  quoteEl.hidden = true;
  quoteStaleEl.hidden = !stale;
  confirmBtn.hidden = true;
  estimateBtn.hidden = false;
  estimateBtn.textContent = stale ? "Get the fare again" : "Get the fare";
  document.body.classList.remove("rq-has-quote");
}

["pickupAddress", "dropoffAddress", "quantityKg"].forEach((id) => {
  inputs[id].addEventListener("input", () => {
    if (pendingQuote) resetQuote({ stale: true });
  });
});
form.addEventListener("input", clearMessage);

function showBookingError(error) {
  const copy = bookingErrorCopy(error);
  if (copy.field === "pickup") {
    showFieldError(inputs.pickupAddress, copy.message);
    inputs.pickupAddress.focus();
  } else if (copy.field === "dropoff") {
    showFieldError(inputs.dropoffAddress, copy.message);
    inputs.dropoffAddress.focus();
  } else {
    showMessage(copy.message);
  }
  if (copy.kind === "mismatch") resetQuote({ stale: true });
}

async function geocodeLabelled(address, which) {
  try {
    return await geocodeAddress(address);
  } catch (err) {
    err.which = which;
    throw err;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (getIsOffline()) {
    showMessage("No connection. Check your signal and try again. Your details are still here.");
    return;
  }
  if (!validateFields(BOOKING_RULES)) return;
  clearMessage();
  setBusy(estimateBtn, true, "Getting the fare…");
  try {
    const pickupAddress = inputs.pickupAddress.value.trim();
    const dropoffAddress = inputs.dropoffAddress.value.trim();
    const quantityKg = parseFloat(inputs.quantityKg.value);
    const [pickup, dropoff] = await Promise.all([
      geocodeLabelled(pickupAddress, "pickup"),
      geocodeLabelled(dropoffAddress, "dropoff"),
    ]);
    const distanceKm = await getDrivingDistanceKm(pickup, dropoff);
    const cost = estimateCost(distanceKm, quantityKg);
    pendingQuote = { pickupAddress, dropoffAddress, pickup, dropoff, distanceKm, quantityKg, cost };

    $("quoteAmount").textContent = formatPeso(cost);
    $("quoteBreakdown").textContent = fareBreakdown(distanceKm, quantityKg);
    $("matchedPickup").textContent = `Pickup: ${pickup.placeName}`;
    $("matchedDropoff").textContent = `Drop-off: ${dropoff.placeName}`;
    quoteStaleEl.hidden = true;
    quoteEl.hidden = false;
    arrive(quoteEl);
    estimateBtn.hidden = true;
    confirmBtn.hidden = false;
    confirmBtn.textContent = `Confirm booking · ${formatPeso(cost)}`;
    document.body.classList.add("rq-has-quote");
    quoteEl.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  } catch (err) {
    showBookingError(err);
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.removeAttribute("aria-busy");
    if (!pendingQuote) estimateBtn.textContent = quoteStaleEl.hidden ? "Get the fare" : "Get the fare again";
  }
});

$("notRight").addEventListener("click", () => {
  inputs.pickupAddress.focus();
  inputs.pickupAddress.select();
});

confirmBtn.addEventListener("click", async () => {
  if (!pendingQuote) return;
  if (!validateFields(BOOKING_RULES)) return;
  if (isQuoteStale(pendingQuote, {
    pickupAddress: inputs.pickupAddress.value,
    dropoffAddress: inputs.dropoffAddress.value,
    quantityKg: inputs.quantityKg.value,
  })) {
    resetQuote({ stale: true });
    return;
  }
  if (getIsOffline()) {
    showMessage("No connection. Check your signal and try again. Your details are still here.");
    return;
  }
  const label = confirmBtn.textContent;
  setBusy(confirmBtn, true, "Booking…");
  let result;
  try {
    result = await createDelivery({
      requester_id: profile.id,
      pickup_address: pendingQuote.pickupAddress,
      pickup_lat: pendingQuote.pickup.lat,
      pickup_lng: pendingQuote.pickup.lng,
      dropoff_address: pendingQuote.dropoffAddress,
      dropoff_lat: pendingQuote.dropoff.lat,
      dropoff_lng: pendingQuote.dropoff.lng,
      goods_description: inputs.goodsDescription.value.trim(),
      quantity_kg: pendingQuote.quantityKg,
      scheduled_pickup_at: inputs.scheduledPickup.value
        ? new Date(inputs.scheduledPickup.value).toISOString()
        : null,
      notes: inputs.notes.value.trim() || null,
      estimated_cost: pendingQuote.cost,
      distance_km: pendingQuote.distanceKm,
    });
  } catch (err) {
    result = { error: err };
  }
  confirmBtn.disabled = false;
  confirmBtn.removeAttribute("aria-busy");
  confirmBtn.textContent = label;

  if (result.error) {
    showBookingError(result.error);
    return;
  }
  form.reset();
  resetQuote();
  highlightId = result.data?.id || null;
  showBooked();
  goTo("home");
  await loadDeliveries();
});

// ---------- Rendering ----------
let deliveries = [];
let driversById = new Map();
let ratingsMap = new Map();
let highlightId = null;
let historyFilter = "all";
let historyPage = 1;
const activeSubscriptions = new Map();


const esc = (v) => sanitizeText(v == null ? "" : String(v));
const day = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const time = (iso) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

function titleLine(d) {
  // Old bookings may have no weight saved; the number and "kg" never split across lines.
  if (d.quantity_kg == null) return esc(d.goods_description);
  return `${esc(d.goods_description)} · ${Number(d.quantity_kg).toLocaleString("en-PH")}&nbsp;kg`;
}
/** The fare, or a plain note when an old booking has none saved (never "₱0"). */
function fareAmount(d) {
  return d.estimated_cost == null
    ? `<span class="rq-fare-amount rq-fare-amount--none">Fare not set</span>`
    : `<span class="rq-fare-amount">${formatPeso(d.estimated_cost)}</span>`;
}
function metaLine(d) {
  const bits = [esc(d.delivery_code)];
  if (d.status === "pending") {
    if (d.scheduled_pickup_at) bits.push(`Pickup ${day(d.scheduled_pickup_at)}`);
    bits.push(`Requested ${time(d.created_at)}`);
  } else if (HISTORY_STATUSES.includes(d.status)) {
    bits.push(day(d.updated_at));
  } else if (d.scheduled_pickup_at) {
    bits.push(`Pickup ${day(d.scheduled_pickup_at)}`);
  }
  return bits.join(" · ");
}
const firstNameOf = (d, fallback) => driversById.get(d.id)?.driver_name?.split(" ")[0] || fallback;
function starPicker(d) {
  return `
    <div class="rq-rate" data-rate-for="${esc(d.id)}">
      <p class="rq-rate-q">How was ${esc(firstNameOf(d, "your driver"))}?</p>
      <div class="rq-stars" role="radiogroup" aria-label="Rating">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-star="${n}"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}
      </div>
      <label class="rq-sr" for="comment-${esc(d.id)}">Comment (optional)</label>
      <textarea id="comment-${esc(d.id)}" rows="2" maxlength="500" placeholder="Add a comment (optional)"></textarea>
      <button type="button" class="rq-btn" data-send-rating disabled>Send rating</button>
    </div>`;
}


// ---------- Home: status tiles, then one card per active shipment ----------
const STATUS_WORD = { pending: "Waiting for a driver", driver_assigned: "Driver assigned", picked_up: "Picked up", in_transit: "In transit" };
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const shortRoute = (d) => `${esc(shortPlace(d.pickup_address))} → ${esc(shortPlace(d.dropoff_address))}`;
const lateList = () => deliveries.filter((d) => pickupPassed(d));

const keep = (text) => text.replace(/ /g, "&nbsp;"); // "Next: Delivered", "Oct 22" never split
/** The line under the bars on the Track page: when this stage started, and what's next. */
function trackStatusLine(d) {
  const at = d.status_changed_at || d.updated_at;
  const when = isToday(at) ? `today, ${time(at)}` : `${day(at)}, ${time(at)}`;
  const since = isToday(at) ? time(at) : day(at);
  if (d.status === "pending") {
    if (pickupPassed(d)) return `<span class="rq-chip">Pickup date passed · drivers can't see it</span>`;
    return `Requested ${isToday(d.created_at) ? `today, ${time(d.created_at)}` : day(d.created_at)}`;
  }
  if (d.status === "driver_assigned") return `Accepted ${since} · ${keep("Next: Picked up")}`;
  if (d.status === "picked_up") return `Picked up ${isToday(at) ? "at" : "on"} ${since} · ${keep("Next: In transit")}`;
  if (d.status === "in_transit") return `In transit since ${since} · ${keep("Next: Delivered")}`;
  if (d.status === "delivered") return `Delivered ${when}`;
  return `Cancelled ${day(at)}`;
}

/** Bottom-left of a shipment card: a small label and the one fact that matters now. */
function shipmentFact(d) {
  const at = d.status_changed_at || d.updated_at;
  const when = isToday(at) ? time(at) : day(at);
  if (pickupPassed(d)) return ["Pickup date passed", "Book a new date"];
  if (d.status === "in_transit") return ["In transit", `Since ${when}`];
  if (d.status === "picked_up") return ["Picked up", isToday(at) ? `At ${when}` : `On ${when}`];
  const label = d.status === "pending" ? "Waiting for a driver" : `${driversById.get(d.id)?.driver_name?.split(" ")[0] || "Driver"} picks up`;
  return [label, d.scheduled_pickup_at ? `Pickup ${day(d.scheduled_pickup_at)}` : "Pickup date not set"];
}

const TRUCK = `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h11v8H2z"/><path d="M13 10h4l3 3v2h-7"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;
const TILE_ICON = {
  waiting: `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  road: TRUCK,
  delivered: `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/></svg>`,
};

function renderTiles(active) {
  const counts = {
    waiting: active.filter((d) => d.status === "pending").length,
    road: active.filter((d) => d.status !== "pending").length,
    delivered: deliveries.filter((d) => d.status === "delivered").length,
  };
  const tile = (key, label) => `
    <button type="button" class="rq-tile" data-tile="${key}" aria-label="${counts[key]} ${label}">
      ${TILE_ICON[key]}
      <span class="rq-tile-count" aria-hidden="true">${counts[key].toLocaleString("en-PH")}</span>
      <span class="rq-tile-label" aria-hidden="true">${label}</span>
    </button>`;
  $("statusTiles").innerHTML = tile("waiting", "Waiting") + tile("road", "On the road") + tile("delivered", "Delivered");
}

// ---------- Real maps on the shipment cards ----------
// The road between pickup and drop-off never changes, so each booking's
// route is fetched once and kept for the session.
const routeLines = new Map();
const routeLoading = new Set();
const ROUTE_KEY = (id) => `sakada.route.${id}`;
const hasCoords = (d) => d.pickup_lat != null && d.pickup_lng != null && d.dropoff_lat != null && d.dropoff_lng != null;
const truckAt = (d) => (d.status === "picked_up" || d.status === "in_transit") && d.current_lat && d.current_lng
  ? { lat: d.current_lat, lng: d.current_lng }
  : null;
function cachedLine(id) {
  if (routeLines.has(id)) return routeLines.get(id);
  try {
    const saved = sessionStorage.getItem(ROUTE_KEY(id));
    if (saved !== null) routeLines.set(id, saved || null);
  } catch { /* private mode: fetch again next time */ }
  return routeLines.get(id) ?? null;
}
function shipMapUrl(d) {
  return routeMapUrl({
    pickup: { lat: d.pickup_lat, lng: d.pickup_lng },
    dropoff: { lat: d.dropoff_lat, lng: d.dropoff_lng },
    truck: truckAt(d),
    line: cachedLine(d.id),
  });
}
/** Fetch the road for cards that don't have it yet, then redraw just their maps. */
function loadRouteLines(list) {
  list.filter((d) => hasCoords(d) && !routeLines.has(d.id) && cachedLine(d.id) === null && !routeLoading.has(d.id)).forEach((d) => {
    routeLoading.add(d.id);
    getRouteLine({ lat: d.pickup_lat, lng: d.pickup_lng }, { lat: d.dropoff_lat, lng: d.dropoff_lng })
      .then((line) => {
        routeLines.set(d.id, line);
        try { sessionStorage.setItem(ROUTE_KEY(d.id), line || ""); } catch { /* fine */ }
        if (!line) return;
        for (const img of [$(`shipmap-${d.id}`), $(`trackmap-${d.id}`)]) if (img) swapMap(img, shipMapUrl(d));
      }, () => {}) // no road: the pins alone still show where it goes
      .finally(() => routeLoading.delete(d.id));
  });
}
/** Load a new map image off-screen, then fade it in over the old one. */
function swapMap(img, url) {
  const next = new Image();
  next.src = url;
  next.decode().then(() => {
    if (reduceMotion() || !img.isConnected) return (img.src = url);
    // No slide or zoom: it's a map you read.
    const layer = img.cloneNode();
    layer.removeAttribute("id");
    layer.className = "rq-map-next";
    layer.src = url;
    img.after(layer);
    layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" })
      .finished.then(() => {
        img.src = url;
        layer.remove();
      });
  }, () => {});
}
// Card maps fade in once they've loaded; one that fails falls back to the route line
// (on the Track page, the map just steps aside).
document.addEventListener("load", (e) => {
  if (e.target.classList?.contains("rq-ship-map-img")) e.target.classList.remove("is-loading");
}, true);
document.addEventListener("error", (e) => {
  if (!e.target.classList?.contains("rq-ship-map-img")) return;
  e.target.closest(".rq-ship")?.classList.remove("has-map");
  e.target.closest(".rq-track-map")?.setAttribute("hidden", "");
}, true);

function shipmentCard(d, i, all) {
  const p = shipmentProgress(d.status);
  const [label, value] = shipmentFact(d);
  const late = pickupPassed(d);
  const step = STAGES.indexOf(d.status);
  const map = hasCoords(d);
  const where = `${esc(shortPlace(d.pickup_address))} to ${esc(shortPlace(d.dropoff_address))}`;
  return `
    <article class="rq-card rq-ship${map ? " has-map" : ""}${late ? " is-late" : ""}${d.id === highlightId ? " rq-card--new" : ""}" data-delivery-id="${esc(d.id)}" tabindex="-1"${all.length > 1 ? ` aria-roledescription="slide" aria-label="${i + 1} of ${all.length}"` : ""}>
      <p class="rq-ship-what">${esc(d.delivery_code)} · ${titleLine(d)}</p>
      <div class="rq-ship-ends">
        <p><span class="rq-ship-label">From</span>${esc(shortPlace(d.pickup_address))}</p>
        <p><span class="rq-ship-label">To</span>${esc(shortPlace(d.dropoff_address))}</p>
      </div>
      ${map ? `<figure class="rq-ship-map"><img id="shipmap-${esc(d.id)}" class="rq-ship-map-img is-loading" src="${shipMapUrl(d)}" alt="Map of the road from ${where}${truckAt(d) ? ", with the truck where it is now" : ""}. ${esc(STATUS_WORD[d.status])}." width="600" height="300" loading="lazy" decoding="async" /></figure>` : ""}
      <div class="rq-ship-route" style="--p: ${p}" role="img" aria-label="Step ${step + 1} of 5, ${esc(STATUS_WORD[d.status])}">
        <span class="rq-ship-fill"></span>
        <span class="rq-ship-truck">${TRUCK}</span>
      </div>
      <div class="rq-ship-foot">
        <p><span class="rq-ship-label">${esc(label)}</span><strong class="rq-ship-value">${esc(value)}</strong></p>
        <button type="button" class="rq-pill" data-details="${esc(d.id)}">View details</button>
      </div>
    </article>`;
}

function firstVisit() {
  return `
    <div class="rq-card rq-empty">
      <h2 class="rq-display">No deliveries yet</h2>
      <p>Book your first truck. You see the fare before you confirm: ₱150 base + ₱15 per km + ₱2 per kg, tolls included.</p>
      <ol class="rq-steps">
        <li>A driver accepts your booking</li>
        <li>They pick up your goods</li>
        <li>You follow it to drop-off, where whoever receives the goods pays the driver in cash</li>
      </ol>
      <a class="rq-btn" href="#book">Book a truck</a>
    </div>`;
}

function renderHome() {
  const active = deliveries.filter((d) => !HISTORY_STATUSES.includes(d.status));
  const { onRoad, assigned, waiting } = groupActive(active);
  const any = deliveries.length > 0;
  $("trackForm").hidden = !any;
  $("statusSection").hidden = !any;
  if (any) renderTiles(active);
  const ordered = [...onRoad, ...assigned, ...waiting];
  const keepId = currentShipId(); // stay on the card you swiped to when live data re-renders
  const many = ordered.length > 1;
  $("homeLists").innerHTML = !any
    ? firstVisit()
    : ordered.length
      ? `<section class="rq-section" aria-labelledby="shipTitle">
          <div class="rq-section-head">
            <h2 class="rq-section-title" id="shipTitle">${many ? "Active shipments" : "Active shipment"}</h2>
            ${many ? `<p class="rq-ship-pos" id="shipPos" aria-hidden="true">1 of ${ordered.length}</p>` : ""}
          </div>
          <div class="rq-ships${many ? " is-many" : ""}" id="shipList"${many ? ` role="region" aria-roledescription="carousel" aria-label="Active shipments, swipe for more" tabindex="0"` : ""}>
            ${ordered.map(shipmentCard).join("")}
          </div>
          ${many ? `<div class="rq-dots" id="shipDots">${ordered.map((d, i) => `<button type="button" class="rq-dot" data-ship-dot="${i}" aria-label="Show ${esc(d.delivery_code)}"${i === 0 ? ` aria-current="true"` : ""}></button>`).join("")}</div>` : ""}
        </section>`
      : `<section class="rq-section" aria-labelledby="shipTitle">
          <h2 class="rq-section-title" id="shipTitle">Active shipment</h2>
          <div class="rq-card rq-empty"><p><strong>Nothing on the road right now.</strong></p><p class="rq-muted">Your past deliveries are in History.</p><a class="rq-btn" href="#book">Book a truck</a></div>
        </section>`;
  markAdvanced(active);
  if (keepId) goToShip(keepId, { instant: true });
  loadRouteLines(ordered);
}

// ---------- Swiping between shipment cards (native scroll-snap) ----------
function shipCards() {
  return [...($("shipList")?.querySelectorAll(".rq-ship") || [])];
}
/** The card the row is resting on: the one whose left edge is nearest the row's. */
function shipIndex() {
  const list = $("shipList");
  const cards = shipCards();
  if (!list || !cards.length) return 0;
  const left = list.getBoundingClientRect().left;
  let best = 0;
  cards.forEach((c, i) => {
    if (Math.abs(c.getBoundingClientRect().left - left) < Math.abs(cards[best].getBoundingClientRect().left - left)) best = i;
  });
  return best;
}
function currentShipId() {
  return $("shipList")?.classList.contains("is-many") ? shipCards()[shipIndex()]?.dataset.deliveryId : null;
}
function goToShip(id, { instant = false } = {}) {
  const list = $("shipList");
  const card = shipCards().find((c) => c.dataset.deliveryId === id);
  if (!list || !card || !list.classList.contains("is-many")) return;
  const behavior = instant || reduceMotion() ? "auto" : "smooth";
  list.scrollTo({ left: card.offsetLeft - list.firstElementChild.offsetLeft, behavior });
  if (instant) markShip();
}
function markShip() {
  const i = shipIndex();
  const pos = $("shipPos");
  if (pos) pos.textContent = `${i + 1} of ${shipCards().length}`;
  $("shipDots")?.querySelectorAll("[data-ship-dot]").forEach((dot) => {
    if (Number(dot.dataset.shipDot) === i) dot.setAttribute("aria-current", "true");
    else dot.removeAttribute("aria-current");
  });
}
let shipFrame = 0;
document.addEventListener("scroll", (e) => {
  if (e.target.id !== "shipList") return;
  cancelAnimationFrame(shipFrame);
  shipFrame = requestAnimationFrame(markShip);
}, { capture: true, passive: true });

/** Re-render Home while sliding whatever moved from where it was (FLIP). */
function withFlip(change) {
  const key = (el) => el.dataset.deliveryId || el.id || el.textContent.trim().slice(0, 40);
  const els = () => [...$("homeLists").querySelectorAll(".rq-section-title, .rq-card")];
  const before = new Map(els().map((el) => [key(el), el.getBoundingClientRect().top]));
  change();
  if (reduceMotion()) return;
  els().forEach((el) => {
    const was = before.get(key(el));
    if (was === undefined) return;
    const dy = was - el.getBoundingClientRect().top;
    if (Math.abs(dy) >= 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(0.32, 0.72, 0, 1)" });
  });
}

// Statuses as of the last Home render, so a driver accepting (or picking up)
// can be marked once. Null until the first render: page load never animates.
let lastStatus = null;
function markAdvanced(active) {
  if (lastStatus) {
    for (const d of active) {
      const before = lastStatus.get(d.id);
      if (!before || STAGES.indexOf(d.status) <= STAGES.indexOf(before)) continue;
      $("homeLists").querySelector(`.rq-card[data-delivery-id="${CSS.escape(d.id)}"]`)?.classList.add("is-advanced");
    }
  }
  lastStatus = new Map(deliveries.map((d) => [d.id, d.status]));
}

// ---------- Track page (Figma mobile "Track v2") ----------
// One booking in full at #track/SK-00142. The Track tab itself (#track)
// opens the only active booking, lists several, or says nothing is moving.
const BACK = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;
const CHEVRON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;
const STAR = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>`;
const LOCK = `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const ON_ROAD = (d) => d.status === "picked_up" || d.status === "in_transit";

/** On the road first, then driver assigned, then waiting: the order everywhere. */
const activeOrdered = () => {
  const { onRoad, assigned, waiting } = groupActive(deliveries.filter((d) => !HISTORY_STATUSES.includes(d.status)));
  return [...onRoad, ...assigned, ...waiting];
};

function trackTop(title, back) {
  return `
    <div class="rq-track-top">
      ${back ? `<button type="button" class="rq-back" data-track-back aria-label="Back">${BACK}</button>` : ""}
      <p class="rq-track-where">${title}</p>
      <p class="rq-track-logo" aria-hidden="true">SAKA<span>DA</span></p>
    </div>`;
}
const trackHead = ([one, two]) => `<h1 id="trackTitle" class="rq-track-head" tabindex="-1">${esc(one)}<br /><span>${esc(two)}</span></h1>`;

function trackDriver(d) {
  const row = driversById.get(d.id);
  const truck = truckAt(d);
  const showMap = hasCoords(d) && !HISTORY_STATUSES.includes(d.status);
  const first = firstNameOf(d, "the driver");
  let note = "";
  if (d.status === "driver_assigned") note = `The truck shows on the map once ${esc(first)} picks up your goods.`;
  else if (ON_ROAD(d) && !truck) note = "Location not shared yet. You'll see the truck once the driver starts sharing.";
  if (!row?.driver_name && !showMap && !note) return "";
  let who = "";
  if (row?.driver_name) {
    const vehicle = [row.vehicle_type, row.vehicle_plate && `Plate ${row.vehicle_plate}`].filter(Boolean).map(esc).join(" · ");
    const rating = ratingSummary(row);
    who = `
      <div class="rq-tdriver">
        <span class="rq-avatar" aria-hidden="true">${esc(initialsFor(row.driver_name))}</span>
        <p class="rq-tdriver-who">
          <span class="rq-tlabel">Driver</span>
          <span class="rq-tdriver-name">${esc(row.driver_name)}</span>
          <span class="rq-tdriver-car">${vehicle || "Vehicle not added yet"}</span>
        </p>
        ${rating ? `<p class="rq-trating">${rating.avg
          ? `<span class="rq-trating-avg" aria-label="Rated ${rating.avg} out of 5">${STAR}${rating.avg}</span><span class="rq-trating-count">${rating.label}</span>`
          : `<span class="rq-trating-avg">New driver</span><span class="rq-trating-count">${rating.label}</span>`}</p>` : ""}
      </div>`;
  }
  const where = `${esc(shortPlace(d.pickup_address))} to ${esc(shortPlace(d.dropoff_address))}`;
  // The caption says how old the truck's position is, on the map itself.
  const map = showMap ? `
    <figure class="rq-track-map">
      <img id="trackmap-${esc(d.id)}" class="rq-ship-map-img is-loading" src="${shipMapUrl(d)}" alt="Map of the road from ${where}${truck ? ", with the truck where it is now" : ""}." width="600" height="300" decoding="async" />
      <figcaption id="track-caption-${esc(d.id)}">${truck ? `Truck here ${timeAgo(d.updated_at)}` : "Route"}</figcaption>
    </figure>` : "";
  return `<div class="rq-tcard rq-tcard--flush">${who}${map}${note ? `<p class="rq-track-note">${note}</p>` : ""}</div>`;
}

function trackRate(d) {
  if (d.status !== "delivered" || !d.driver_id) return "";
  const first = firstNameOf(d, "the driver");
  const rated = ratingsMap.get(d.id);
  if (rated) return `<div class="rq-tcard"><p class="rq-rated" tabindex="-1">You rated ${esc(first)} ${rated.rating} of 5.</p></div>`;
  // Only promise the average once the server really shows one (0023).
  const shown = ratingSummary(driversById.get(d.id));
  return `
    <div class="rq-tcard">
      ${starPicker(d)}
      ${shown ? `<p class="rq-track-small">Your rating is added to ${esc(first)}'s average that other farmers and vendors see.</p>` : ""}
    </div>`;
}

function trackRoute(d) {
  const facts = [];
  if (d.scheduled_pickup_at) facts.push(`Pickup ${keep(day(d.scheduled_pickup_at))}`);
  if (d.distance_km != null) facts.push(`${Math.round(Number(d.distance_km)).toLocaleString("en-PH")}&nbsp;km by road`);
  return `
    <div class="rq-tcard">
      <div class="rq-track-route-head">
        <h2>Route</h2>
        <span class="rq-lock">${LOCK}Can't be changed</span>
      </div>
      <div class="rq-route rq-route--stops">
        <p class="rq-stop rq-stop--from"><span class="rq-muted">Pickup</span><br />${esc(d.pickup_address)}</p>
        <p class="rq-stop rq-stop--to"><span class="rq-muted">Drop-off</span><br />${esc(d.dropoff_address)}</p>
      </div>
      ${facts.length ? `<p class="rq-track-small">${facts.join(" · ")}</p>` : ""}
    </div>`;
}

function trackDetail(d, { back }) {
  const late = pickupPassed(d);
  let note = "";
  if (d.status === "pending") {
    note = late
      ? "The pickup date has passed, so drivers can't see this request anymore. Book it again with a new date."
      : "Drivers can see your request now. You can cancel until one accepts.";
  }
  let actions = "";
  if (d.status === "pending") {
    actions = `
      ${late ? `<button type="button" class="rq-btn" data-new-date="${esc(d.id)}">Book a new date</button>` : ""}
      <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>`;
  } else if (HISTORY_STATUSES.includes(d.status)) {
    actions = `<button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">Book again</button>`;
  }
  return `
    ${trackTop(back ? "Shipment details" : "Track", back)}
    ${trackHead(trackHeadline(d.status, late))}
    <p class="rq-track-what">${esc(d.delivery_code)} · ${titleLine(d)}</p>
    <div class="rq-tcard rq-track-status" data-delivery-id="${esc(d.id)}" tabindex="-1">
      ${renderStageStepper(d.status)}
      <p class="rq-track-line">${trackStatusLine(d)}</p>
      ${note ? `<p class="rq-track-note">${note}</p>` : ""}
    </div>
    ${trackDriver(d)}
    ${trackRate(d)}
    ${trackRoute(d)}
    <div class="rq-tcard rq-track-fare">
      ${fareAmount(d)}
      <p class="rq-track-small">Fare for this trip · tolls included</p>
      <p>Whoever receives the goods pays the driver this amount in cash at drop-off.</p>
    </div>
    ${actions ? `<div class="rq-track-actions">${actions}</div>` : ""}
    <a class="rq-track-help" href="${contactUrl(CONTACT, d.delivery_code)}">Something wrong? Send Sakada a message about ${esc(d.delivery_code)}</a>`;
}

function trackRowStatus(d) {
  const at = d.status_changed_at || d.updated_at;
  const since = isToday(at) ? time(at) : day(at);
  if (d.status === "in_transit") return `On the road since ${since}`;
  if (d.status === "picked_up") return `Picked up ${isToday(at) ? "at" : "on"} ${since}`;
  if (pickupPassed(d)) return "Pickup date passed";
  if (d.status === "driver_assigned") return d.scheduled_pickup_at ? `Driver assigned · ${keep(`pickup ${day(d.scheduled_pickup_at)}`)}` : "Driver assigned";
  return "Waiting for a driver";
}
function trackList(list) {
  return `
    ${trackTop("Track", false)}
    ${trackHead(["Your", "shipments."])}
    <p class="rq-track-sub">Pick one to follow it. Trucks on the road come first.</p>
    <ul class="rq-track-list">
      ${list.map((d) => `
        <li><a class="rq-track-row" href="#track/${encodeURIComponent(d.delivery_code)}">
          <span class="rq-track-row-text">
            <strong>${esc(d.delivery_code)} · ${titleLine(d)}</strong>
            <span class="rq-track-row-status"><span class="rq-sdot" data-status="${esc(d.status)}" aria-hidden="true"></span>${trackRowStatus(d)}</span>
            <span class="rq-muted">${shortRoute(d)}</span>
          </span>
          ${CHEVRON}
        </a></li>`).join("")}
    </ul>`;
}
function trackEmpty() {
  const past = deliveries.some((d) => HISTORY_STATUSES.includes(d.status));
  return `
    ${trackTop("Track", false)}
    ${trackHead(["Nothing on", "the road."])}
    <p class="rq-track-sub">When you book a truck, you can follow it here from pickup to drop-off.</p>
    <a class="rq-btn" href="#book">Book a truck</a>
    ${past ? `<a class="rq-track-help" href="#history">Past deliveries are in History</a>` : ""}`;
}
function trackMissing(code) {
  return `
    ${trackTop("Shipment details", true)}
    ${trackHead(["Not", "found."])}
    <p class="rq-track-sub">We couldn't find ${esc(code)} on your account. Codes look like SK-00142.</p>
    <a class="rq-btn rq-btn--ghost" href="#track">See your shipments</a>`;
}

// What the Track page last drew, so live updates only redraw on a real change
// (a half-typed rating comment survives a notification arriving).
let trackShown = null;
// The parts a live truck update changes; those are swapped in place, not redrawn.
const withoutLive = (html) => html.replace(/Truck here [^<]*/, "").replace(/ src="https:\/\/api\.mapbox\.com[^"]*"/, "");
function renderTrack({ animate = false } = {}) {
  if (document.body.dataset.view !== "track") return;
  const page = $("trackPage");
  if (!deliveriesLoaded) {
    page.innerHTML = `${trackTop("Track", Boolean(trackCode))}<h1 id="trackTitle" class="rq-sr" tabindex="-1">Track</h1>${skeletons()}`;
    trackShown = null;
    return;
  }
  const active = activeOrdered();
  const d = trackCode
    ? deliveries.find((x) => x.delivery_code.toLowerCase() === trackCode.toLowerCase())
    : active.length === 1 ? active[0] : null;
  let key;
  let html;
  if (trackCode && !d) [key, html] = [`missing:${trackCode}`, trackMissing(trackCode)];
  else if (d) [key, html] = [d.id, trackDetail(d, { back: Boolean(trackCode) })];
  else if (active.length) [key, html] = ["list", trackList(active)];
  else [key, html] = ["empty", trackEmpty()];

  const before = trackShown;
  if (before?.key === key && withoutLive(before.html) === withoutLive(html)) {
    // Only the truck moved: fade the new map in and update "Truck here … ago".
    const img = d && $(`trackmap-${d.id}`);
    if (img && img.getAttribute("src") !== shipMapUrl(d)) swapMap(img, shipMapUrl(d));
    const caption = d && $(`track-caption-${d.id}`);
    const fresh = d && /Truck here [^<]*/.exec(html)?.[0];
    if (caption && fresh) caption.textContent = fresh;
    trackShown.html = html;
    return;
  }
  page.innerHTML = html;
  trackShown = { key, html, status: d?.status };
  if (d) loadRouteLines([d]);
  if (before?.key === key && d && STAGES.indexOf(d.status) > STAGES.indexOf(before.status)) {
    // The booking moved on while you watched: say it, fill the new step, fade the headline in.
    $("trackLive").textContent = `${d.delivery_code} is now ${statusLabel(d.status)}.`;
    page.querySelector(".rq-step--current")?.classList.add("is-advanced");
    if (!reduceMotion()) $("trackTitle").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  } else if (animate && before && before.key !== key) {
    enterView("track");
  }
}

/** Open one booking's Track page; Back returns to wherever you came from. */
function openTrack(id, { rate = false } = {}) {
  const d = deliveries.find((x) => x.id === id);
  if (!d) return;
  goTo(`track/${encodeURIComponent(d.delivery_code)}`);
  const star = rate && $("trackPage").querySelector("[data-star]");
  (star || $("trackTitle"))?.focus({ preventScroll: true });
}

/** A past booking. Tapping it opens its Track page, which is also where its driver is rated. */
function historyCard(d) {
  const rated = ratingsMap.get(d.id);
  const driver = firstNameOf(d, "");
  const rateBtn =
    d.status === "delivered" && d.driver_id && !rated
      ? `<button type="button" class="rq-btn rq-btn--ghost" data-track-rate="${esc(d.id)}">Rate ${esc(driver || "driver")}</button>`
      : "";
  return `
    <article class="rq-card rq-history-card" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="${esc(d.status)}">${statusLabel(d.status)}</span> ${metaLine(d)}</p>
      <p>${esc(d.pickup_address)} → ${esc(d.dropoff_address)}</p>
      ${d.status === "delivered" ? `<div class="rq-fare">${fareAmount(d)}${rated ? `<span class="rq-muted">You rated ${esc(driver || "the driver")} ${rated.rating} of 5</span>` : ""}</div>` : ""}
      <div class="rq-card-actions">
        ${rateBtn}
        <button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">Book again</button>
      </div>
    </article>`;
}

function renderHistory() {
  const history = deliveries.filter((d) => HISTORY_STATUSES.includes(d.status));
  const counts = {
    all: history.length,
    delivered: history.filter((d) => d.status === "delivered").length,
    cancelled: history.filter((d) => d.status === "cancelled").length,
  };
  document.querySelectorAll("[data-filter]").forEach((b) => {
    const f = b.dataset.filter;
    b.textContent = `${f[0].toUpperCase()}${f.slice(1)} (${counts[f]})`;
    b.setAttribute("aria-pressed", String(f === historyFilter));
  });
  const shown = historyFilter === "all" ? history : history.filter((d) => d.status === historyFilter);
  // 25 at a time, so a busy trader's 400 past deliveries don't all render on a budget phone.
  const pageState = paginate(shown, historyPage);
  historyPage = pageState.page;
  $("historyList").innerHTML = shown.length
    ? pageState.rows.map(historyCard).join("") + historyPager(pageState)
    : history.length
      ? `<div class="rq-card rq-empty"><p><strong>No ${historyFilter} deliveries</strong></p><button type="button" class="rq-btn rq-btn--ghost" data-filter-reset>Show all</button></div>`
      : `<div class="rq-card rq-empty"><p><strong>No past deliveries yet</strong></p><p class="rq-muted">Delivered and cancelled bookings show up here.</p></div>`;
}

function historyPager(state) {
  if (state.totalPages < 2) return "";
  return `
    <nav class="rq-pager" aria-label="History pages">
      <p class="rq-muted">Showing ${state.from}–${state.to} of ${state.total}</p>
      <div class="rq-pager-controls">
        <button type="button" class="rq-btn rq-btn--ghost" data-history-page="${state.page - 1}"${state.page === 1 ? " disabled" : ""}>Previous</button>
        <span class="rq-pager-status">Page ${state.page} of ${state.totalPages}</span>
        <button type="button" class="rq-btn rq-btn--ghost" data-history-page="${state.page + 1}"${state.page === state.totalPages ? " disabled" : ""}>Next</button>
      </div>
    </nav>`;
}

function renderRecentRoute() {
  const last = deliveries[0];
  const btn = $("recentRoute");
  if (!last) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.dataset.rebookId = last.id;
  const text = `${last.pickup_address.split(",")[0]} → ${last.dropoff_address.split(",")[0]} · ${last.goods_description}`;
  $("recentRouteText").textContent = text;
  btn.title = text; // the button shows two lines at most
}

function renderAll() {
  renderHome();
  renderHistory();
  renderRecentRoute();
  renderUnread();
  renderTrack();
}

function skeletons() {
  return Array.from({ length: 2 }, () => `
    <div class="skeleton skeleton--card">
      <div class="skeleton__line skeleton__line--title"></div>
      <div class="skeleton__line skeleton__line--text"></div>
      <div class="skeleton__line skeleton__line--text" style="width:60%"></div>
    </div>`).join("");
}

let homeLoaded = false;
let deliveriesLoaded = false; // the Track page waits for the first list
async function loadDeliveries() {
  if (!deliveries.length) $("homeLists").innerHTML = skeletons();
  const { data, error } = await getMyDeliveries(profile.id);
  if (error) {
    const failed = `
      <div class="rq-card rq-empty">
        <p><strong>We couldn't load your deliveries.</strong></p>
        <p class="rq-muted">Check your signal, then try again.</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-reload>Try again</button>
      </div>`;
    $("homeLists").innerHTML = failed;
    if (!deliveriesLoaded) {
      $("trackPage").innerHTML = `${trackTop("Track", Boolean(trackCode))}<h1 id="trackTitle" class="rq-sr" tabindex="-1">Track</h1>${failed}`;
      trackShown = null;
    }
    return;
  }
  deliveries = data || [];
  deliveriesLoaded = true;
  const [{ data: drivers }, ratings] = await Promise.all([
    getMyDeliveryDrivers(),
    getMyRatingsForDeliveries(
      deliveries.filter((d) => d.status === "delivered").map((d) => d.id),
      profile.id,
    ),
  ]);
  driversById = new Map((drivers || []).map((r) => [r.delivery_id, r]));
  ratingsMap = ratings;
  renderAll();
  // The first real content fades in over the placeholders; later refreshes don't.
  if (!homeLoaded) $("homeLists").classList.add("rq-fade");
  homeLoaded = true;
  subscribeTracking();
  if (highlightId) {
    document.querySelector(`[data-delivery-id="${CSS.escape(highlightId)}"]`)?.focus();
    highlightId = null;
  }
}

function subscribeTracking() {
  activeSubscriptions.forEach((channel) => channel.unsubscribe());
  activeSubscriptions.clear();
  deliveries
    .filter((d) => d.status === "picked_up" || d.status === "in_transit")
    .forEach((d) => {
      const channel = subscribeToDeliveryUpdates(d.id, (updated) => {
        if (updated.updated_at) d.updated_at = updated.updated_at;
        if (updated.current_lat && updated.current_lng) {
          // The new truck position fades in over the old one on the Home card…
          Object.assign(d, { current_lat: updated.current_lat, current_lng: updated.current_lng });
          const card = $(`shipmap-${d.id}`);
          if (card) swapMap(card, shipMapUrl(d));
        }
        // …and the Track page swaps its map and caption the same way.
        if (trackShown?.key === d.id) renderTrack();
        if (updated.status && updated.status !== d.status) loadDeliveries();
      });
      activeSubscriptions.set(d.id, channel);
    });
}

/**
 * A booking leaves Home: its card fades out, then everything below slides
 * up into place instead of jumping.
 */
async function leaveHome(id) {
  const gone = [...$("homeLists").querySelectorAll(`[data-delivery-id="${CSS.escape(id)}"]`)];
  if (gone.length && !reduceMotion()) {
    await Promise.all(gone.map((el) => el.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px)" }],
      { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" },
    ).finished));
  }
  const local = deliveries.find((x) => x.id === id);
  if (local) local.status = "cancelled";
  withFlip(() => renderAll());
}

/** Fill the Book form with an old booking (date left empty) and go there. */
function rebookIntoForm(d) {
  for (const [id, value] of Object.entries(rebookValues(d))) {
    inputs[id].value = value;
    inputs[id].dispatchEvent(new Event("input", { bubbles: true }));
  }
  inputs.scheduledPickup.value = "";
  resetQuote();
  goTo("book");
  inputs.scheduledPickup.focus({ preventScroll: true });
}

// ---------- Book a late request again with a new date ----------
let newDateFor = null;
function openNewDate(id) {
  const d = deliveries.find((x) => x.id === id);
  if (!d) return;
  // Old bookings without saved coordinates go through the normal Book form.
  if (d.pickup_lat == null || d.dropoff_lat == null || d.distance_km == null) return rebookIntoForm(d);
  newDateFor = d;
  const price = formatPeso(estimateCost(Number(d.distance_km), Number(d.quantity_kg)));
  $("newDateWhat").innerHTML = `<strong>${titleLine(d)}</strong><br />${esc(d.pickup_address)} → ${esc(d.dropoff_address)}`;
  $("newDateFare").textContent = price;
  $("newDateOld").textContent = `Your old request ${d.delivery_code} will be cancelled.`;
  $("newDateConfirm").textContent = `Confirm booking · ${price}`;
  $("newDateConfirm").disabled = false;
  const input = $("newDateInput");
  input.value = "";
  input.min = localDateString();
  input.removeAttribute("aria-invalid");
  $("newDateError").hidden = true;
  openSheet($("newDateSheet"));
}
function newDateProblem(text) {
  $("newDateError").textContent = text;
  $("newDateError").hidden = false;
}
$("newDateInput").addEventListener("input", () => {
  $("newDateError").hidden = true;
  $("newDateInput").removeAttribute("aria-invalid");
});
$("newDateConfirm").addEventListener("click", async () => {
  const d = newDateFor;
  const input = $("newDateInput");
  const problem = checkPickupDate(input.value);
  if (problem) {
    newDateProblem(problem);
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  if (getIsOffline()) return newDateProblem("No connection. Check your signal and try again.");
  const btn = $("newDateConfirm");
  const label = btn.textContent;
  setBusy(btn, true, "Booking…");
  let result;
  try {
    result = await createDelivery({
      requester_id: profile.id,
      pickup_address: d.pickup_address,
      pickup_lat: d.pickup_lat,
      pickup_lng: d.pickup_lng,
      dropoff_address: d.dropoff_address,
      dropoff_lat: d.dropoff_lat,
      dropoff_lng: d.dropoff_lng,
      goods_description: d.goods_description,
      quantity_kg: d.quantity_kg,
      scheduled_pickup_at: new Date(input.value).toISOString(),
      notes: d.notes,
      estimated_cost: estimateCost(Number(d.distance_km), Number(d.quantity_kg)),
      distance_km: d.distance_km,
    });
  } catch (err) {
    result = { error: err };
  }
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = label;
  if (result.error) return newDateProblem(bookingErrorCopy(result.error).message);
  // The new booking is in; now retire the old one.
  const { error: cancelError } = await cancelMyDelivery(d.id, profile.id);
  await closeSheet($("newDateSheet"));
  if (!cancelError) await leaveHome(d.id);
  highlightId = result.data?.id || null;
  const fromTrack = trackShown?.key === d.id;
  await loadDeliveries();
  // Booked from its Track page: that page now follows the new booking.
  const fresh = fromTrack && deliveries.find((x) => x.id === result.data?.id);
  if (fresh) {
    history.replaceState(history.state, "", `#track/${encodeURIComponent(fresh.delivery_code)}`);
    showView(location.hash.slice(1));
    $("trackTitle")?.focus({ preventScroll: true });
  }
  if (cancelError) toastError(`Your new booking is in, but ${d.delivery_code} couldn't be cancelled. Cancel it from Home.`);
  else toastSuccess(`Booked for ${day(new Date(input.value).toISOString())}. Drivers can see it now.`);
});

// ---------- Card actions (one listener for every list) ----------
let cancelTarget = null;
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a");
  if (!t) {
    // The whole card opens its Track page, not just the pill (Home and History).
    const card = e.target.closest("#homeLists .rq-ship, #historyList .rq-history-card");
    if (card && !e.target.closest("textarea, input")) openTrack(card.dataset.deliveryId);
    return;
  }
  if (t.dataset.shipDot) return goToShip(shipCards()[Number(t.dataset.shipDot)]?.dataset.deliveryId);

  if (t.matches("[data-reload]")) return loadDeliveries();
  if (t.dataset.details) return openTrack(t.dataset.details);
  if (t.dataset.trackRate) return openTrack(t.dataset.trackRate, { rate: true });
  if (t.matches("[data-track-back]")) {
    // Back to where you came from (Home, History, a notification); the Track tab otherwise.
    if (history.state?.back) history.back();
    else goTo("track");
    return;
  }
  if (t.dataset.tile) return openTile(t.dataset.tile);

  // Book a new date / Cancel can be tapped inside another sheet (details,
  // notifications); that one steps aside first so only one sheet is up.
  if (t.dataset.newDate || t.dataset.cancelId) {
    const host = t.closest("dialog");
    if (host?.open) {
      host._returnFocus = null;
      await closeSheet(host);
    }
  }
  if (t.dataset.newDate) return openNewDate(t.dataset.newDate);

  if (t.dataset.cancelId) {
    cancelTarget = deliveries.find((d) => d.id === t.dataset.cancelId);
    if (!cancelTarget) return;
    $("cancelWhat").textContent = `${cancelTarget.delivery_code} · ${cancelTarget.goods_description}, ${cancelTarget.pickup_address.split(",")[0]} → ${cancelTarget.dropoff_address.split(",")[0]}. No driver has accepted yet.`;
    openSheet($("cancelSheet"));
    return;
  }

  if (t.dataset.rebookId) {
    const d = deliveries.find((x) => x.id === t.dataset.rebookId);
    if (d) rebookIntoForm(d);
    return;
  }


  if (t.dataset.star) {
    const box = t.closest("[data-rate-for]");
    const value = Number(t.dataset.star);
    box.dataset.value = value;
    box.querySelectorAll("[data-star]").forEach((s) => {
      const n = Number(s.dataset.star);
      s.setAttribute("aria-checked", String(n === value));
      s.classList.toggle("is-on", n <= value);
    });
    box.querySelector("[data-send-rating]").disabled = false;
    return;
  }

  if (t.matches("[data-send-rating]")) {
    const box = t.closest("[data-rate-for]");
    const id = box.dataset.rateFor;
    const d = deliveries.find((x) => x.id === id);
    t.disabled = true;
    t.textContent = "Sending…";
    const { error } = await submitRating(id, profile.id, d.driver_id, Number(box.dataset.value), box.querySelector("textarea").value.trim());
    if (error) {
      t.disabled = false;
      t.textContent = "Send rating";
      toastError("Your rating didn't save. Check your signal and send it again.");
      return;
    }
    toastSuccess("Thanks. Your rating was saved.");
    await loadDeliveries();
    $("trackPage").querySelector(".rq-rated")?.focus({ preventScroll: true }); // the stars are gone; land on the result
    return;
  }

  if (t.dataset.filter) {
    historyFilter = t.dataset.filter;
    historyPage = 1;
    renderHistory();
    return;
  }
  if (t.matches("[data-filter-reset]")) {
    historyFilter = "all";
    historyPage = 1;
    renderHistory();
    return;
  }
  if (t.dataset.historyPage) {
    historyPage = Number(t.dataset.historyPage);
    renderHistory();
    // Back to the top of the list, with focus where a keyboard user expects it.
    $("historyTitle").scrollIntoView({ block: "start" });
    $("historyTitle").setAttribute("tabindex", "-1");
    $("historyTitle").focus({ preventScroll: true });
  }
});

$("cancelConfirm").addEventListener("click", async () => {
  const d = cancelTarget;
  const btn = $("cancelConfirm");
  if (!d) return;
  if (getIsOffline()) {
    toastError("No connection. Check your signal and try again.");
    return;
  }
  setBusy(btn, true, "Cancelling…");
  const { error } = await cancelMyDelivery(d.id, profile.id);
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = "Cancel request";
  const sheetClosed = closeSheet($("cancelSheet"));
  if (error) {
    // No row matched: a driver accepted it in the meantime.
    if (error.code === "PGRST116" || /no rows|not found|multiple \(or no\)/i.test(error.message || "")) {
      await Promise.all([loadDeliveries(), sheetClosed]);
      // The note goes where you are: the Track page's status card, or the Home card.
      const card = document.querySelector(`#view-${document.body.dataset.view} [data-delivery-id="${CSS.escape(d.id)}"]`)
        || document.querySelector(`[data-delivery-id="${CSS.escape(d.id)}"]`);
      card?.insertAdjacentHTML(
        "afterbegin",
        `<div class="rq-banner rq-banner--warn" role="alert"><p><strong>A driver accepted first.</strong> Your cancel didn't go through. Only Sakada can cancel now. <a href="${contactUrl(CONTACT, d.delivery_code)}">Message Sakada about ${esc(d.delivery_code)}</a></p></div>`,
      );
      card?.focus();
    } else {
      toastError("We couldn't cancel this. Check your signal and try again.");
    }
    return;
  }
  toastSuccess("Request cancelled");
  await leaveHome(d.id);
  loadDeliveries();
});

/**
 * Brings a booking's card into view and focuses it: Home for active ones,
 * History (on the right page, filter cleared) for past ones.
 */
function showCard(d) {
  if (HISTORY_STATUSES.includes(d.status)) {
    historyFilter = "all";
    const past = deliveries.filter((x) => HISTORY_STATUSES.includes(x.status));
    historyPage = paginate(past, 1).totalPages > 1 ? Math.floor(past.indexOf(d) / paginate(past, 1).rows.length) + 1 : 1;
    renderHistory();
    goTo("history");
  } else {
    goTo("home");
    goToShip(d.id);
  }
  const card = document.querySelector(`#view-${HISTORY_STATUSES.includes(d.status) ? "history" : "home"} [data-delivery-id="${CSS.escape(d.id)}"]`);
  card?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
  card?.focus({ preventScroll: true });
  return card;
}

/** Tiles: Waiting / On the road jump to the first such card; Delivered opens History. */
function openTile(key) {
  if (key === "delivered") {
    historyFilter = "delivered";
    historyPage = 1;
    renderHistory();
    goTo("history");
    $("historyTitle").setAttribute("tabindex", "-1");
    $("historyTitle").focus({ preventScroll: true });
    return;
  }
  const d = deliveries.find((x) => !HISTORY_STATUSES.includes(x.status) && (key === "waiting") === (x.status === "pending"));
  if (d) showCard(d);
  else $("shipTitle")?.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
}

// ---------- Track your shipment ----------
$("trackInput").addEventListener("input", () => showFieldError($("trackInput"), ""));
$("trackForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("trackInput");
  const problem = checkTrackQuery(input.value);
  if (problem) {
    showFieldError(input, problem);
    input.focus();
    return;
  }
  const d = findDelivery(deliveries, input.value);
  if (!d) {
    showFieldError(input, `Nothing on your account matches "${input.value.trim()}". Codes look like SK-00142.`);
    input.focus();
    return;
  }
  showFieldError(input, "");
  input.blur(); // put the phone keyboard away
  openTrack(d.id);
});

// ---------- Notifications ----------
let notifications = [];
let lastUnread = null; // null until the first count, so page load never pops
function renderUnread() {
  // Late requests count on the bell too: they wait in the notifications sheet.
  const late = lateList().length;
  const unread = notifications.filter((n) => !n.is_read).length + late;
  const grew = lastUnread !== null && unread > lastUnread;
  lastUnread = unread;
  document.querySelectorAll("[data-unread]").forEach((b) => {
    b.hidden = unread === 0;
    b.textContent = unread > 9 ? "9+" : String(unread);
    // A new notification: one quick pop, only when the count goes up.
    if (grew && !reduceMotion()) {
      b.animate([{ transform: "scale(0.85)" }, { transform: "scale(1)" }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    }
  });
  document.querySelectorAll("[data-open-notifs]").forEach((b) =>
    b.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications"),
  );
  const words = [unread - late && `${unread - late} unread`, late && `${late} need${late > 1 ? "" : "s"} you`].filter(Boolean);
  document.querySelectorAll("[data-unread-text]").forEach((el) => (el.textContent = words.join(" · ")));
  renderNeeds();
}

/** Late requests sit at the top of the notifications sheet until they're rebooked or cancelled. */
function renderNeeds() {
  const late = lateList();
  $("notifNeeds").hidden = !late.length;
  $("notifNeeds").innerHTML = late.length ? `
    <h3 class="rq-needs-title">Needs you</h3>
    ${late.map((d) => `
      <div class="rq-need" data-need="${esc(d.id)}">
        <p><strong>${esc(d.delivery_code)} · ${titleLine(d)}</strong><br /><span class="rq-muted">${shortRoute(d)}</span></p>
        <p>The pickup date (${day(d.scheduled_pickup_at)}) passed before a driver accepted, so drivers can't see it anymore.</p>
        <div class="rq-need-actions">
          <button type="button" class="rq-btn" data-new-date="${esc(d.id)}">Book a new date</button>
          <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>
        </div>
      </div>`).join("")}` : "";
}
function renderNotifs() {
  const list = $("notifList");
  list.innerHTML = notifications.length
    ? notifications
        .map(
          (n) => `
        <li><button type="button" class="rq-notif${n.is_read ? "" : " is-unread"}" data-notif-id="${esc(n.id)}" data-delivery="${esc(n.delivery_id || "")}">
          <span class="rq-notif-dot" aria-hidden="true"></span>
          <span><span class="rq-sr">${n.is_read ? "" : "Unread. "}</span>${esc(n.message)}<br /><span class="rq-muted">${timeAgo(n.created_at)}</span></span>
        </button></li>`,
        )
        .join("")
    : `<li class="rq-empty"><p><strong>No notifications yet</strong></p><p class="rq-muted">Updates show here when a driver accepts, picks up and delivers.</p></li>`;
  renderUnread();
}
async function loadNotifications() {
  const { data, error } = await getMyNotifications(profile.id);
  if (!error && data) {
    notifications = data;
    renderNotifs();
  }
}
document.querySelectorAll("[data-open-notifs]").forEach((b) =>
  b.addEventListener("click", () => openSheet($("notifSheet"))),
);
$("notifList").addEventListener("click", async (e) => {
  const item = e.target.closest("[data-notif-id]");
  if (!item) return;
  if (item.classList.contains("is-unread")) {
    markNotificationRead(item.dataset.notifId).then(loadNotifications);
  }
  const sheet = $("notifSheet");
  const d = deliveries.find((x) => x.id === item.dataset.delivery);
  if (d) sheet._returnFocus = null; // focus goes to its Track page instead of the bell
  const closed = closeSheet(sheet);
  if (!d) return;
  // The page behind a modal sheet can't take focus, so wait for it to leave.
  await closed;
  // A finished delivery that isn't rated yet lands on the stars.
  openTrack(d.id, { rate: d.status === "delivered" && d.driver_id && !ratingsMap.get(d.id) });
});

showView(location.hash.slice(1));
viewsReady = true; // first load shows the page as is; only switches move
loadDeliveries();
loadNotifications();
subscribeToNotifications(profile.id, () => {
  loadNotifications();
  loadDeliveries();
});
