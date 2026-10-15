// Driver dashboard (v4 design, Figma "driver dashboard" v4).
// One page, four views: Home · New jobs · History · Profile (hash tabs, so
// realtime stays connected). Phones get a bottom tab bar and a sticky bar
// with the current job's next step; desktop shows New jobs as a side panel.
import { sanitizeText } from "./sanitize.js";
import { supabase } from "./supabase-client.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  getAvailableDeliveries,
  acceptDelivery,
  getMyAssignedDeliveries,
  updateDeliveryStatus,
  updateDeliveryLocation,
  markDelivered,
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
  initialsFor,
  formatPeso,
  contactUrl,
  renderDriverStepper,
  driverAction,
  activeJobs,
  pickCurrentJob,
  mapsUrl,
  pickupDayLabel,
  shortPlace,
  jobErrorCopy,
  locationProblem,
  undoSeconds,
  paymentLine,
  MAX_ACTIVE_JOBS,
} from "./dashboard-shared.js";
import { initOfflineDetection } from "./offline.js";
import { getMyVehicle, saveMyVehicle } from "./driver-profile.js";
import { checkVehicleType, checkPlate } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";

const CONTACT = "../../pages/contact.html";
const KEYS = {
  pending: "sakada.pendingStep", // a step waiting out its Undo, sent on next open if the page closed
  current: "sakada.currentJob",
  dismissed: "sakada.ratingDismissed",
  cancelAck: "sakada.cancelSeen",
};
const LOCATION_EVERY_MS = 20000;

const profile = await requireRole("driver", "../../auth/login.html", "../../index.html");
if (!profile) throw new Error("redirecting");

document.getElementById("pageLoader")?.classList.add("page-loader--hidden");
initOfflineDetection();
updateLastLogin();

const $ = (id) => document.getElementById(id);
const esc = (v) => sanitizeText(v == null ? "" : String(v));
const time = (iso) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const changedAt = (d) => d.status_changed_at || d.updated_at;
const goods = (d) => shortPlace(d.goods_description);
const readSet = (key) => new Set(JSON.parse(localStorage.getItem(key) || "[]"));
const saveSet = (key, set) => localStorage.setItem(key, JSON.stringify([...set]));

document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = profile.full_name));
document.querySelectorAll("[data-initials]").forEach((el) => (el.textContent = initialsFor(profile.full_name)));
supabase.auth.getUser().then(({ data }) => {
  if (data?.user?.email) $("profileEmail").textContent = ` · ${data.user.email}`;
});
$("signOutBtn").addEventListener("click", () => signOut("../../index.html"));

const ICON = {
  box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  nav: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  bars: '<path d="M4 20v-2M9 20v-5M14 20v-8M19 20V8"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (name, size = 20) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

// ---------- State ----------
let vehicle = null;
let mine = []; // jobs assigned to this driver
let available = [];
let ratingsMap = new Map();
let loaded = false;
let loadFailed = false;
let checkedAt = null;
let historyFilter = "all";
let selectedId = localStorage.getItem(KEYS.current);
let justDelivered = null; // { id, paid } for the banner after the cash check
let online = navigator.onLine;
const override = new Map(); // id -> status shown while a step waits out its Undo
let pending = JSON.parse(localStorage.getItem(KEYS.pending) || "null");
let undoTimer = null;
const dismissed = readSet(KEYS.dismissed);
const cancelSeen = readSet(KEYS.cancelAck);
const loc = { state: "idle", lastSent: null };
let notifications = [];

// While a step waits out its Undo, show it as done (from now).
const eff = (d) =>
  override.has(d.id) ? { ...d, status: override.get(d.id), status_changed_at: pending?.at || d.status_changed_at } : d;
const hasVehicle = () => Boolean(vehicle?.vehicle_type);
const myActive = () => activeJobs(mine.map(eff));

// ---------- Tabs ----------
const VIEWS = ["home", "jobs", "history", "profile"];
function showView(view, { focus = false } = {}) {
  if (!VIEWS.includes(view)) view = "home";
  document.body.dataset.view = view;
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  renderBar();
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
function openSheet(dialog) {
  dialog._returnFocus = document.activeElement;
  dialog.showModal();
}
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => dialog._returnFocus?.isConnected && dialog._returnFocus.focus());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close(); // tap on the scrim
  });
  dialog.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", () => dialog.close()));
});
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  if (busy) button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
}

// ---------- Snackbar (undo, saving, saved, hints, errors) ----------
const snack = $("snackbar");
let snackTimer = null;
function showSnack({ text, iconName = "check", tone = "", undo = 0, stay = 0, then = null }) {
  clearTimeout(snackTimer);
  snack.hidden = false;
  snack.className = `dv-snack${tone ? ` dv-snack--${tone}` : ""}`;
  snack.setAttribute("role", tone === "bad" ? "alert" : "status");
  const lead = iconName === "spin" ? '<span class="spinner" aria-hidden="true"></span>' : icon(iconName);
  snack.innerHTML = `${lead}<span class="dv-grow">${text}</span>${
    undo ? `<button type="button" class="dv-undo" data-undo>Undo</button><span class="dv-snack-timer" style="animation-duration:${undo}s" aria-hidden="true"></span>` : ""
  }`;
  if (stay) snackTimer = setTimeout(() => (then ? then() : hideSnack()), stay);
}
function hideSnack() {
  snack.hidden = true;
  snack.innerHTML = "";
}

