import { sanitizeText } from "./sanitize.js";
import { supabase } from "./supabase-client.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  estimateCost,
  staticMapUrl,
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
  homeSummary,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  shortPlace,
  bookingErrorCopy,
  contactUrl,
} from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { enableSheetDrag, rubberband, project, releaseVelocity, animateSpring } from "./sheet-drag.js";
import { paginate } from "./pagination.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";
import {
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
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
// Greeting only: "yayan" reads as "Hello, Yayan". The saved name is left as typed.
$("homeTitle").textContent = `Hello, ${firstName.charAt(0).toLocaleUpperCase("en-PH")}${firstName.slice(1)}`;
supabase.auth.getUser().then(({ data }) => {
  if (data?.user?.email) $("profileEmail").textContent = ` · ${data.user.email}`;
});
$("signOutBtn").addEventListener("click", () => signOut("../../index.html"));

// ---------- Tabs (hash sections in one page, so realtime stays connected) ----------
const VIEWS = ["home", "book", "history", "profile"];
function showView(view, { focus = false } = {}) {
  if (view === "deliveryForm") view = "book"; // the landing page's "Book a Delivery" link
  if (!VIEWS.includes(view)) view = "home";
  document.body.dataset.view = view;
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
/** Switch view from code that then moves focus itself (pushState fires no hashchange). */
function goTo(view) {
  if (location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  showView(view);
  window.scrollTo({ top: 0 });
}
showView(location.hash.slice(1));

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
  $("bookedBanner").hidden = false;
  arrive($("bookedBanner"));
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
function routeBlock(d) {
  return `
    <div class="rq-route rq-route--stops">
      <p class="rq-stop rq-stop--from"><span class="rq-muted">From</span><br />${esc(d.pickup_address)}</p>
      <p class="rq-stop rq-stop--to"><span class="rq-muted">To</span><br />${esc(d.dropoff_address)}</p>
    </div>`;
}
function driverBlock(d) {
  const row = driversById.get(d.id);
  if (!row?.driver_name) return "";
  const vehicle = [row.vehicle_type, row.vehicle_plate && `Plate ${row.vehicle_plate}`].filter(Boolean).map(esc).join(" · ");
  return `
    <div class="rq-driver">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
      <div><strong>${esc(row.driver_name)}</strong><br /><span class="rq-muted">${vehicle || "Vehicle not added yet"}</span></div>
    </div>`;
}
function mapBlock(d) {
  if (d.status === "driver_assigned") {
    const name = driversById.get(d.id)?.driver_name?.split(" ")[0] || "the driver";
    return `<p class="rq-note-row">The map appears once ${esc(name)} picks up your goods.</p>`;
  }
  if (d.status !== "picked_up" && d.status !== "in_transit") return "";
  if (!d.current_lat || !d.current_lng) {
    return `<p class="rq-note-row">Location not shared yet. You'll see the truck once the driver starts sharing.</p>`;
  }
  // The map says how old the truck position is, on the map itself.
  return `
    <figure class="rq-map"><img id="map-${esc(d.id)}" src="${staticMapUrl(d.current_lat, d.current_lng)}" alt="Map showing where the truck is now" width="600" height="320" loading="lazy" />
      <figcaption id="map-caption-${esc(d.id)}">Truck here ${timeAgo(d.updated_at)}</figcaption></figure>`;
}
function fareBlock(d) {
  return `
    <div class="rq-fare">
      ${fareAmount(d)}
      <span class="rq-muted">Whoever receives the goods pays the driver this in cash at drop-off. Tolls included.</span>
    </div>`;
}
function starPicker(d) {
  return `
    <div class="rq-rate" data-rate-for="${esc(d.id)}">
      <p><strong>How was ${esc(driversById.get(d.id)?.driver_name?.split(" ")[0] || "your driver")}?</strong></p>
      <div class="rq-stars" role="radiogroup" aria-label="Rating">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-star="${n}"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}
      </div>
      <label class="rq-sr" for="comment-${esc(d.id)}">Comment (optional)</label>
      <textarea id="comment-${esc(d.id)}" rows="2" maxlength="500" placeholder="Add a comment (optional)"></textarea>
      <button type="button" class="rq-btn rq-btn--ghost" data-send-rating disabled>Send rating</button>
    </div>`;
}


// ---------- Home: "Needs you", then short rows that open in place ----------
const STATUS_WORD = { pending: "Waiting for a driver", driver_assigned: "Driver assigned", picked_up: "Picked up", in_transit: "In transit" };
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
/** The one line under the bars: what's happening and since when. */
function statusLine(d) {
  const word = `<strong class="rq-status-word">${STATUS_WORD[d.status]}</strong>`;
  const at = d.status_changed_at || d.updated_at;
  const when = isToday(at) ? time(at) : day(at);
  if (d.status === "picked_up") return `${word} ${isToday(at) ? "at" : "on"} ${when}`;
  if (d.status === "in_transit") return `${word} since ${when}`;
  if (pickupPassed(d)) return `<span class="rq-chip">Pickup date passed · drivers can't see it</span>`;
  return d.scheduled_pickup_at ? `${word} · pickup ${day(d.scheduled_pickup_at)}` : word;
}
const shortRoute = (d) => `${esc(shortPlace(d.pickup_address))} → ${esc(shortPlace(d.dropoff_address))}`;
let openId = null;

function activeCard(d) {
  const open = d.id === openId;
  const late = pickupPassed(d);
  const waitingLine = d.status === "pending"
    ? `<p>${late
      ? "The pickup date has passed, so drivers can't see this request anymore. Book it again with a new date."
      : "Drivers can see your request now. You can cancel until one accepts."}</p>`
    : "";
  const actions = d.status === "pending"
    ? `${late ? `<button type="button" class="rq-btn" data-new-date="${esc(d.id)}">Book a new date</button>` : ""}
       <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>`
    : "";
  return `
    <article class="rq-card rq-item${open ? " is-open" : ""}${d.id === highlightId ? " rq-card--new" : ""}" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <button type="button" class="rq-item-head" aria-expanded="${open}" aria-controls="details-${esc(d.id)}">
        <span class="rq-item-main">
          <span class="rq-card-title">${titleLine(d)}</span>
          <span class="rq-item-route">${shortRoute(d)}</span>
        </span>
        ${CHEVRON}
      </button>
      ${renderStageStepper(d.status)}
      <p class="rq-status-line">${statusLine(d)}</p>
      <div class="rq-item-details" id="details-${esc(d.id)}"${open ? "" : " hidden"}>
        <p class="rq-muted">${metaLine(d)}</p>
        ${routeBlock(d)}
        ${driverBlock(d)}
        ${mapBlock(d)}
        ${waitingLine}
        ${fareBlock(d)}
        ${actions}
      </div>
    </article>`;
}
const CHEVRON = `<svg class="rq-chevron" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

function section(title, sub, cards) {
  if (!cards.length) return "";
  return `
    <section class="rq-section">
      <h2 class="rq-section-title">${title}</h2>
      ${sub ? `<p class="rq-muted">${sub}</p>` : ""}
      ${cards.join("")}
    </section>`;
}

function toRateList() {
  return deliveries.filter((d) => d.status === "delivered" && d.driver_id && !ratingsMap.get(d.id));
}
function needsYou(active) {
  const late = active.filter((d) => pickupPassed(d)).map((d) => `
    <div class="rq-need" data-need="${esc(d.id)}">
      <p><strong>${titleLine(d)}</strong><br /><span class="rq-muted">${shortRoute(d)}</span></p>
      <p>The pickup date (${day(d.scheduled_pickup_at)}) passed before a driver accepted, so drivers can't see it anymore.</p>
      <div class="rq-need-actions">
        <button type="button" class="rq-btn" data-new-date="${esc(d.id)}">Book a new date</button>
        <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>
      </div>
    </div>`);
  const rate = toRateList();
  const names = [...new Set(rate.map((d) => driversById.get(d.id)?.driver_name?.split(" ")[0]).filter(Boolean))];
  const rateRow = rate.length ? `
    <button type="button" class="rq-row rq-rate-row" data-open-rating>
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>
      <span class="rq-rate-text"><strong>Rate ${rate.length} driver${rate.length > 1 ? "s" : ""}</strong>${names.length ? `<br /><span class="rq-muted">${esc(names.join(", "))}</span>` : ""}</span>
      ${CHEVRON}
    </button>` : "";
  if (!late.length && !rate.length) return "";
  return `
    <section class="rq-section rq-needs" aria-labelledby="needsTitle">
      <h2 class="rq-section-title" id="needsTitle">Needs you</h2>
      ${late.join("")}${rateRow}
    </section>`;
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
  const toRate = toRateList();
  // With exactly one truck on the road, that's the one being watched: open it.
  if (openId === null && !homeOpenedOnce && onRoad.length === 1) openId = onRoad[0].id;
  homeOpenedOnce = true;
  if (openId && !active.some((d) => d.id === openId)) openId = null;
  $("homeSummary").textContent = homeSummary({
    onRoad: onRoad.length,
    assigned: assigned.length,
    waiting: waiting.length,
    toRate: toRate.length,
  });
  $("homeLists").innerHTML = deliveries.length
    ? needsYou(active) +
      section("On the road", "", onRoad.map(activeCard)) +
      section("Driver assigned", "Goods not picked up yet", assigned.map(activeCard)) +
      section("Waiting for a driver", "", waiting.map(activeCard)) ||
      `<div class="rq-card rq-empty"><p><strong>Nothing in progress.</strong></p><p class="rq-muted">Your past deliveries are in History.</p><a class="rq-btn" href="#book">Book a truck</a></div>`
    : firstVisit();
  markAdvanced(active);
}
let homeOpenedOnce = false;

/** Re-render Home while sliding whatever moved from where it was (FLIP). */
function withFlip(change) {
  const key = (el) => el.dataset.deliveryId || el.dataset.need || el.id || el.textContent.trim().slice(0, 40);
  const els = () => [...$("homeLists").querySelectorAll(".rq-section-title, .rq-section > .rq-muted, .rq-card, .rq-need, .rq-rate-row")];
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

/** Open one row (closing any other), or close it. */
function toggleRow(id) {
  const opening = openId !== id;
  withFlip(() => {
    openId = opening ? id : null;
    $("homeLists").querySelectorAll(".rq-item").forEach((card) => {
      const isOpen = card.dataset.deliveryId === openId;
      card.classList.toggle("is-open", isOpen);
      card.querySelector(".rq-item-head").setAttribute("aria-expanded", String(isOpen));
      card.querySelector(".rq-item-details").hidden = !isOpen;
    });
  });
  if (!opening) return;
  const card = $("homeLists").querySelector(`.rq-item[data-delivery-id="${CSS.escape(id)}"]`);
  const details = card?.querySelector(".rq-item-details");
  if (details && !reduceMotion()) {
    details.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 60, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
  }
  requestAnimationFrame(() => card?.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" }));
}

// Statuses as of the last Home render, so a driver accepting (or picking up)
// can be marked once. Null until the first render: page load never animates.
let lastStatus = null;
function markAdvanced(active) {
  if (lastStatus) {
    for (const d of active) {
      const before = lastStatus.get(d.id);
      if (!before || STAGES.indexOf(d.status) <= STAGES.indexOf(before)) continue;
      const card = $("homeLists").querySelector(`.rq-card[data-delivery-id="${CSS.escape(d.id)}"]`);
      card?.classList.add("is-advanced");
      card?.querySelector(".rq-step--current")?.classList.add("is-advanced");
    }
  }
  lastStatus = new Map(deliveries.map((d) => [d.id, d.status]));
}

function historyCard(d) {
  const rated = ratingsMap.get(d.id);
  const driver = driversById.get(d.id)?.driver_name?.split(" ")[0];
  const rateBtn =
    d.status === "delivered" && d.driver_id && !rated
      ? `<button type="button" class="rq-btn rq-btn--ghost" data-open-rate="${esc(d.id)}">Rate ${esc(driver || "driver")}</button>`
      : "";
  return `
    <article class="rq-card" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="${esc(d.status)}">${statusLabel(d.status)}</span> ${metaLine(d)}</p>
      <p>${esc(d.pickup_address)} → ${esc(d.dropoff_address)}</p>
      ${d.status === "delivered" ? `<div class="rq-fare">${fareAmount(d)}${rated ? `<span class="rq-muted">You rated ${esc(driver || "the driver")} ${rated.rating} of 5</span>` : ""}</div>` : ""}
      <div class="rq-rate-slot"></div>
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
async function loadDeliveries() {
  if (!deliveries.length) $("homeLists").innerHTML = skeletons();
  const { data, error } = await getMyDeliveries(profile.id);
  if (error) {
    $("homeLists").innerHTML = `
      <div class="rq-card rq-empty">
        <p><strong>We couldn't load your deliveries.</strong></p>
        <p class="rq-muted">Check your signal, then try again.</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-reload>Try again</button>
      </div>`;
    return;
  }
  deliveries = data || [];
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
        const img = document.getElementById(`map-${d.id}`);
        if (img && updated.current_lat && updated.current_lng) {
          // Load the new map off-screen first, so a slow connection never shows a blank box.
          const next = new Image();
          next.src = staticMapUrl(updated.current_lat, updated.current_lng);
          next.decode().then(() => (img.src = next.src), () => {});
        }
        const caption = document.getElementById(`map-caption-${d.id}`);
        if (caption) caption.textContent = `Truck here ${timeAgo(updated.updated_at || new Date())}`;
        if (updated.status && updated.status !== d.status) loadDeliveries();
      });
      activeSubscriptions.set(d.id, channel);
    });
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

