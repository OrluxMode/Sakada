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
  bookingErrorCopy,
  contactUrl,
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
  localDateString,
} from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";

// One script serves both requester dashboards; the page says which role it's for.
const ROLE = document.body.dataset.role;
if (ROLE !== "farmer" && ROLE !== "vendor") {
  throw new Error(`requester-dashboard.js: unexpected data-role "${ROLE}"`);
}
const CONTACT = "../../pages/contact.html";
const DISMISSED_KEY = "sakada.ratingDismissed";

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

const dismissed = new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
const dismiss = (id) => {
  dismissed.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
};

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
  return `
    <div class="rq-map"><img id="map-${esc(d.id)}" src="${staticMapUrl(d.current_lat, d.current_lng)}" alt="Map showing where the truck is now" width="600" height="320" loading="lazy" /></div>
    <p class="rq-muted" id="map-caption-${esc(d.id)}">Truck location · updated ${time(d.updated_at)}</p>`;
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

function activeCard(d) {
  const cancel = d.status === "pending"
    ? `<button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>`
    : "";
  const late = pickupPassed(d)
    ? `<div class="rq-banner rq-banner--warn" role="status"><p><strong>Pickup date has passed.</strong> No driver has accepted yet. Cancel and book a new date, or keep waiting.</p></div>`
    : "";
  const waitingLine = d.status === "pending"
    ? `<p>Drivers can see your request now. You can cancel until one accepts.</p>`
    : "";
  return `
    <article class="rq-card${d.id === highlightId ? " rq-card--new" : ""}" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted">${metaLine(d)}</p>
      ${routeBlock(d)}
      ${renderStageStepper(d.status)}
      ${driverBlock(d)}
      ${mapBlock(d)}
      ${waitingLine}
      ${late}
      ${fareBlock(d)}
      ${cancel}
    </article>`;
}

function rateCard(d) {
  return `
    <article class="rq-card rq-card--rate" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="delivered">Delivered</span> ${esc(d.delivery_code)} · ${day(d.updated_at)}</p>
      ${starPicker(d)}
      <div class="rq-card-actions">
        <button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">Book again</button>
        <button type="button" class="rq-btn rq-btn--text" data-dismiss-id="${esc(d.id)}">Not now</button>
      </div>
    </article>`;
}

function section(title, sub, cards) {
  if (!cards.length) return "";
  return `
    <section class="rq-section">
      <h2 class="rq-section-title">${title}</h2>
      ${sub ? `<p class="rq-muted">${sub}</p>` : ""}
      ${cards.join("")}
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
  const toRate = deliveries.filter(
    (d) => d.status === "delivered" && d.driver_id && !ratingsMap.get(d.id) && !dismissed.has(d.id),
  );
  $("homeSummary").textContent = homeSummary({
    onRoad: onRoad.length,
    assigned: assigned.length,
    waiting: waiting.length,
    toRate: toRate.length,
  });
  $("homeLists").innerHTML = deliveries.length
    ? section("On the road", "", onRoad.map(activeCard)) +
      section("Driver assigned", "Goods not picked up yet", assigned.map(activeCard)) +
      section("Waiting for a driver", "", waiting.map(activeCard)) +
      section("Rate your driver", "", toRate.map(rateCard)) ||
      `<div class="rq-card rq-empty"><p><strong>Nothing in progress.</strong></p><p class="rq-muted">Your past deliveries are in History.</p><a class="rq-btn" href="#book">Book a truck</a></div>`
    : firstVisit();
  markAdvanced(active);
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
        if (caption) caption.textContent = `Truck location · updated ${time(updated.updated_at || new Date())}`;
        if (updated.status && updated.status !== d.status) loadDeliveries();
      });
      activeSubscriptions.set(d.id, channel);
    });
}

// ---------- Card actions (one listener for every list) ----------
let cancelTarget = null;
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;

  if (t.matches("[data-reload]")) return loadDeliveries();

  if (t.dataset.cancelId) {
    cancelTarget = deliveries.find((d) => d.id === t.dataset.cancelId);
    if (!cancelTarget) return;
    $("cancelWhat").textContent = `${cancelTarget.delivery_code} · ${cancelTarget.goods_description}, ${cancelTarget.pickup_address.split(",")[0]} → ${cancelTarget.dropoff_address.split(",")[0]}. No driver has accepted yet.`;
    openSheet($("cancelSheet"));
    return;
  }

  if (t.dataset.rebookId) {
    const d = deliveries.find((x) => x.id === t.dataset.rebookId);
    if (!d) return;
    for (const [id, value] of Object.entries(rebookValues(d))) {
      inputs[id].value = value;
      inputs[id].dispatchEvent(new Event("input", { bubbles: true }));
    }
    inputs.scheduledPickup.value = "";
    resetQuote();
    goTo("book");
    inputs.scheduledPickup.focus({ preventScroll: true });
    return;
  }

  if (t.dataset.dismissId) {
    dismiss(t.dataset.dismissId);
    renderHome();
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