// ---------- Header ----------
function renderHeader() {
  const line = hasVehicle()
    ? [vehicle.vehicle_type, vehicle.vehicle_plate].filter(Boolean).join(" · ")
    : "No vehicle added yet";
  document.querySelectorAll("[data-vehicle-line]").forEach((el) => (el.textContent = line));
}

// ---------- Home ----------
function stopBox(d) {
  const moving = d.status !== "driver_assigned";
  const label =
    d.status === "driver_assigned" ? "Pick up from" : d.status === "picked_up" ? "Next stop: drop off at" : "Drive to";
  const place = moving ? d.dropoff_address : d.pickup_address;
  const url = moving
    ? mapsUrl(d.dropoff_lat, d.dropoff_lng, d.dropoff_address)
    : mapsUrl(d.pickup_lat, d.pickup_lng, d.pickup_address);
  return `
    <div class="dv-stop">
      <p class="dv-stop-label"><span class="dv-ring dv-ring--${moving ? "amber" : "green"}" aria-hidden="true"></span>${label}</p>
      <p class="dv-stop-place">${esc(place)}</p>
      <a class="rq-btn rq-btn--ghost dv-maps" href="${esc(url)}" target="_blank" rel="noopener" data-maps>${icon("nav")}Open in Maps</a>
      ${moving ? `<p class="rq-muted dv-maps-hint">${icon("info", 16)}Sharing pauses while you're in Maps.</p>` : ""}
    </div>`;
}
function collectBox(d) {
  const label = d.status === "picked_up" ? "Collect from the receiver at drop-off" : "Collect at drop-off";
  return `
    <div class="dv-collect">
      ${icon("cash", 24)}
      <span class="dv-stack"><span class="rq-muted">${label}</span><strong class="dv-collect-amount">${formatPeso(d.estimated_cost)}</strong></span>
    </div>`;
}
function notesBox(d) {
  if (!d.notes) return "";
  return `
    <div class="dv-notes">
      ${icon("note")}
      <span class="dv-stack"><span class="rq-muted">Notes from the sender</span><span>${esc(d.notes)}</span></span>
    </div>`;
}
function metaFor(d) {
  if (d.status === "picked_up") return `${esc(d.delivery_code)} · Picked up ${time(changedAt(d))}`;
  if (d.status === "in_transit") return `${esc(d.delivery_code)} · On the road since ${time(changedAt(d))}`;
  const when = pickupDayLabel(d.scheduled_pickup_at);
  return `${esc(d.delivery_code)} · ${when ? `Pickup ${when}` : "Pickup date not set"}`;
}
function actionButton(d, extraClass = "") {
  if (!online) {
    return `<button type="button" class="rq-btn dv-wait ${extraClass}" disabled>${icon("bars")}Waiting for signal</button>`;
  }
  const a = driverAction(d.status);
  if (!a) return "";
  const saving = pending?.id === d.id;
  return `<button type="button" class="rq-btn dv-act ${extraClass}" data-act-id="${esc(d.id)}"${saving ? " disabled" : ""}>${icon(a.icon, 22)}${a.label}</button>`;
}
function actionHint(d) {
  if (!online) return "Updating a job waits until you're back online.";
  if (d.status === "in_transit") return "Opens a cash check first.";
  return "You can undo for a few seconds.";
}
function jobCard(d) {
  const moving = d.status !== "driver_assigned";
  const cashLine = moving
    ? ""
    : `<p class="dv-cash-line">${icon("cash")}<span><strong>${formatPeso(d.estimated_cost)}</strong> from the receiver at drop-off, ${esc(shortPlace(d.dropoff_address))}</span></p>`;
  return `
    <article class="rq-card dv-job" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <div>
        <h2 class="rq-card-title dv-job-title">${esc(d.goods_description)} · ${Number(d.quantity_kg).toLocaleString("en-PH")} kg</h2>
        <p class="rq-muted">${metaFor(d)}</p>
      </div>
      ${renderDriverStepper(d.status)}
      ${d.status === "picked_up" ? `<p class="dv-done">${icon("check")}<span>Picked up at ${esc(d.pickup_address)}</span></p>` : ""}
      <div class="dv-grid">
        ${stopBox(d)}
        <div class="dv-side">
          ${moving ? collectBox(d) : ""}
          ${notesBox(d)}
          ${cashLine}
        </div>
      </div>
      <div class="dv-card-action">${actionButton(d)}<span class="rq-muted">${actionHint(d)}</span></div>
    </article>`;
}
function phaseWord(d) {
  return d.status === "driver_assigned" ? "Pick up" : "Drive";
}
function chips(active, current) {
  return `
    <div class="dv-chips" role="group" aria-label="Your jobs">
      ${active
        .map(
          (d) => `<button type="button" class="dv-chip" data-select-id="${esc(d.id)}" aria-pressed="${d.id === current.id}">
            <span class="dv-dot dv-dot--${d.status === "driver_assigned" ? "grey" : "green"}" aria-hidden="true"></span><span class="dv-chip-label">${esc(goods(d))}<span class="dv-chip-code"> · ${esc(d.delivery_code)}</span> · ${phaseWord(d)}</span></button>`,
        )
        .join("")}
    </div>`;
}
function shareLine(active) {
  const moving = active.filter((d) => d.status !== "driver_assigned");
  const waiting = active.filter((d) => d.status === "driver_assigned");
  const sent = loc.lastSent && loc.state === "sharing" ? ` · sent ${time(loc.lastSent)}` : "";
  if (!moving.length) return "Location sharing starts when you pick up.";
  const who = moving.length === 2 ? "both jobs" : esc(goods(moving[0]));
  const rest = waiting.length ? ` ${esc(goods(waiting[0]))} start${waiting.length === 1 ? "s" : ""} when you pick up.` : "";
  if (loc.state === "sharing" || loc.state === "idle") return `Sharing your location on ${who}${sent}.${rest}`;
  if (loc.state === "paused") return `Sharing paused while Sakada is in the background.${rest}`;
  return `Your location isn't reaching the sender right now.${rest}`;
}
function ratePrompt() {
  // Right after the cash check, or the latest delivered job not yet rated.
  const recent = mine
    .filter((d) => d.status === "delivered" && !ratingsMap.get(d.id) && !dismissed.has(d.id))
    .filter((d) => d.id === justDelivered?.id || Date.now() - new Date(changedAt(d)) < 2 * 86400000)
    .sort((a, b) => new Date(changedAt(b)) - new Date(changedAt(a)))[0];
  if (!recent) return "";
  const unpaid = recent.payment_status === "unpaid";
  const lead = unpaid
    ? `<strong>Delivered. Marked Unpaid.</strong><br />Sakada will follow up with the receiver. Nothing else for you to do. How was this job?`
    : `<strong>Delivered. Nice work.</strong><br />How was this job? Your rating helps other drivers.`;
  return `
    <div class="dv-rated" data-delivery-id="${esc(recent.id)}" tabindex="-1">
      <div class="rq-banner rq-banner--ok" role="status">${icon("check")}<p>${lead}</p></div>
      <div class="dv-rate-row-wrap">
        ${starPicker(recent, false)}
        <button type="button" class="rq-btn rq-btn--ghost dv-later" data-dismiss-id="${esc(recent.id)}">Later</button>
      </div>
    </div>`;
}
function starPicker(d, withBox = true) {
  return `
    <div class="${withBox ? "rq-rate" : "dv-rate-bare"}" data-rate-for="${esc(d.id)}">
      ${withBox ? `<p><strong>How was this job?</strong></p>` : ""}
      <div class="rq-stars" role="radiogroup" aria-label="Rate the sender">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-star="${n}"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}
      </div>
      <button type="button" class="rq-btn rq-btn--ghost" data-send-rating hidden>Send rating</button>
    </div>`;
}
function cancelledCards() {
  return mine
    .filter((d) => d.status === "cancelled" && !cancelSeen.has(d.id) && Date.now() - new Date(changedAt(d)) < 3 * 86400000)
    .map(
      (d) => `
      <article class="rq-card dv-cancelled" data-delivery-id="${esc(d.id)}" tabindex="-1">
        <h2 class="rq-card-title">${esc(d.delivery_code)} · ${esc(d.goods_description)}</h2>
        <div class="rq-banner rq-banner--bad" role="alert">${icon("x")}<p><strong>Sakada cancelled this job</strong><br />Nothing to pick up. If you were on your way, <a href="${esc(contactUrl(CONTACT, d.delivery_code))}">send Sakada a message</a>.</p></div>
        <button type="button" class="rq-btn rq-btn--ghost" data-ack-cancel="${esc(d.id)}">${icon("bag")}See new jobs</button>
      </article>`,
    )
    .join("");
}
function firstVisit() {
  return `
    <div class="rq-card dv-first">
      <h2 class="rq-display">Add your vehicle</h2>
      <p>Senders see your truck type and plate once you accept, so they know who to hand the goods to.</p>
      <a class="rq-btn" href="#profile" data-add-vehicle>${icon("truck")}Add vehicle</a>
    </div>
    <div class="rq-card">
      <h2 class="rq-display">How jobs work</h2>
      <ol class="dv-steps">
        <li>Open New jobs and check the route, weight and date</li>
        <li>Accept. The first driver to accept gets it, and only Sakada can cancel it after</li>
        <li>Tap "I've picked up the load" when loaded, then "I'm driving to drop-off" when you leave</li>
        <li>Keep Sakada open on the road. Opening Maps pauses sharing until you come back</li>
        <li>At drop-off, collect the exact fare in cash, then tap "I've delivered it"</li>
      </ol>
      <a class="rq-btn rq-btn--ghost" href="#jobs">See new jobs</a>
    </div>`;
}
function jobsRow() {
  if (!available.length) return "";
  return `<a class="rq-row dv-jobs-row" href="#jobs">${icon("bag")}<span class="dv-grow">${available.length} new job${available.length === 1 ? "" : "s"} waiting</span>${icon("chev", 18)}</a>`;
}
function skeletons(n = 2) {
  return Array.from({ length: n }, () => `
    <div class="skeleton skeleton--card">
      <div class="skeleton__line skeleton__line--title"></div>
      <div class="skeleton__line skeleton__line--text"></div>
      <div class="skeleton__line skeleton__line--text" style="width:60%"></div>
    </div>`).join("");
}