// ---------- Rate drivers, one after another ----------
// Each rating is saved the moment Send is tapped; skipped drivers stay on Home.
let rateQueue = [];
let rateIndex = 0;
let ratedCount = 0;
const STAR = `<svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>`;
function rateSheetCard(d) {
  const name = driversById.get(d.id)?.driver_name?.split(" ")[0] || "your driver";
  return `
    <div class="rq-rate-card" data-rate-id="${esc(d.id)}">
      <p class="rq-muted">${titleLine(d)} · Delivered ${day(d.updated_at)}</p>
      <p class="rq-rate-q"><strong>How was ${esc(name)}?</strong></p>
      <div class="rq-rate">
        <div class="rq-stars" role="radiogroup" aria-label="Rating">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-sheet-star="${n}">${STAR}</button>`).join("")}
        </div>
        <label class="rq-sr" for="sheet-comment-${esc(d.id)}">Comment (optional)</label>
        <textarea id="sheet-comment-${esc(d.id)}" rows="2" maxlength="500" placeholder="Add a comment (optional)"></textarea>
      </div>
      <div class="rq-card-actions">
        <button type="button" class="rq-btn" data-sheet-send disabled>Send rating</button>
        <button type="button" class="rq-btn rq-btn--text" data-sheet-skip>Skip for now</button>
      </div>
      <p class="rq-muted rq-rate-foot">Skipped drivers stay on Home until you rate them. You can also swipe left to skip.</p>
    </div>`;
}
function showRateCard({ direction = 0, swiped = false } = {}) {
  const stage = $("rateStage");
  $("rateStep").textContent = `${rateIndex + 1} of ${rateQueue.length}`;
  const old = stage.firstElementChild;
  stage.insertAdjacentHTML("beforeend", rateSheetCard(rateQueue[rateIndex]));
  const next = stage.lastElementChild;
  if (!old) return;
  if (!direction || reduceMotion()) return old.remove();
  // Forward: the finished driver leaves to the left, the next comes in from the right.
  if (swiped) old.remove();
  else {
    old.inert = true; // the leaving card can't be tapped or read out
    old.setAttribute("aria-hidden", "true");
    old.style.position = "absolute";
    old.style.inset = "0 0 auto 0";
    old.animate([{ transform: "none", opacity: 1 }, { transform: "translateX(-24%)", opacity: 0 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).finished.then(() => old.remove());
  }
  next.animate([{ transform: "translateX(24%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
}
function nextRateCard(opts = {}) {
  rateIndex += 1;
  if (rateIndex >= rateQueue.length) closeSheet($("rateSheet"));
  else showRateCard({ direction: 1, ...opts });
}
function openRating() {
  rateQueue = toRateList();
  if (!rateQueue.length) return;
  rateIndex = 0;
  ratedCount = 0;
  $("rateStage").replaceChildren();
  showRateCard();
  openSheet($("rateSheet"));
}
// However the sheet closes (done, Close, drag, Esc), Home shows what's left to rate.
$("rateSheet").addEventListener("close", () => {
  withFlip(() => renderHome());
  if (ratedCount) toastSuccess(ratedCount === 1 ? "Thanks. Your rating was saved." : `Thanks. ${ratedCount} ratings saved.`);
  ratedCount = 0;
});
$("rateStage").addEventListener("click", async (e) => {
  const card = e.target.closest(".rq-rate-card");
  if (!card) return;
  const star = e.target.closest("[data-sheet-star]");
  if (star) {
    const value = Number(star.dataset.sheetStar);
    card.dataset.value = value;
    card.querySelectorAll("[data-sheet-star]").forEach((s) => {
      const n = Number(s.dataset.sheetStar);
      s.classList.toggle("is-on", n <= value);
      s.setAttribute("aria-checked", String(n === value));
    });
    card.querySelector("[data-sheet-send]").disabled = false;
    return;
  }
  if (e.target.closest("[data-sheet-skip]")) return nextRateCard();
  const send = e.target.closest("[data-sheet-send]");
  if (!send) return;
  const d = deliveries.find((x) => x.id === card.dataset.rateId);
  send.disabled = true;
  send.textContent = "Sending…";
  const value = Number(card.dataset.value);
  const { error } = await submitRating(d.id, profile.id, d.driver_id, value, card.querySelector("textarea").value.trim());
  if (error) {
    send.disabled = false;
    send.textContent = "Send rating";
    toastError("Your rating didn't save. Check your signal and send it again.");
    return;
  }
  ratingsMap.set(d.id, { delivery_id: d.id, rating: value });
  ratedCount += 1;
  renderHistory();
  nextRateCard();
});

// Swipe a rating card left to skip it. Vertical moves stay page scrolls.
let swipe = null;
$("rateStage").addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".rq-rate-card");
  if (!card || e.target.closest("button, textarea")) return;
  swipe = { card, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, active: false, samples: [{ y: 0, t: e.timeStamp }] };
});
$("rateStage").addEventListener("pointermove", (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x0;
  if (!swipe.active) {
    if (Math.abs(dx) < 10) return;
    if (Math.abs(e.clientY - swipe.y0) > Math.abs(dx)) return (swipe = null);
    swipe.active = true;
    swipe.card.setPointerCapture(e.pointerId);
  }
  const width = swipe.card.offsetWidth;
  // Nothing to go back to: dragging right only resists.
  swipe.x = dx > 0 ? rubberband(dx, width) : dx;
  swipe.samples.push({ y: swipe.x, t: e.timeStamp });
  if (swipe.samples.length > 6) swipe.samples.shift();
  swipe.card.style.transform = `translateX(${swipe.x}px)`;
  swipe.card.style.opacity = String(1 - Math.min(Math.abs(swipe.x) / width, 1) * 0.6);
});
function endSwipe(e) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const { card, x, active, samples } = swipe;
  swipe = null;
  if (!active) return;
  const width = card.offsetWidth;
  const v = e.type === "pointercancel" ? 0 : releaseVelocity(samples);
  if (x + project(v) < -width * 0.35 || v < -600) {
    if (reduceMotion()) return nextRateCard({ swiped: true });
    card.animate([{ transform: `translateX(${x}px)`, opacity: card.style.opacity }, { transform: `translateX(${-width}px)`, opacity: 0 }], { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "forwards" })
      .finished.then(() => nextRateCard({ swiped: true }));
    return;
  }
  const settle = () => {
    card.style.transform = "";
    card.style.opacity = "";
  };
  if (reduceMotion()) return settle();
  animateSpring(x, 0, v, (val) => {
    card.style.transform = `translateX(${val}px)`;
    card.style.opacity = String(1 - Math.min(Math.abs(val) / width, 1) * 0.6);
  }, settle);
}
$("rateStage").addEventListener("pointerup", endSwipe);
$("rateStage").addEventListener("pointercancel", endSwipe);

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
  highlightId = result.data?.id || null;
  await loadDeliveries();
  if (cancelError) toastError(`Your new booking is in, but ${d.delivery_code} couldn't be cancelled. Cancel it from Home.`);
  else toastSuccess(`Booked for ${day(new Date(input.value).toISOString())}. Drivers can see it now.`);
});