function renderHome() {
  const title = $("homeTitle");
  const body = $("homeBody");
  title.classList.remove("rq-sr");
  if (loadFailed && !loaded) {
    title.textContent = "Home";
    body.innerHTML = `
      <div class="rq-card rq-empty">
        <p><strong>We couldn't load your jobs.</strong></p>
        <p class="rq-muted">Check your signal, then try again.</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-reload>Try again</button>
      </div>`;
    return;
  }
  if (!loaded) {
    title.textContent = "Home";
    body.innerHTML = skeletons();
    return;
  }
  const active = myActive();
  const current = pickCurrentJob(active, selectedId);
  const rate = ratePrompt();
  const rateOnTop = Boolean(justDelivered) || !pickCurrentJob(active, selectedId);
  const top = cancelledCards() + (rateOnTop ? rate : "");
  $("helpRow").href = contactUrl(CONTACT, current?.delivery_code);

  if (!current) {
    if (!hasVehicle() && !mine.length) {
      title.textContent = "Home";
      title.classList.add("rq-sr");
      body.innerHTML = top + firstVisit();
      return;
    }
    title.textContent = "No job right now";
    body.innerHTML = `${top}
      <div class="rq-card rq-empty">
        <p>Pick one from New jobs. The first driver to accept gets it.</p>
        <a class="rq-btn" href="#jobs">See new jobs${available.length ? ` (${available.length})` : ""}</a>
      </div>`;
    return;
  }
  title.textContent = active.length > 1 ? `${active.length} jobs in progress` : "Current job";
  const noVehicle = hasVehicle()
    ? ""
    : `<div class="rq-banner rq-banner--warn dv-gap" role="status">${icon("truck")}<p><strong>Add your vehicle</strong> so senders know which truck to look for. <a href="#profile" data-add-vehicle>Add vehicle</a></p></div>`;
  body.innerHTML = `${top}${noVehicle}
    ${active.length > 1 ? chips(active, current) : ""}
    <p class="rq-muted dv-share-line${active.length > 1 ? "" : " dv-share-line--solo"}">${shareLine(active)}</p>
    ${jobCard(current)}
    ${jobsRow()}
    ${rateOnTop ? "" : rate}`;
}

// ---------- Sticky action bar (phones) ----------
function shareStatus(d) {
  if (d.status === "driver_assigned") return `<span class="dv-dot dv-dot--grey" aria-hidden="true"></span>Starts at pickup`;
  const words = {
    sharing: loc.lastSent ? `Sharing · sent ${time(loc.lastSent)}` : "Sharing",
    idle: "Sharing",
    paused: "Sharing paused",
    weak: "No signal",
    nosignal: "No signal",
    off: "Location off",
    blocked: "Location blocked",
    unsupported: "Can't share",
  };
  const tone = loc.state === "sharing" || loc.state === "idle" ? "green" : loc.state === "paused" ? "grey" : "red";
  return `<span class="dv-dot dv-dot--${tone}" aria-hidden="true"></span>${words[loc.state] || "Sharing"}`;
}
function renderBar() {
  const bar = $("actionBar");
  const current = loaded ? pickCurrentJob(myActive(), selectedId) : null;
  const show = Boolean(current) && document.body.dataset.view === "home";
  bar.hidden = !show;
  document.body.classList.toggle("dv-has-bar", show);
  if (!show) return;
  $("barJob").textContent = `${goods(current)} · ${current.delivery_code}`;
  $("barShare").innerHTML = shareStatus(current);
  $("barAction").innerHTML = actionButton(current, "dv-bar-btn");
}

// ---------- Location banners ----------
function renderLocBanner() {
  const moving = myActive().some((d) => d.status !== "driver_assigned");
  const el = $("locBanner");
  if (!moving) {
    el.innerHTML = "";
    return;
  }
  const last = loc.lastSent ? `Last sent ${time(loc.lastSent)}. ` : "";
  el.innerHTML =
    {
      off: `<div class="rq-banner rq-banner--bad" role="alert">${icon("phone")}<p><strong>Location is off on your phone</strong><br />Swipe down and turn on Location in quick settings, then come back.</p></div>
        <button type="button" class="rq-btn rq-btn--ghost dv-gap" data-loc-retry>${icon("refresh")}I turned it on, check again</button>`,
      blocked: `<div class="rq-banner rq-banner--bad dv-blocked" role="alert"><p><strong>Location is blocked for Sakada</strong><br />In Chrome: tap the icon left of the web address → Permissions → Location → Allow. If the switch is grey, turn on Location in quick settings first.</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-loc-retry>${icon("refresh")}I've allowed it, check again</button></div>`,
      unsupported: `<div class="rq-banner rq-banner--plain dv-gap">${icon("pin")}<p><strong>This browser can't share location</strong><br />You can still do the job. Try Chrome so the sender can follow the truck.</p></div>`,
      nosignal: `<div class="rq-banner rq-banner--warn dv-gap" role="status">${icon("bars")}<p><strong>No signal</strong><br />${last}We'll send again when you're back in range.</p></div>`,
      weak: `<div class="rq-banner rq-banner--warn dv-gap" role="status">${icon("bars")}<p><strong>No signal</strong><br />${last}We'll send again when you're back in range.</p></div>`,
    }[loc.state] || "";
}