// ---------- Card actions (one listener for every list) ----------
let cancelTarget = null;
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a");
  if (!t) {
    // Tapping a closed row's summary (bars, status line) opens it too.
    const card = e.target.closest("#homeLists .rq-item");
    if (card && !e.target.closest(".rq-item-details")) toggleRow(card.dataset.deliveryId);
    return;
  }

  if (t.matches("[data-reload]")) return loadDeliveries();
  if (t.matches(".rq-item-head")) return toggleRow(t.closest(".rq-item").dataset.deliveryId);
  if (t.matches("[data-open-rating]")) return openRating();
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


  if (t.dataset.openRate) {
    const card = t.closest("[data-delivery-id]");
    const slot = card.querySelector(".rq-rate-slot");
    const d = deliveries.find((x) => x.id === t.dataset.openRate);
    slot.innerHTML = starPicker(d);
    t.hidden = true;
    slot.querySelector("[data-star]").focus();
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
    loadDeliveries();
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
      const card = document.querySelector(`[data-delivery-id="${CSS.escape(d.id)}"]`);
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
  // Let the card leave before the list redraws without it.
  const card = document.querySelector(`#homeLists [data-delivery-id="${CSS.escape(d.id)}"]`);
  if (card && !reduceMotion()) {
    card.classList.add("rq-leave");
    await new Promise((resolve) => {
      card.addEventListener("animationend", resolve, { once: true });
      setTimeout(resolve, 220);
    });
  }
  loadDeliveries();
});

// ---------- Notifications ----------
let notifications = [];
function renderUnread() {
  const unread = notifications.filter((n) => !n.is_read).length;
  document.querySelectorAll("[data-unread]").forEach((b) => {
    b.hidden = unread === 0;
    b.textContent = unread > 9 ? "9+" : String(unread);
  });
  document.querySelectorAll("[data-open-notifs]").forEach((b) =>
    b.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications"),
  );
  document.querySelectorAll("[data-unread-text]").forEach((el) => (el.textContent = unread ? `${unread} unread` : ""));
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
  if (d) sheet._returnFocus = null; // focus goes to the card instead of the bell
  const closed = closeSheet(sheet);
  if (!d) return;
  goTo(HISTORY_STATUSES.includes(d.status) ? "history" : "home");
  // The page behind a modal sheet can't take focus, so wait for it to leave.
  await closed;
  const card = document.querySelector(`[data-delivery-id="${CSS.escape(d.id)}"]`);
  card?.scrollIntoView({ block: "center" });
  card?.focus({ preventScroll: true });
});

loadDeliveries();
loadNotifications();
subscribeToNotifications(profile.id, () => {
  loadNotifications();
  loadDeliveries();
});