// ---------- New jobs ----------
function offerCard(d, blocked) {
  const when = pickupDayLabel(d.scheduled_pickup_at);
  const facts = [
    when ? `Pickup ${when}` : "Pickup date not set",
    d.distance_km ? `${Math.round(d.distance_km)} km by road` : "distance not saved",
  ].join(" · ");
  const button = !online
    ? `<button type="button" class="rq-btn dv-wait" disabled>${icon("bars")}Waiting for signal</button>`
    : blocked
      ? `<button type="button" class="rq-btn dv-wait" disabled>Accept job</button>`
      : `<button type="button" class="rq-btn dv-accept" data-accept-id="${esc(d.id)}">Accept job</button>`;
  return `
    <article class="rq-card dv-offer" data-offer-id="${esc(d.id)}" tabindex="-1">
      <div class="dv-offer-top">
        <div>
          <h3 class="rq-card-title">${esc(d.goods_description)} · ${Number(d.quantity_kg).toLocaleString("en-PH")} kg</h3>
          <p class="rq-muted">${esc(d.delivery_code)} · Posted ${time(d.created_at)}</p>
        </div>
        <p class="dv-price"><strong>${formatPeso(d.estimated_cost)}</strong><span class="rq-muted">cash at drop-off</span></p>
      </div>
      <div class="rq-route dv-offer-route">
        <span class="rq-route-dots" aria-hidden="true"></span>
        <div><p><span class="rq-sr">From </span>${esc(d.pickup_address)}</p><p><span class="rq-sr">To </span>${esc(d.dropoff_address)}</p></div>
      </div>
      <p class="dv-offer-short rq-muted">${esc(shortPlace(d.pickup_address))} → ${esc(shortPlace(d.dropoff_address))}</p>
      <p class="dv-offer-facts">${facts}</p>
      ${button}
    </article>`;
}
let jobsNotice = ""; // a one-off banner (no longer available, too many tries)
function renderJobs() {
  const capped = myActive().length >= MAX_ACTIVE_JOBS;
  const list = $("jobsList");
  $("jobsTitle").textContent = `New jobs${available.length ? ` (${available.length})` : ""}`;
  $("checkedAt").textContent = checkedAt ? `Checked ${time(checkedAt)}` : "";
  document.querySelectorAll("[data-jobs-count]").forEach((b) => {
    b.hidden = !available.length;
    b.textContent = available.length > 9 ? "9+" : String(available.length);
  });
  const notices = [];
  if (jobsNotice) notices.push(jobsNotice);
  if (capped) {
    notices.push(`<div class="dv-cap" role="status">${icon("bag")}<p><strong>You have ${MAX_ACTIVE_JOBS} jobs</strong><br /><span class="rq-muted">Finish one to accept more.</span></p></div>`);
  } else if (loaded && !hasVehicle()) {
    notices.push(`<div class="rq-banner rq-banner--warn" role="status">${icon("truck")}<p><strong>Add your vehicle first.</strong> Senders need your truck type and plate to know who to hand the goods to. <a href="#profile" data-add-vehicle>Add vehicle</a></p></div>`);
  }
  $("jobsMessage").innerHTML = notices.join("");
  if (!loaded) {
    list.innerHTML = skeletons(3);
    return;
  }
  const blocked = capped || !hasVehicle();
  list.innerHTML = available.length
    ? available.map((d) => offerCard(d, blocked)).join("")
    : `<div class="rq-card rq-empty"><p><strong>No new jobs right now</strong></p><p class="rq-muted">New bookings show up here and under Notifications. Tap Refresh to check again.</p></div>`;
}

// ---------- History ----------
function historyCard(d) {
  const rated = ratingsMap.get(d.id);
  const unpaid = d.payment_status === "unpaid";
  const delivered = d.status === "delivered";
  return `
    <article class="rq-card" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${esc(d.goods_description)} · ${Number(d.quantity_kg).toLocaleString("en-PH")} kg</h3>
      <p class="rq-muted"><span class="status-pill" data-status="${esc(d.status)}">${statusLabel(d.status)}</span>${unpaid ? `<span class="status-pill" data-status="unpaid">Unpaid</span>` : ""} ${esc(d.delivery_code)} · ${day(changedAt(d))}</p>
      <p>${esc(d.pickup_address)} → ${esc(d.dropoff_address)}</p>
      ${delivered ? `<div class="rq-fare dv-paid"><span class="rq-fare-amount">${formatPeso(d.estimated_cost)}</span><span class="rq-muted${unpaid ? " dv-unpaid" : ""}">${paymentLine(d)}</span></div>` : `<p class="rq-muted">This job was cancelled. Nothing to collect.</p>`}
      ${delivered && rated ? `<p class="rq-muted">You rated the sender ${rated.rating} of 5</p>` : ""}
      <div class="rq-rate-slot"></div>
      ${delivered && !rated ? `<button type="button" class="rq-row dv-rate-row" data-open-rate="${esc(d.id)}"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg><span class="dv-grow">Rate the sender</span>${icon("chev", 18)}</button>` : ""}
    </article>`;
}
function renderHistory() {
  const history = mine.filter((d) => HISTORY_STATUSES.includes(d.status));
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
  $("historyList").innerHTML = shown.length
    ? shown.map(historyCard).join("")
    : history.length
      ? `<div class="rq-card rq-empty"><p><strong>No ${historyFilter} jobs</strong></p><button type="button" class="rq-btn rq-btn--ghost" data-filter-reset>Show all</button></div>`
      : `<div class="rq-card rq-empty"><p><strong>No past jobs yet</strong></p><p class="rq-muted">Delivered and cancelled jobs show up here.</p></div>`;
}

function renderAll() {
  renderHeader();
  renderHome();
  renderLocBanner();
  renderJobs();
  renderHistory();
  renderBar();
  renderUnread();
}

// ---------- Loading ----------
async function loadAll() {
  const [mineRes, availRes] = await Promise.all([getMyAssignedDeliveries(profile.id), getAvailableDeliveries()]);
  if (mineRes.error || availRes.error) {
    loadFailed = true;
    renderAll();
    return;
  }
  mine = mineRes.data || [];
  available = availRes.data || [];
  checkedAt = new Date();
  ratingsMap = await getMyRatingsForDeliveries(
    mine.filter((d) => d.status === "delivered").map((d) => d.id),
    profile.id,
  );
  loaded = true;
  loadFailed = false;
  // A step left waiting when the page closed: send it now, if the job is still where it was.
  if (pending && !undoTimer) {
    const d = mine.find((x) => x.id === pending.id);
    if (d && d.status === pending.from) {
      override.set(d.id, pending.to);
      commitPending();
    } else {
      clearPending();
    }
  }
  renderAll();
  updateTracking();
}
async function loadAvailable() {
  const { data, error } = await getAvailableDeliveries();
  if (error) {
    jobsNotice = `<div class="rq-banner rq-banner--bad" role="alert">${icon("alert")}<p><strong>We couldn't load new jobs.</strong><br />Check your signal, then tap Refresh.</p></div>`;
  } else {
    available = data || [];
    checkedAt = new Date();
  }
  renderJobs();
  renderHome();
}

const { data: v } = await getMyVehicle(profile.id);
vehicle = v || null;
// Fill the form, but never over something the driver already started typing.
if (vehicle) {
  if (!$("vehicleType").value) $("vehicleType").value = vehicle.vehicle_type || "";
  if (!$("vehiclePlate").value) $("vehiclePlate").value = vehicle.vehicle_plate || "";
}
renderAll();

// ---------- Steps with Undo ----------
function persistPending() {
  if (pending) localStorage.setItem(KEYS.pending, JSON.stringify(pending));
  else localStorage.removeItem(KEYS.pending);
}
function clearPending() {
  clearTimeout(undoTimer);
  undoTimer = null;
  pending = null;
  persistPending();
}
async function startStep(d, viaKeyboard) {
  if (pending) await commitPending();
  const a = driverAction(d.status);
  if (!a || a.cashCheck) return;
  pending = { id: d.id, from: d.status, to: a.next, saving: a.saving, seen: a.seen, done: a.done, at: new Date().toISOString() };
  persistPending();
  override.set(d.id, a.next);
  renderAll();
  const secs = undoSeconds(viaKeyboard);
  showSnack({ text: `${esc(a.done)} · ${esc(goods(d))}`, iconName: a.icon, undo: secs });
  undoTimer = setTimeout(commitPending, secs * 1000);
  if (viaKeyboard) snack.querySelector("[data-undo]")?.focus();
}
function undoStep() {
  if (!pending) return;
  override.delete(pending.id);
  clearPending();
  showSnack({ text: "Undone. Nothing changed on the job.", iconName: "check", stay: 3000 });
  renderAll();
  document.querySelector("[data-act-id]")?.focus();
}
async function commitPending() {
  if (!pending) return true;
  const p = pending;
  clearTimeout(undoTimer);
  undoTimer = null;
  showSnack({ text: `Saving "${esc(p.saving)}"…`, iconName: "spin" });
  const { data, error } = await updateDeliveryStatus(p.id, profile.id, p.from, p.to);
  pending = null;
  persistPending();
  override.delete(p.id);
  if (error) {
    const copy = jobErrorCopy(error);
    if (copy.kind === "gone") {
      await loadAll(); // Sakada may have cancelled it: the card says so
      hideSnack();
      return false;
    }
    showSnack({ text: copy.kind === "rate" ? copy.message : `<strong>That didn't save</strong><br />${esc(copy.message.replace(/^That didn't save\. /, ""))}`, iconName: "alert", tone: "bad", stay: 8000 });
    renderAll();
    return false;
  }
  const row = mine.find((x) => x.id === p.id);
  if (row) Object.assign(row, data || { status: p.to, status_changed_at: new Date().toISOString() });
  renderAll();
  updateTracking();
  showSnack({
    text: `Saved. The sender sees "${esc(p.seen)}".`,
    iconName: "check",
    stay: 2500,
    then:
      p.to === "picked_up"
        ? () => showSnack({ text: `Next, tap "I'm driving to drop-off" when you leave.`, iconName: "truck", stay: 6000 })
        : null,
  });
  return true;
}
// Leaving the page, locking the phone: save the step now instead of losing it.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (pending) commitPending();
    if (loc.state === "sharing") {
      loc.state = "paused";
    }
  } else {
    loadAll();
    pushLocation();
  }
});
window.addEventListener("pagehide", () => {
  if (pending) commitPending();
});

// ---------- Accept ----------
let acceptTarget = null;
function openAccept(d) {
  acceptTarget = d;
  const when = pickupDayLabel(d.scheduled_pickup_at);
  $("acceptWhat").textContent = `${d.delivery_code} · ${goods(d)} · ${when ? `Pick up ${when}, ` : ""}${shortPlace(d.pickup_address)} · ${formatPeso(d.estimated_cost)} cash at drop-off`;
  $("acceptMessage").hidden = true;
  const btn = $("acceptConfirm");
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = "Yes, take it";
  openSheet($("acceptSheet"));
}
$("acceptConfirm").addEventListener("click", async () => {
  const d = acceptTarget;
  const btn = $("acceptConfirm");
  if (!d) return;
  setBusy(btn, true, "Taking it…");
  const { error } = await acceptDelivery(d.id, profile.id);
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = "Yes, take it";
  if (error) {
    const copy = jobErrorCopy(error);
    if (copy.kind === "gone" || copy.kind === "cap") {
      $("acceptSheet").close();
      jobsNotice =
        copy.kind === "gone"
          ? `<div class="rq-banner rq-banner--warn" role="alert">${icon("alert")}<p><strong>This job is no longer available</strong><br />Someone else got it first, or it was cancelled.</p></div>
             <button type="button" class="rq-btn rq-btn--ghost dv-gap" data-refresh>${icon("refresh")}See other jobs</button>`
          : "";
      await loadAll();
      $("jobsMessage").querySelector("[role=alert], [role=status]")?.setAttribute("tabindex", "-1");
      $("jobsMessage").querySelector("[role=alert], [role=status]")?.focus();
      return;
    }
    const msg = $("acceptMessage");
    msg.textContent = copy.message;
    msg.hidden = false;
    return;
  }
  $("acceptSheet").close();
  jobsNotice = "";
  selectedId = d.id;
  localStorage.setItem(KEYS.current, d.id);
  goTo("home");
  await loadAll();
  showSnack({ text: "Accepted. The sender now sees your name and truck.", iconName: "check", stay: 4000 });
  document.querySelector(`.dv-job[data-delivery-id="${CSS.escape(d.id)}"]`)?.focus();
});

// ---------- Delivered: cash check ----------
let deliverTarget = null;
function openDelivered(d) {
  deliverTarget = d;
  $("deliveredTitle").textContent = `${d.goods_description} delivered?`;
  $("deliveredAmount").textContent = `${formatPeso(d.estimated_cost)} in cash?`;
  $("deliveredMessage").hidden = true;
  openSheet($("deliveredSheet"));
}
$("deliveredSheet").querySelectorAll("[data-paid]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const d = deliverTarget;
    if (!d) return;
    if (!online) {
      $("deliveredMessage").textContent = "You're offline. Tap again when you have signal.";
      $("deliveredMessage").hidden = false;
      return;
    }
    const paid = btn.dataset.paid === "yes";
    const buttons = $("deliveredSheet").querySelectorAll("[data-paid]");
    const label = btn.innerHTML;
    buttons.forEach((b) => (b.disabled = true));
    setBusy(btn, true, "Saving…");
    const { data, error } = await markDelivered(d.id, profile.id, paid);
    buttons.forEach((b) => (b.disabled = false));
    btn.removeAttribute("aria-busy");
    btn.innerHTML = label;
    if (error) {
      const copy = jobErrorCopy(error);
      if (copy.kind === "gone") {
        $("deliveredSheet").close();
        await loadAll();
        return;
      }
      $("deliveredMessage").textContent = copy.message;
      $("deliveredMessage").hidden = false;
      return;
    }
    const row = mine.find((x) => x.id === d.id);
    if (row) Object.assign(row, data || { status: "delivered", payment_status: paid ? "paid" : "unpaid", status_changed_at: new Date().toISOString() });
    justDelivered = { id: d.id, paid };
    $("deliveredSheet").close();
    if (selectedId === d.id) selectedId = null;
    goTo("home");
    renderAll();
    updateTracking();
    const prompt = document.querySelector(".dv-rated");
    prompt?.focus();
  }),
);

// ---------- Location sharing ----------
let trackingInterval = null;
function movingIds() {
  return mine.filter((d) => d.status === "picked_up" || d.status === "in_transit").map((d) => d.id);
}
function updateTracking() {
  const ids = movingIds();
  if (ids.length && !trackingInterval) {
    pushLocation();
    trackingInterval = setInterval(pushLocation, LOCATION_EVERY_MS);
  } else if (!ids.length && trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
    loc.state = "idle";
    renderLocBanner();
    renderBar();
  }
}
function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}
function setLoc(state) {
  loc.state = state;
  renderLocBanner();
  renderBar();
  const line = document.querySelector(".dv-share-line");
  if (line) line.innerHTML = shareLine(myActive());
}
async function pushLocation() {
  const ids = movingIds();
  if (!ids.length) return;
  if (!navigator.geolocation) return setLoc("unsupported");
  if (!online) return setLoc("nosignal");
  let position;
  try {
    position = await getBrowserPosition();
  } catch (err) {
    return setLoc(locationProblem(err));
  }
  const { latitude, longitude } = position.coords;
  const results = await Promise.all(ids.map((id) => updateDeliveryLocation(id, profile.id, latitude, longitude)));
  if (results.some((r) => r.error)) return setLoc("nosignal");
  loc.lastSent = new Date();
  setLoc("sharing");
}

// ---------- Online / offline ----------
window.addEventListener("offline", () => {
  online = false;
  if (movingIds().length) loc.state = "nosignal";
  renderAll();
});
window.addEventListener("online", () => {
  online = true;
  renderAll();
  pushLocation();
});

// ---------- Vehicle ----------
const VEHICLE_RULES = [
  [$("vehicleType"), checkVehicleType],
  [$("vehiclePlate"), checkPlate],
];
clearWhenFixed(VEHICLE_RULES);
$("vehicleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("vehicleMessage");
  msg.hidden = true;
  if (!validateFields(VEHICLE_RULES)) return;
  if (!online) {
    msg.textContent = "You're offline. Your vehicle saves when you're back online and tap Save again.";
    msg.hidden = false;
    return;
  }
  const btn = $("vehicleSaveBtn");
  const type = $("vehicleType").value;
  const plate = $("vehiclePlate").value;
  setBusy(btn, true, "Saving…");
  const { error } = await saveMyVehicle(profile.id, type, plate);
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = "Save vehicle";
  if (error) {
    msg.textContent = "Your vehicle didn't save. Check your signal and try again.";
    msg.hidden = false;
    return;
  }
  vehicle = { vehicle_type: type.trim().slice(0, 40) || null, vehicle_plate: plate.trim().toUpperCase().slice(0, 15) || null };
  $("vehiclePlate").value = vehicle.vehicle_plate || "";
  renderAll();
  showSnack({ text: "Vehicle saved. Senders see it once you accept their job.", iconName: "check", stay: 4000 });
});

// ---------- One listener for every button and link ----------
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;

  if (t.matches("[data-undo]")) return undoStep();
  if (t.matches("[data-reload]")) return loadAll();
  if (t.matches("[data-refresh]")) {
    jobsNotice = "";
    $("jobsList").setAttribute("aria-busy", "true");
    await loadAvailable();
    $("jobsList").removeAttribute("aria-busy");
    return;
  }
  if (t.matches("[data-loc-retry]")) return pushLocation();

  if (t.matches("[data-maps]")) {
    // Leaving for Maps: save a waiting step first so it isn't lost.
    if (pending) {
      showSnack({ text: "Saved your step, opening Maps…", iconName: "nav", stay: 3000 });
      commitPending();
    }
    return; // let the link open
  }

  if (t.matches("[data-add-vehicle]")) {
    e.preventDefault();
    goTo("profile");
    $("vehicleType").focus();
    return;
  }

  if (t.dataset.actId) {
    const d = mine.map(eff).find((x) => x.id === t.dataset.actId);
    if (!d) return;
    if (driverAction(d.status)?.cashCheck) return openDelivered(d);
    return startStep(d, e.detail === 0);
  }

  if (t.dataset.acceptId) {
    const d = available.find((x) => x.id === t.dataset.acceptId);
    if (d) openAccept(d);
    return;
  }

  if (t.dataset.selectId) {
    selectedId = t.dataset.selectId;
    localStorage.setItem(KEYS.current, selectedId);
    renderHome();
    renderBar();
    document.querySelector(`[data-select-id="${CSS.escape(selectedId)}"]`)?.focus();
    return;
  }

  if (t.dataset.ackCancel) {
    cancelSeen.add(t.dataset.ackCancel);
    saveSet(KEYS.cancelAck, cancelSeen);
    renderHome();
    goTo("jobs");
    return;
  }

  if (t.dataset.dismissId) {
    dismissed.add(t.dataset.dismissId);
    saveSet(KEYS.dismissed, dismissed);
    justDelivered = null;
    renderHome();
    return;
  }

  if (t.dataset.openRate) {
    const card = t.closest("[data-delivery-id]");
    const d = mine.find((x) => x.id === t.dataset.openRate);
    card.querySelector(".rq-rate-slot").innerHTML = starPicker(d);
    t.hidden = true;
    card.querySelector("[data-star]").focus();
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
    const send = box.querySelector("[data-send-rating]");
    send.hidden = false;
    send.disabled = false;
    return;
  }

  if (t.matches("[data-send-rating]")) {
    const box = t.closest("[data-rate-for]");
    const d = mine.find((x) => x.id === box.dataset.rateFor);
    t.disabled = true;
    t.textContent = "Sending…";
    const { error } = await submitRating(d.id, profile.id, d.requester_id, Number(box.dataset.value), "");
    if (error) {
      t.disabled = false;
      t.textContent = "Send rating";
      showSnack({ text: "Your rating didn't save. Check your signal and send it again.", iconName: "alert", tone: "bad", stay: 6000 });
      return;
    }
    ratingsMap.set(d.id, { rating: Number(box.dataset.value) });
    justDelivered = null;
    renderHome();
    renderHistory();
    showSnack({ text: "Thanks. Your rating was saved.", iconName: "check", stay: 3000 });
    return;
  }

  if (t.dataset.filter) {
    historyFilter = t.dataset.filter;
    renderHistory();
    return;
  }
  if (t.matches("[data-filter-reset]")) {
    historyFilter = "all";
    renderHistory();
  }
});

// ---------- Notifications ----------
function renderUnread() {
  const unread = notifications.filter((n) => !n.is_read).length;
  document.querySelectorAll("[data-open-notifs]").forEach((b) =>
    b.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications"),
  );
  document.querySelectorAll("[data-unread-text]").forEach((el) => (el.textContent = unread ? `${unread} unread` : ""));
}
function renderNotifs() {
  $("notifList").innerHTML = notifications.length
    ? notifications
        .map(
          (n) => `
        <li><button type="button" class="rq-notif${n.is_read ? "" : " is-unread"}" data-notif-id="${esc(n.id)}" data-delivery="${esc(n.delivery_id || "")}">
          <span class="rq-notif-dot" aria-hidden="true"></span>
          <span><span class="rq-sr">${n.is_read ? "" : "Unread. "}</span>${esc(n.message)}<br /><span class="rq-muted">${timeAgo(n.created_at)}</span></span>
        </button></li>`,
        )
        .join("")
    : `<li class="rq-empty"><p><strong>No notifications yet</strong></p><p class="rq-muted">New jobs near you and updates on your jobs show here.</p></li>`;
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
$("notifList").addEventListener("click", (e) => {
  const item = e.target.closest("[data-notif-id]");
  if (!item) return;
  if (item.classList.contains("is-unread")) {
    markNotificationRead(item.dataset.notifId).then(loadNotifications);
  }
  $("notifSheet").close();
  const id = item.dataset.delivery;
  const own = mine.find((x) => x.id === id);
  if (own && !HISTORY_STATUSES.includes(own.status)) {
    selectedId = own.id;
    goTo("home");
    renderHome();
  } else {
    goTo(own ? "history" : "jobs");
  }
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-delivery-id="${CSS.escape(id)}"], [data-offer-id="${CSS.escape(id)}"]`);
    card?.scrollIntoView({ block: "center" });
    card?.focus({ preventScroll: true });
  });
});

loadAll();
loadNotifications();
subscribeToNotifications(profile.id, () => {
  loadNotifications();
  loadAll();
});
