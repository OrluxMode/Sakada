import { sanitizeText } from "./sanitize.js";
import { supabase } from "./supabase-client.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  geocodeAddress,
  suggestPlaces,
  getDrivingRoute,
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
  driveTimeLabel,
  pickupPassed,
  shortPlace,
  bookingErrorCopy,
  parseTrackHash,
  trackHeadline,
  ratingSummary,
  PICKUP_WINDOWS,
  windowLabel,
  ymd,
  parseYmd,
  openWindows,
  dayChoices,
  bookDateLabel,
  monthCells,
} from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { enableSheetDrag } from "./sheet-drag.js";
import { paginate } from "./pagination.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";
import { attachPlaceSuggest } from "./place-suggest.js";
import { createPinMap } from "./pin-map.js";
import { createContactSheet, liftAboveKeyboard } from "./contact-sheet.js";
import { createProfilePages } from "./profile-pages.js";
import { paintAvatar } from "./avatar.js";
import { savedMatches, savedAsPlace, isSaved } from "./saved-addresses.js";
import { createProduceRows } from "./produce-rows.js";
import { createKgWheel } from "./kg-wheel.js";
import { t, useLanguage, translatePage, dateLocale, currentLanguage } from "./i18n.js";
import { createSettingsPages } from "./settings-pages.js";
import { shouldOffer, notNow, disableAlerts } from "./push.js";
import {
  checkAddress,
  checkPickupDate,
  checkNotes,
  checkTrackQuery,
  checkRecipient,
  localDateString,
} from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";

// One script serves both requester dashboards; the page says which role it's for.
const ROLE = document.body.dataset.role;
if (ROLE !== "farmer" && ROLE !== "vendor") {
  throw new Error(`requester-dashboard.js: unexpected data-role "${ROLE}"`);
}

const profile = await requireRole(ROLE, "../../auth/login.html", "../../index.html");
if (!profile) throw new Error("redirecting");
// The account's language (Profile → Language) before anything is drawn.
useLanguage(profile.language);
translatePage();

document.getElementById("pageLoader")?.classList.add("page-loader--hidden");
initOfflineDetection();
updateLastLogin();

const $ = (id) => document.getElementById(id);
/** Name, initials and photo wherever they show; again after Edit profile saves. */
function paintAccount() {
  const firstName = profile.full_name.split(" ")[0];
  document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = profile.full_name));
  document.querySelector(".rq-account")?.setAttribute("title", profile.full_name); // long names are cut off there
  document.querySelectorAll("[data-initials]").forEach((el) =>
    paintAvatar(el, { url: profile.avatar_url, initials: initialsFor(profile.full_name) }));
  // Greeting only: "yayan" reads as "Yayan". The saved name is left as typed.
  $("homeTitle").textContent = `${firstName.charAt(0).toLocaleUpperCase("en-PH")}${firstName.slice(1)}`;
}
paintAccount();
let accountEmail = "";
supabase.auth.getUser().then(({ data }) => {
  accountEmail = data?.user?.email || "";
  $("profileEmail").textContent = accountEmail;
  profilePages.setUser(data?.user || null);
});

// ---------- Tabs (hash sections in one page, so realtime stays connected) ----------
const VIEWS = ["home", "track", "book", "history", "profile"];
let viewsReady = false;
// The booking the Track page shows (#track/SK-00142), or null for the Track tab itself.
let trackCode = null;
// The page inside Profile: main, edit (#profile/edit) or addresses (#profile/addresses).
let profilePage = "main";
function showView(hash, { focus = false } = {}) {
  let view = hash;
  const track = parseTrackHash(hash);
  if (track) {
    view = "track";
    trackCode = track.code;
  }
  const inProfile = /^profile\/(edit|addresses|language|alerts)$/.exec(view);
  if (view === "profile" || inProfile) {
    const page = inProfile?.[1] || "main";
    const moved = page !== profilePage && document.body.dataset.view === "profile";
    view = "profile";
    showProfilePage(page, { animate: moved && viewsReady });
  }
  if (view === "deliveryForm") view = "book"; // the landing page's "Book a Delivery" link
  if (!VIEWS.includes(view)) view = "home";
  const changed = document.body.dataset.view !== view;
  document.body.dataset.view = view;
  if (view === "book" && changed && viewsReady && bookStep === 4 && isPhone()) {
    sentBooking = null;
    setStep(1, { focus: false });
  }
  // Moving inside Track (list -> one shipment) gets the same small entrance as a tab switch.
  if (view === "track") renderTrack({ animate: !changed && viewsReady });
  if (changed && viewsReady) enterView(view);
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (focus) {
    const heading = view === "profile"
      ? document.querySelector(`[data-profile-page="${profilePage}"] h1`)
      : $(`view-${view}`)?.querySelector("h1");
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

// ---------- Profile sheets (Figma 327:1289, 327:1474, 327:1583) ----------
// Log out asks first; Contact Support and How it works stay in the app.
$("signOutBtn").addEventListener("click", () => openSheet($("logoutSheet")));
$("logoutConfirm").addEventListener("click", async () => {
  await disableAlerts().catch(() => {}); // a shared phone stops getting this account's alerts
  signOut("../../index.html");
});
$("openHow").addEventListener("click", () => openSheet($("howSheet")));
const openContact = createContactSheet({
  sheet: $("contactSheet"),
  openSheet,
  profile,
  role: ROLE,
  email: () => accountEmail,
});
liftAboveKeyboard($("contactSheet"));
// Edit profile and Saved addresses: pages inside the Profile tab.
const profilePages = createProfilePages({
  profile,
  openSheet,
  closeSheet,
  initials: () => initialsFor(profile.full_name),
  onProfileChange: paintAccount,
  onSavedChange: () => {
    syncSaveLinks();
    addressSuggest.forEach((list) => list.refresh());
  },
  pinOnMap: (which) => openPinMap(which),
  isOffline: getIsOffline,
});
liftAboveKeyboard($("savedSheet"));
profilePages.loadSaved();
// Language and Phone alerts: pages inside the Profile tab too.
const settingsPages = createSettingsPages({ profile });
function showProfilePage(page, { animate = false } = {}) {
  if (page === "edit" && profilePage !== "edit") profilePages.openEdit();
  if (page === "alerts") settingsPages.refreshAlerts(); // permission may have changed in the browser
  profilePage = page;
  document.querySelectorAll("[data-profile-page]").forEach((el) => {
    el.hidden = el.dataset.profilePage !== page;
    if (!el.hidden && animate) enterView("profile");
  });
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-profile-back]")) return;
  // Back to Profile: the browser's Back when Profile is where they came from.
  if (history.state?.back) history.back();
  else goTo("profile");
});
// Profile rows link to #profile/edit and #profile/addresses; mark them so Back returns.
document.querySelectorAll('#view-profile a[href^="#profile/"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    goTo(a.getAttribute("href").slice(1));
    document.querySelector(`[data-profile-page="${profilePage}"] h1`)?.setAttribute("tabindex", "-1");
    document.querySelector(`[data-profile-page="${profilePage}"] h1`)?.focus({ preventScroll: true });
  });
});

// Profile's row, a shipment's "Something wrong?" link, the "driver accepted first" note.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-open-contact]");
  if (btn) openContact(btn.dataset.openContact || "");
});

// ---------- Book (Figma "Book —"): route & schedule → details → review → request sent ----------
const form = $("deliveryForm");
const bookView = $("view-book");
const confirmBtn = $("confirmBtn");
const messageEl = $("formMessage");
const inputs = {
  pickupAddress: $("pickupAddress"),
  dropoffAddress: $("dropoffAddress"),
  recipientName: $("recipientName"),
  goodsDescription: $("goodsDescription"),
  quantityKg: $("quantityKg"),
  notes: $("notes"),
};
const ROUTE_RULES = [
  [inputs.pickupAddress, (v) => checkAddress(v, "pickup")],
  [inputs.dropoffAddress, (v) => checkAddress(v, "drop-off")],
];
const DETAIL_RULES = [
  [inputs.recipientName, checkRecipient],
  [inputs.notes, checkNotes],
];
clearWhenFixed([...ROUTE_RULES, ...DETAIL_RULES]);

// "What are you shipping?": one row per produce, each kg from the wheel
// (Figma 345:2174). The rows fill the hidden goodsDescription and quantityKg.
const kgWheel = createKgWheel({ dialog: $("kgSheet"), openSheet, closeSheet });
const produceRows = createProduceRows({
  card: $("produceCard"),
  list: $("produceRows"),
  total: $("produceTotal"),
  error: $("produceError"),
  hint: $("produceHint"),
  goods: inputs.goodsDescription,
  kg: inputs.quantityKg,
  chooseKg: kgWheel.choose,
});

// Places suggested while typing an address. A picked place keeps its exact
// point, so the fare is worked out from the place they chose, not whatever
// a fresh lookup of the same words returns. Editing the field drops it.
const pickedPlaces = new Map(); // "pickup" | "dropoff" → { address, geo, pinned }
const addressInput = (which) => (which === "pickup" ? inputs.pickupAddress : inputs.dropoffAddress);
/** Put a chosen place (from the list or the map) in its field and remember its point. */
function usePlace(which, place, { pinned = false } = {}) {
  const input = addressInput(which);
  input.value = place.address.slice(0, input.maxLength);
  pickedPlaces.set(which, { address: input.value.trim(), geo: place.geo, pinned });
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
/** "Pinned on the map" shows while the field still says what was pinned. */
function syncPinned() {
  for (const which of ["pickup", "dropoff"]) {
    const picked = pickedPlaces.get(which);
    $(`${which}Pinned`).hidden = !(picked?.pinned && picked.address === addressInput(which).value.trim());
  }
}
/**
 * "Save this address" under a field that holds a place picked or pinned on
 * Book, when it isn't saved yet and there's room for another.
 */
function syncSaveLinks() {
  for (const which of ["pickup", "dropoff"]) {
    const picked = pickedPlaces.get(which);
    const btn = bookView.querySelector(`[data-save-place="${which}"]`);
    btn.hidden = !(picked && picked.address === addressInput(which).value.trim()
      && profilePages.canSave() && !isSaved(profilePages.saved(), picked));
  }
}
form.addEventListener("input", syncPinned);
form.addEventListener("input", syncSaveLinks);
bookView.addEventListener("click", (e) => {
  const b = e.target.closest("[data-save-place]");
  if (!b) return;
  const picked = pickedPlaces.get(b.dataset.savePlace);
  if (picked) profilePages.openSavedSheet({ prefill: { address: picked.address, geo: picked.geo } });
});
const addressSuggest = [];
for (const [which, input, next] of [
  ["pickup", inputs.pickupAddress, inputs.dropoffAddress],
  ["dropoff", inputs.dropoffAddress, null],
]) {
  addressSuggest.push(attachPlaceSuggest({
    input,
    row: input.closest(".rq-broute-row"),
    host: input.closest(".rq-broute"),
    search: suggestPlaces,
    canSearch: () => !getIsOffline(),
    saved: (text) => savedMatches(profilePages.saved(), text, text ? 3 : 10).map((r) => savedAsPlace(r, { matched: Boolean(text) })),
    onPick(place) {
      usePlace(which, place);
      if (next && !next.value.trim()) next.focus();
    },
    emptyAction: { label: t("Pin it on the map instead"), run: () => openPinMap(which) },
  }));
}

// --- Pin on the map: the pin stays put, the map moves under it ---
const mapSheet = $("mapSheet");
const pinMap = createPinMap({
  area: $("mapArea"),
  mapEl: $("pinMap"),
  addressEl: $("mapSpotAddress"),
  hintEl: $("mapSpotHint"),
  useBtn: $("useSpot"),
  locateBtn: $("mapLocate"),
  isOffline: getIsOffline,
});
let pinningFor = "pickup";
/** Where the map starts: this field's place, what's typed in it, the other address, or the user's location. */
async function pinStart(which) {
  const input = which === "saved" ? $("savedAddress") : addressInput(which);
  const text = input.value.trim();
  const own = which === "saved" ? profilePages.savedPicked() : pickedPlaces.get(which);
  if (own && own.address === text) return { at: own.geo, zoom: 17 };
  if (text.length >= 3 && !getIsOffline()) {
    try {
      return { at: await geocodeAddress(text), zoom: 16 };
    } catch {
      // not a place Mapbox knows: fall through
    }
  }
  const other = which === "saved" ? null : pickedPlaces.get(which === "pickup" ? "dropoff" : "pickup");
  if (other) return { at: other.geo, zoom: 12 };
  return { at: null };
}
async function openPinMap(which) {
  pinningFor = which;
  const pickup = which === "pickup";
  $("mapSheetTitle").textContent = t(which === "saved" ? "Pin the address" : pickup ? "Pin pickup location" : "Pin drop-off location");
  $("mapSpotLabel").textContent = t(which === "saved" ? "Address point" : pickup ? "Pickup point" : "Drop-off point");
  openSheet(mapSheet);
  const { at, zoom } = await pinStart(which);
  if (mapSheet.open) await pinMap.open(at, zoom);
}
bookView.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pin-for]");
  if (b) openPinMap(b.dataset.pinFor);
});
mapSheet.addEventListener("transitionend", (e) => {
  if (e.target === mapSheet && e.propertyName === "transform") pinMap.resize();
});
$("useSpot").addEventListener("click", async () => {
  const spot = pinMap.spot();
  if (!spot) return;
  await closeSheet(mapSheet);
  if (pinningFor === "saved") profilePages.setSavedSpot(spot);
  else usePlace(pinningFor, spot, { pinned: true });
});
/** True when every rule passes, without showing anything. */
const passes = (rules) => rules.every(([input, check]) => {
  const r = check(input.value);
  return !(typeof r === "string" ? r : r?.message);
});

// The pickup day (YYYY-MM-DD) and two-hour window. Tomorrow, 8–10 AM to start.
const pickup = { date: dayChoices()[0], window: PICKUP_WINDOWS[0].id };
let pendingQuote = null;
let bookStep = 1;
let sentBooking = null; // what the Request sent screen shows

const STEP_COPY = {
  1: ["Book shipment", "Book a shipment", "Route & schedule · 1 of 3"],
  2: ["Book shipment", "Shipment details", "Recipient & cargo · 2 of 3"],
  3: ["Review booking", "Check your booking", "Review your details · 3 of 3"],
  4: ["Booking request", "Request sent.", "Waiting for a driver to accept your booking."],
};

function showMessage(text) {
  // The message sits just above the step's main button, where the eye is.
  bookView.querySelector(`.rq-bstep[data-step="${bookStep}"] .rq-bbtn`)?.before(messageEl);
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
/** The furthest step the current answers allow (a Back/Forward can't skip a check). */
function reachableStep(n) {
  if (n === 4) return sentBooking ? 4 : 1;
  if (n >= 2 && !(passes(ROUTE_RULES) && !checkPickupDate(pickup.date) && windowOpen())) return 1;
  if (n >= 3 && !(passes(DETAIL_RULES) && produceRows.ok() && quoteFresh())) return 2;
  return n;
}
function setStep(n, { focus = true } = {}) {
  n = reachableStep(n);
  const changed = n !== bookStep;
  bookStep = n;
  bookView.dataset.step = String(n);
  bookView.querySelectorAll(".rq-bstep").forEach((el) => (el.hidden = Number(el.dataset.step) !== n));
  const [where, title, sub] = STEP_COPY[n];
  $("bookWhere").textContent = t(where);
  $("bookTitle").textContent = t(title);
  $("bookSub").textContent = t(sub);
  clearMessage();
  if (n === 3) renderReview();
  if (n === 4) {
    renderSent();
    offerAlerts();
  }
  if (changed && viewsReady) enterStep(n);
  if (!focus) return;
  $("bookTitle").setAttribute("tabindex", "-1");
  $("bookTitle").focus({ preventScroll: true });
  if (isPhone()) window.scrollTo({ top: 0 });
  else bookView.scrollIntoView({ block: "nearest" });
}
/**
 * A new step fades in while rising 6px, 180ms, like a tab switch; no slide
 * and no stagger, so typing is never delayed. Request sent only fades (the
 * booking code stays still). Reduced motion: a 120ms fade.
 */
function enterStep(n) {
  const els = [bookView.querySelector(".rq-book-title"), bookView.querySelector(`.rq-bstep[data-step="${n}"]`)];
  const fadeOnly = reduceMotion() || n === 4;
  for (const el of els) {
    el?.animate(
      fadeOnly ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: reduceMotion() ? 120 : 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
  }
}
/** Forward a step. On phones each step is a history entry, so the system Back goes back a step. */
function goStep(n) {
  if (isPhone()) history.pushState({ bookStep: n }, "", "#book");
  setStep(n);
}
window.addEventListener("popstate", (e) => {
  if (isPhone() && location.hash === "#book") setStep(e.state?.bookStep || 1, { focus: false });
});
$("bookBack").addEventListener("click", () => {
  if (bookStep === 4) return finishSent();
  if (bookStep === 1) return goTo("home");
  if (isPhone() && history.state?.bookStep === bookStep) history.back();
  else setStep(bookStep - 1);
});

// --- Step 1: route, day and time ---
function windowOpen(date = pickup.date, id = pickup.window) {
  return openWindows(date).some((w) => w.id === id);
}
const longDay = (value) => parseYmd(value).toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" });
function renderQuickDates() {
  $("quickDates").innerHTML = dayChoices().map((value) => {
    const d = parseYmd(value);
    return `<button type="button" class="rq-bday" data-pick-date="${value}" aria-label="${longDay(value)}" aria-pressed="false">
      <span>${d.toLocaleDateString(dateLocale(), { weekday: "short" })}</span><strong>${d.getDate()}</strong></button>`;
  }).join("");
  showPickup();
}
function showPickup() {
  $("pickupDateValue").textContent = bookDateLabel(pickup.date);
  $("pickupTimeValue").textContent = windowLabel(pickup.window);
  $("quickDates").querySelectorAll("[data-pick-date]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pickDate === pickup.date)));
}
function datePicked(value) {
  pickup.date = value;
  // A window that has already started today gives way to the next one still open.
  if (!windowOpen()) pickup.window = openWindows(value)[0]?.id || pickup.window;
  dateProblem("");
  showPickup();
}
function dateProblem(text) {
  $("pickupDateError").textContent = text;
  $("pickupDateError").hidden = !text;
}
$("quickDates").addEventListener("click", (e) => {
  const b = e.target.closest("[data-pick-date]");
  if (b) datePicked(b.dataset.pickDate);
});

function toDetails() {
  const routeOk = validateFields(ROUTE_RULES);
  let when = checkPickupDate(pickup.date);
  if (!when && !windowOpen()) when = t("That pickup time has passed. Pick a later time or day.");
  dateProblem(when);
  if (!routeOk) return;
  if (when) {
    $("openDate").focus();
    return;
  }
  goStep(2);
}
$("toDetails").addEventListener("click", toDetails);

// --- Step 2 → 3: the fare is worked out on the way to the review ---
const quoteFresh = () => pendingQuote && !isQuoteStale(pendingQuote, {
  pickupAddress: inputs.pickupAddress.value,
  dropoffAddress: inputs.dropoffAddress.value,
  quantityKg: inputs.quantityKg.value,
});
form.addEventListener("input", clearMessage);

function showBookingError(error) {
  const copy = bookingErrorCopy(error);
  if (copy.field === "pickup" || copy.field === "dropoff") {
    // An address Mapbox can't place is fixed on step 1, so go there and point at it.
    const input = copy.field === "pickup" ? inputs.pickupAddress : inputs.dropoffAddress;
    if (bookStep !== 1) setStep(1, { focus: false });
    showFieldError(input, copy.message);
    input.focus();
  } else {
    showMessage(copy.message);
  }
  if (copy.kind === "mismatch") pendingQuote = null;
}

async function geocodeLabelled(address, which) {
  const picked = pickedPlaces.get(which);
  if (picked?.address === address) return picked.geo;
  try {
    return await geocodeAddress(address);
  } catch (err) {
    err.which = which;
    throw err;
  }
}

async function toReview() {
  // Every problem shows; focus goes to the first from the top (recipient, produce, notes).
  const produceOk = produceRows.validate({ focus: false });
  const fieldsOk = validateFields(DETAIL_RULES);
  if (!produceOk && !checkRecipient(inputs.recipientName.value)) produceRows.validate();
  if (!produceOk || !fieldsOk) return;
  if (quoteFresh()) return goStep(3);
  if (getIsOffline()) return showMessage(t("No connection. Check your signal and try again. Your details are still here."));
  const btn = $("toReview");
  clearMessage();
  setBusy(btn, true, t("Getting the fare…"));
  try {
    const pickupAddress = inputs.pickupAddress.value.trim();
    const dropoffAddress = inputs.dropoffAddress.value.trim();
    const quantityKg = parseFloat(inputs.quantityKg.value);
    const [from, to] = await Promise.all([
      geocodeLabelled(pickupAddress, "pickup"),
      geocodeLabelled(dropoffAddress, "dropoff"),
    ]);
    const { distanceKm, minutes } = await getDrivingRoute(from, to);
    pendingQuote = { pickupAddress, dropoffAddress, pickup: from, dropoff: to, distanceKm, minutes, quantityKg, cost: estimateCost(distanceKm, quantityKg) };
    goStep(3);
  } catch (err) {
    showBookingError(err);
  } finally {
    setBusy(btn, false, t("Review booking"));
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault(); // Enter in a field moves the step it's on forward
  if (bookStep === 1) toDetails();
  else if (bookStep === 2) toReview();
});

// --- Step 3: the ticket ---
const NOTCHES = `<img class="rq-notch rq-notch--l" src="../../assets/icons/book/notch.svg" width="18" height="18" alt="" /><img class="rq-notch rq-notch--r" src="../../assets/icons/book/notch.svg" width="18" height="18" alt="" />`;
const cityOf = (geo, address) => geo?.city || shortPlace(address);
function ticketRoute(from, to, places = []) {
  const stop = (label, city, place) => `
    <div class="rq-ticket-stop">
      <p class="rq-ticket-label">${label}</p>
      <p class="rq-ticket-city">${esc(city)}</p>
      ${place ? `<p class="rq-ticket-place">${esc(place)}</p>` : ""}
    </div>`;
  return `<div class="rq-ticket-pair">${stop(t("Pickup"), from, places[0])}${stop(t("Drop-off"), to, places[1])}</div>`;
}
// "About 2 h 30 min drive" never breaks inside; a narrow line breaks at the "·" instead.
const keepUnits = (text) => text.replaceAll(" ", "\u00a0");
function ticketDrive(q) {
  const drive = driveTimeLabel(q.minutes);
  return `<p class="rq-ticket-drive">${Math.round(q.distanceKm).toLocaleString("en-PH")}&nbsp;km by road${drive ? ` · ${esc(keepUnits(drive))}` : ""}</p>`;
}
const ticketWhen = (date, window) => `
  <div class="rq-ticket-pair">
    <div><p class="rq-ticket-label">${t("Pickup date")}</p><p class="rq-ticket-value">${esc(bookDateLabel(date))}</p></div>
    <div><p class="rq-ticket-label">${t("Pickup time")}</p><p class="rq-ticket-value">${esc(windowLabel(window))}</p></div>
  </div>`;
/** One produce: its name (the weight sits beside it). Several: a line each with its kg. */
function reviewGoods() {
  const items = produceRows.items();
  if (items.length === 1) return esc(items[0].name);
  return items.map((r) => `${esc(r.name)}&nbsp;·&nbsp;${r.kg.toLocaleString("en-PH")}&nbsp;kg`).join("<br />");
}
function renderReview() {
  const q = pendingQuote;
  if (!q) return;
  const notes = inputs.notes.value.trim();
  $("reviewTicket").innerHTML = `
    ${ticketRoute(cityOf(q.pickup, q.pickupAddress), cityOf(q.dropoff, q.dropoffAddress), [q.pickup.placeName, q.dropoff.placeName])}
    ${ticketDrive(q)}
    ${ticketWhen(pickup.date, pickup.window)}
    <div class="rq-ticket-cut" aria-hidden="true">${NOTCHES}</div>
    <div><p class="rq-ticket-label">${t("Recipient")}</p><p class="rq-ticket-name">${esc(inputs.recipientName.value.trim())}</p></div>
    <div class="rq-ticket-pair rq-ticket-pair--load">
      <div><p class="rq-ticket-label">${t("What you're shipping")}</p><p class="rq-ticket-value">${reviewGoods()}</p></div>
      <div><p class="rq-ticket-label">${t("Total weight")}</p><p class="rq-ticket-value">${q.quantityKg.toLocaleString("en-PH")}&nbsp;kg</p></div>
    </div>
    ${notes ? `<div><p class="rq-ticket-label">${t("Notes for the driver")}</p><p class="rq-ticket-notes">${esc(notes)}</p></div>` : ""}
    <div class="rq-ticket-rule" aria-hidden="true"></div>
    <div class="rq-ticket-fare">
      <div><p class="rq-ticket-value">${t("Estimated fare")}</p><p class="rq-ticket-label">${t("Cash at drop-off")}</p></div>
      <p class="rq-ticket-amount">${formatPeso(q.cost)}</p>
    </div>
    <p class="rq-ticket-formula">${esc(fareBreakdown(q.distanceKm, q.quantityKg))}</p>`;
}

confirmBtn.addEventListener("click", async () => {
  if (!quoteFresh() || !passes(DETAIL_RULES)) return setStep(2);
  if (!windowOpen() || checkPickupDate(pickup.date)) {
    setStep(1, { focus: false });
    dateProblem(t("That pickup time has passed. Pick a later time or day."));
    return $("openDate").focus();
  }
  if (getIsOffline()) return showMessage(t("No connection. Check your signal and try again. Your details are still here."));
  const q = pendingQuote;
  const booking = {
    requester_id: profile.id,
    pickup_address: q.pickupAddress,
    pickup_lat: q.pickup.lat,
    pickup_lng: q.pickup.lng,
    dropoff_address: q.dropoffAddress,
    dropoff_lat: q.dropoff.lat,
    dropoff_lng: q.dropoff.lng,
    recipient_name: inputs.recipientName.value.trim(),
    goods_description: inputs.goodsDescription.value.trim(),
    quantity_kg: q.quantityKg,
    scheduled_pickup_at: new Date(pickup.date).toISOString(),
    pickup_window: pickup.window,
    notes: inputs.notes.value.trim() || null,
    estimated_cost: q.cost,
    distance_km: q.distanceKm,
  };
  clearMessage();
  setBusy(confirmBtn, true, t("Sending request…"));
  let result;
  try {
    result = await createDelivery(booking);
  } catch (err) {
    result = { error: err };
  }
  setBusy(confirmBtn, false, t("Request booking"));
  if (result.error) return showBookingError(result.error);

  sentBooking = {
    ...booking,
    ...result.data,
    date: pickup.date,
    from: cityOf(q.pickup, q.pickupAddress),
    to: cityOf(q.dropoff, q.dropoffAddress),
  };
  form.reset();
  produceRows.clear();
  pendingQuote = null;
  pickup.date = dayChoices()[0];
  pickup.window = PICKUP_WINDOWS[0].id;
  showPickup();
  highlightId = result.data?.id || null;
  // Request sent replaces the review in history, so Back can't land on a sent form.
  if (isPhone()) history.replaceState({ bookStep: 4 }, "", "#book");
  setStep(4);
  await loadDeliveries();
});

// --- Request sent ---
const sentStatus = (status) => `<span class="rq-sdot" data-status="${esc(status)}"></span>${esc(STATUS_WORD[status] ? t(STATUS_WORD[status]) : statusLabel(status))}`;
function renderSent() {
  const b = sentBooking;
  if (!b) return;
  const live = deliveries.find((d) => d.id === b.id) || b;
  const status = live.status || "pending";
  const kg = b.quantity_kg != null ? ` · ${Number(b.quantity_kg).toLocaleString("en-PH")}&nbsp;kg` : "";
  $("bookSent").innerHTML = `
    <div class="rq-bcard rq-bcode">
      <p class="rq-bcode-label">${t("Booking code")}</p>
      <p class="rq-bcode-value">${esc(live.delivery_code || "")}</p>
      <button type="button" class="rq-copy" id="copyCode">
        <span class="rq-copy-face"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>${t("Copy code")}</span>
        <span class="rq-copy-face rq-copy-face--done" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8 5.2-6"/></svg>${t("Copied")}</span>
      </button>
      <p class="rq-bcode-note">${t("Share it with the recipient, or use it to track and contact support.")}</p>
      <p class="rq-sr" role="status" id="copyStatus"></p>
      ${NOTCHES}
    </div>
    <div class="rq-bcard rq-ticket">
      ${ticketRoute(b.from, b.to)}
      ${ticketWhen(b.date, b.pickup_window)}
      <div class="rq-ticket-rule" aria-hidden="true"></div>
      <p class="rq-ticket-value">${esc(b.recipient_name)} · ${esc(b.goods_description)}${kg}</p>
    </div>
    <p class="rq-bstatus" id="sentStatus" data-status="${esc(status)}" aria-live="polite">${sentStatus(status)}</p>
    <div id="alertsOffer"></div>
    <button class="rq-btn rq-bbtn" type="button" id="sentTrack">${t("Track this shipment")}</button>
    <button class="rq-btn rq-bbtn rq-btn--ghost" type="button" id="sentDone">${t(isPhone() ? "Back to Home" : "Book another shipment")}</button>`;
}
/**
 * Offer phone alerts once, under "Waiting for a driver" (Figma 350:2792):
 * the moment people want to know when it's accepted. "Not now" rests it two weeks.
 */
const BELL = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>`;
async function offerAlerts() {
  const box = $("alertsOffer");
  if (!box || !(await shouldOffer())) return;
  box.innerHTML = `
    <div class="rq-offer">
      <div class="rq-offer-top">${BELL}<p><strong>${t("Get a phone alert when a driver accepts")}</strong><span>${t("Also when it's picked up and delivered, even with Sakada closed.")}</span></p></div>
      <div class="rq-offer-actions">
        <button type="button" class="rq-offer-on" data-alerts-on>${t("Turn on alerts")}</button>
        <button type="button" class="rq-offer-later" data-alerts-later>${t("Not now")}</button>
      </div>
    </div>`;
  if (!reduceMotion()) box.firstElementChild.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
}
function closeOffer(text) {
  const box = $("alertsOffer");
  if (!box) return;
  if (text) {
    box.innerHTML = `<p class="rq-offer-done" role="status">${text}</p>`;
    return;
  }
  const card = box.firstElementChild;
  const done = () => (box.innerHTML = "");
  if (!card || reduceMotion()) return done();
  card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }).finished.then(done, done);
}
$("bookSent").addEventListener("click", async (e) => {
  if (e.target.closest("[data-alerts-later]")) {
    notNow();
    closeOffer();
  } else if (e.target.closest("[data-alerts-on]")) {
    e.target.closest("[data-alerts-on]").disabled = true;
    const state = await settingsPages.turnOnAlerts();
    if (state === "on") closeOffer(t("Phone alerts are on. Change it any time in Profile."));
    else if (state === "blocked") closeOffer(t("Alerts are blocked in this browser. See Profile → Phone alerts."));
    else closeOffer();
  }
});

/** A driver can accept while Request sent is still open: only the status line changes. */
function refreshSent() {
  const el = $("sentStatus");
  const live = sentBooking && deliveries.find((d) => d.id === sentBooking.id);
  if (!el || !live || el.dataset.status === live.status) return;
  el.dataset.status = live.status;
  el.innerHTML = sentStatus(live.status);
}
function finishSent() {
  sentBooking = null;
  setStep(1, { focus: !isPhone() });
  if (isPhone()) goTo("home");
}
/** Open the booking just sent on Track (desktop's Book panel starts a new booking). */
function trackSent() {
  const id = sentBooking?.id;
  const code = (deliveries.find((d) => d.id === id) || sentBooking)?.delivery_code;
  if (!isPhone()) {
    sentBooking = null;
    setStep(1, { focus: false });
  }
  if (deliveries.some((d) => d.id === id)) openTrack(id);
  else if (code) goTo(`track/${encodeURIComponent(code)}`);
}

// Copy code: the button reads "Copied" for 2 seconds (Figma 328:1536).
let copiedTimer = 0;
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard API (plain http on a phone, older browsers): select and copy.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
async function copyCode(btn) {
  const code = btn.closest(".rq-bcode").querySelector(".rq-bcode-value").textContent.trim();
  if (!code) return;
  if (!(await copyText(code))) {
    toastError(t("Couldn't copy. Press and hold the code to copy it."));
    return;
  }
  btn.dataset.copied = "";
  $("copyStatus").textContent = t("Booking code {code} copied", { code });
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    delete btn.dataset.copied;
    const status = $("copyStatus");
    if (status) status.textContent = "";
  }, 2000);
}

$("bookSent").addEventListener("click", (e) => {
  if (e.target.closest("#sentDone")) finishSent();
  else if (e.target.closest("#sentTrack")) trackSent();
  else {
    const copy = e.target.closest("#copyCode");
    if (copy) copyCode(copy);
  }
});

// --- Date and time sheets (keep the choice only on "Use …") ---
let calMonth = null;
let draftDate = null;
const MONTHS_AHEAD = 2; // this month and the next two
function calBounds() {
  const now = new Date();
  return { first: new Date(now.getFullYear(), now.getMonth(), 1), last: new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, 1) };
}
function dayOpen(value) {
  return !checkPickupDate(value) && openWindows(value).length > 0;
}
function renderCal() {
  const { first, last } = calBounds();
  const today = ymd(new Date());
  $("calMonth").textContent = calMonth.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" });
  $("calPrev").disabled = calMonth <= first;
  $("calNext").disabled = calMonth >= last;
  $("calGrid").innerHTML = monthCells(calMonth.getFullYear(), calMonth.getMonth()).map((value) => {
    if (!value) return `<span class="rq-cal-blank"></span>`;
    const off = !dayOpen(value);
    return `<button type="button" class="rq-cal-day" data-cal-date="${value}" aria-label="${longDay(value)}" aria-pressed="${value === draftDate}"${value === today ? ' aria-current="date"' : ""}${off ? " disabled" : ""}>${parseYmd(value).getDate()}</button>`;
  }).join("");
  $("dateSheetValue").textContent = bookDateLabel(draftDate);
}
$("openDate").addEventListener("click", () => {
  draftDate = pickup.date;
  const d = parseYmd(draftDate);
  calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  renderCal();
  openSheet($("dateSheet"));
});
$("calPrev").addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  renderCal();
});
$("calNext").addEventListener("click", () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  renderCal();
});
$("calGrid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cal-date]");
  if (!b || b.disabled) return;
  draftDate = b.dataset.calDate;
  $("calGrid").querySelectorAll("[data-cal-date]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  $("dateSheetValue").textContent = bookDateLabel(draftDate);
});
$("useDate").addEventListener("click", () => {
  if (dayOpen(draftDate)) datePicked(draftDate);
  closeSheet($("dateSheet"));
});

let draftWindow = null;
function renderWindows() {
  const open = openWindows(pickup.date).map((w) => w.id);
  $("timeWindows").innerHTML = PICKUP_WINDOWS.map((w) => `
    <button type="button" class="rq-window" data-window="${w.id}" aria-pressed="${w.id === draftWindow}"${open.includes(w.id) ? "" : " disabled"}>
      <span>${w.label}</span><img src="../../assets/icons/book/check-amber.svg" width="16.4167" height="16.4167" alt="" />
    </button>`).join("");
  $("timeSheetValue").textContent = windowLabel(draftWindow);
  const note = $("timeSheetNote");
  note.hidden = open.length === PICKUP_WINDOWS.length;
  note.textContent = t("Earlier times today have passed.");
}
$("openTime").addEventListener("click", () => {
  draftWindow = pickup.window;
  renderWindows();
  openSheet($("timeSheet"));
});
$("timeWindows").addEventListener("click", (e) => {
  const b = e.target.closest("[data-window]");
  if (!b || b.disabled) return;
  draftWindow = b.dataset.window;
  $("timeWindows").querySelectorAll("[data-window]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  $("timeSheetValue").textContent = windowLabel(draftWindow);
});
$("useTime").addEventListener("click", () => {
  if (windowOpen(pickup.date, draftWindow)) {
    pickup.window = draftWindow;
    dateProblem("");
    showPickup();
  }
  closeSheet($("timeSheet"));
});
renderQuickDates();

// ---------- Rendering ----------
let deliveries = [];
let driversById = new Map();
let ratingsMap = new Map();
let highlightId = null;
let historyFilter = "all";
let historyPage = 1;
const activeSubscriptions = new Map();


const esc = (v) => sanitizeText(v == null ? "" : String(v));
// Dates in Filipino read "Okt 22"; English and Taglish keep "Oct 22".
const dayLocale = () => (currentLanguage() === "fil" ? "fil-PH" : "en-PH");
const day = (iso) =>
  new Date(iso).toLocaleDateString(dayLocale(), { month: "short", day: "numeric" });
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
    ? `<span class="rq-fare-amount rq-fare-amount--none">${t("Fare not set")}</span>`
    : `<span class="rq-fare-amount">${formatPeso(d.estimated_cost)}</span>`;
}
function metaLine(d) {
  const bits = [esc(d.delivery_code)];
  if (d.status === "pending") {
    if (d.scheduled_pickup_at) bits.push(t("Pickup {day}", { day: day(d.scheduled_pickup_at) }));
    bits.push(t("Requested {time}", { time: time(d.created_at) }));
  } else if (HISTORY_STATUSES.includes(d.status)) {
    bits.push(day(d.updated_at));
  } else if (d.scheduled_pickup_at) {
    bits.push(t("Pickup {day}", { day: day(d.scheduled_pickup_at) }));
  }
  return bits.join(" · ");
}
const firstNameOf = (d, fallback) => driversById.get(d.id)?.driver_name?.split(" ")[0] || fallback;
function starPicker(d) {
  return `
    <div class="rq-rate" data-rate-for="${esc(d.id)}">
      <p class="rq-rate-q">${t("How was {name}?", { name: esc(firstNameOf(d, t("your driver"))) })}</p>
      <div class="rq-stars" role="radiogroup" aria-label="${t("Rating")}">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${t(n > 1 ? "{n} stars" : "{n} star", { n })}" data-star="${n}"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}
      </div>
      <label class="rq-sr" for="comment-${esc(d.id)}">${t("Comment (optional)")}</label>
      <textarea id="comment-${esc(d.id)}" rows="2" maxlength="500" placeholder="${t("Add a comment (optional)")}"></textarea>
      <button type="button" class="rq-btn" data-send-rating disabled>${t("Send rating")}</button>
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
  const when = isToday(at) ? t("today, {time}", { time: time(at) }) : `${day(at)}, ${time(at)}`;
  const since = isToday(at) ? time(at) : day(at);
  if (d.status === "pending") {
    if (pickupPassed(d)) return `<span class="rq-chip">${t("Pickup date passed · drivers can't see it")}</span>`;
    return isToday(d.created_at) ? t("Requested today, {time}", { time: time(d.created_at) }) : t("Requested {day}", { day: day(d.created_at) });
  }
  if (d.status === "driver_assigned") return `${t("Accepted {when}", { when: since })} · ${keep(t("Next: Picked up"))}`;
  if (d.status === "picked_up") return `${t(isToday(at) ? "Picked up at {when}" : "Picked up on {when}", { when: since })} · ${keep(t("Next: In transit"))}`;
  if (d.status === "in_transit") return `${t("In transit since {when}", { when: since })} · ${keep(t("Next: Delivered"))}`;
  if (d.status === "delivered") return t("Delivered {when}", { when });
  return t("Cancelled {day}", { day: day(at) });
}

/** Bottom-left of a shipment card: a small label and the one fact that matters now. */
function shipmentFact(d) {
  const at = d.status_changed_at || d.updated_at;
  const when = isToday(at) ? time(at) : day(at);
  if (pickupPassed(d)) return [t("Pickup date passed"), t("Book a new date")];
  if (d.status === "in_transit") return [t("In transit"), t("Since {when}", { when })];
  if (d.status === "picked_up") return [t("Picked up"), t(isToday(at) ? "At {when}" : "On {when}", { when })];
  const label = d.status === "pending" ? t("Waiting for a driver") : t("{name} picks up", { name: driversById.get(d.id)?.driver_name?.split(" ")[0] || t("Driver") });
  return [label, d.scheduled_pickup_at ? t("Pickup {day}", { day: day(d.scheduled_pickup_at) }) : t("Pickup date not set")];
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
  $("statusTiles").innerHTML = tile("waiting", t("Waiting")) + tile("road", t("On the road")) + tile("delivered", t("Delivered"));
}

// ---------- Real maps on the shipment cards ----------
// The road between pickup and drop-off never changes, so each booking's
// route (and its drive time) is fetched once and kept for the session.
const routeLines = new Map();
const driveMins = new Map();
const routeLoading = new Set();
const ROUTE_KEY = (id) => `sakada.route.${id}`;
const DRIVE_KEY = (id) => `sakada.drive.${id}`;
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
/** Minutes of driving, null when Mapbox had none, undefined when not fetched yet. */
function cachedMinutes(id) {
  if (!driveMins.has(id)) {
    try {
      const saved = sessionStorage.getItem(DRIVE_KEY(id));
      if (saved !== null) driveMins.set(id, saved ? Number(saved) : null);
    } catch { /* private mode: fetch again next time */ }
  }
  return driveMins.get(id);
}
function needsRoute(d) {
  const line = cachedLine(d.id);
  return (line === null && !routeLines.has(d.id)) || cachedMinutes(d.id) === undefined;
}
function shipMapUrl(d) {
  return routeMapUrl({
    pickup: { lat: d.pickup_lat, lng: d.pickup_lng },
    dropoff: { lat: d.dropoff_lat, lng: d.dropoff_lng },
    truck: truckAt(d),
    line: cachedLine(d.id),
  });
}
/** Fetch the road for cards that don't have it yet, then redraw just their maps and drive time. */
function loadRouteLines(list) {
  list.filter((d) => hasCoords(d) && !routeLoading.has(d.id) && needsRoute(d)).forEach((d) => {
    routeLoading.add(d.id);
    getRouteLine({ lat: d.pickup_lat, lng: d.pickup_lng }, { lat: d.dropoff_lat, lng: d.dropoff_lng })
      .then(({ line, minutes }) => {
        const had = routeLines.get(d.id);
        routeLines.set(d.id, line);
        driveMins.set(d.id, minutes);
        try {
          sessionStorage.setItem(ROUTE_KEY(d.id), line || "");
          sessionStorage.setItem(DRIVE_KEY(d.id), minutes ?? "");
        } catch { /* fine */ }
        showDrive(d.id);
        if (!line || line === had) return;
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
  const where = t("{from} to {to}", { from: esc(shortPlace(d.pickup_address)), to: esc(shortPlace(d.dropoff_address)) });
  const status = esc(STATUS_WORD[d.status] ? t(STATUS_WORD[d.status]) : statusLabel(d.status));
  return `
    <article class="rq-card rq-ship${map ? " has-map" : ""}${late ? " is-late" : ""}${d.id === highlightId ? " rq-card--new" : ""}" data-delivery-id="${esc(d.id)}" tabindex="-1"${all.length > 1 ? ` aria-roledescription="slide" aria-label="${t("{n} of {total}", { n: i + 1, total: all.length })}"` : ""}>
      <p class="rq-ship-what">${esc(d.delivery_code)} · ${titleLine(d)}</p>
      <div class="rq-ship-ends">
        <p><span class="rq-ship-label">${t("From")}</span>${esc(shortPlace(d.pickup_address))}</p>
        <p><span class="rq-ship-label">${t("To")}</span>${esc(shortPlace(d.dropoff_address))}</p>
      </div>
      ${map ? `<figure class="rq-ship-map"><img id="shipmap-${esc(d.id)}" class="rq-ship-map-img is-loading" src="${shipMapUrl(d)}" alt="${t(truckAt(d) ? "Map of the road from {where}, with the truck where it is now." : "Map of the road from {where}.", { where })} ${status}." width="600" height="300" loading="lazy" decoding="async" /></figure>` : ""}
      <div class="rq-ship-route" style="--p: ${p}" role="img" aria-label="${t("Step {n} of 5, {status}", { n: step + 1, status })}">
        <span class="rq-ship-fill"></span>
        <span class="rq-ship-truck">${TRUCK}</span>
      </div>
      <div class="rq-ship-foot">
        <p><span class="rq-ship-label">${esc(label)}</span><strong class="rq-ship-value">${esc(value)}</strong></p>
        <button type="button" class="rq-pill" data-details="${esc(d.id)}">${t("View details")}</button>
      </div>
    </article>`;
}

function firstVisit() {
  return `
    <div class="rq-card rq-empty">
      <h2 class="rq-display">${t("No deliveries yet")}</h2>
      <p>${t("Book your first truck. You see the fare before you confirm: ₱150 base + ₱15 per km + ₱2 per kg, tolls included.")}</p>
      <ol class="rq-steps">
        <li>${t("A driver accepts your booking")}</li>
        <li>${t("They pick up your goods")}</li>
        <li>${t("You follow it to drop-off, where whoever receives the goods pays the driver in cash")}</li>
      </ol>
      <a class="rq-btn" href="#book">${t("Book a truck")}</a>
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
            <h2 class="rq-section-title" id="shipTitle">${t(many ? "Active shipments" : "Active shipment")}</h2>
            ${many ? `<p class="rq-ship-pos" id="shipPos" aria-hidden="true">${t("{n} of {total}", { n: 1, total: ordered.length })}</p>` : ""}
          </div>
          <div class="rq-ships${many ? " is-many" : ""}" id="shipList"${many ? ` role="region" aria-roledescription="carousel" aria-label="${t("Active shipments, swipe for more")}" tabindex="0"` : ""}>
            ${ordered.map(shipmentCard).join("")}
          </div>
          ${many ? `<div class="rq-dots" id="shipDots">${ordered.map((d, i) => `<button type="button" class="rq-dot" data-ship-dot="${i}" aria-label="${t("Show {code}", { code: esc(d.delivery_code) })}"${i === 0 ? ` aria-current="true"` : ""}></button>`).join("")}</div>` : ""}
        </section>`
      : `<section class="rq-section" aria-labelledby="shipTitle">
          <h2 class="rq-section-title" id="shipTitle">${t("Active shipment")}</h2>
          <div class="rq-card rq-empty"><p><strong>${t("Nothing on the road right now.")}</strong></p><p class="rq-muted">${t("Your past deliveries are in History.")}</p><a class="rq-btn" href="#book">${t("Book a truck")}</a></div>
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
  if (pos) pos.textContent = t("{n} of {total}", { n: i + 1, total: shipCards().length });
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
      ${back ? `<button type="button" class="rq-back" data-track-back aria-label="${t("Back")}">${BACK}</button>` : ""}
      <p class="rq-track-where">${t(title)}</p>
      <p class="rq-track-logo" aria-hidden="true">SAKA<span>DA</span></p>
    </div>`;
}
/** Two-line headline; the lines are translated together so word order can change. */
function trackHead([one, two]) {
  const [a, b = ""] = t(`${one}\n${two}`).split("\n");
  return `<h1 id="trackTitle" class="rq-track-head" tabindex="-1">${esc(a)}<br /><span>${esc(b)}</span></h1>`;
}

function trackDriver(d) {
  const row = driversById.get(d.id);
  const truck = truckAt(d);
  const showMap = hasCoords(d) && !HISTORY_STATUSES.includes(d.status);
  const first = firstNameOf(d, t("the driver"));
  let note = "";
  if (d.status === "driver_assigned") note = t("The truck shows on the map once {name} picks up your goods.", { name: esc(first) });
  else if (ON_ROAD(d) && !truck) note = t("Location not shared yet. You'll see the truck once the driver starts sharing.");
  if (!row?.driver_name && !showMap && !note) return "";
  let who = "";
  if (row?.driver_name) {
    const vehicle = [row.vehicle_type, row.vehicle_plate && t("Plate {plate}", { plate: row.vehicle_plate })].filter(Boolean).map(esc).join(" · ");
    const rating = ratingSummary(row);
    who = `
      <div class="rq-tdriver">
        <span class="rq-avatar" aria-hidden="true">${esc(initialsFor(row.driver_name))}</span>
        <p class="rq-tdriver-who">
          <span class="rq-tlabel">${t("Driver")}</span>
          <span class="rq-tdriver-name">${esc(row.driver_name)}</span>
          <span class="rq-tdriver-car">${vehicle || t("Vehicle not added yet")}</span>
        </p>
        ${rating ? `<p class="rq-trating">${rating.avg
          ? `<span class="rq-trating-avg" aria-label="${t("Rated {avg} out of 5", { avg: rating.avg })}">${STAR}${rating.avg}</span><span class="rq-trating-count">${rating.label}</span>`
          : `<span class="rq-trating-avg">${t("New driver")}</span><span class="rq-trating-count">${rating.label}</span>`}</p>` : ""}
      </div>`;
  }
  const where = t("{from} to {to}", { from: esc(shortPlace(d.pickup_address)), to: esc(shortPlace(d.dropoff_address)) });
  // The caption says how old the truck's position is, on the map itself.
  const map = showMap ? `
    <figure class="rq-track-map">
      <img id="trackmap-${esc(d.id)}" class="rq-ship-map-img is-loading" src="${shipMapUrl(d)}" alt="${t(truck ? "Map of the road from {where}, with the truck where it is now." : "Map of the road from {where}.", { where })}" width="600" height="300" decoding="async" />
      <figcaption id="track-caption-${esc(d.id)}">${truck ? t("Truck here {ago}", { ago: timeAgo(d.updated_at) }) : t("Route")}</figcaption>
    </figure>` : "";
  return `<div class="rq-tcard rq-tcard--flush">${who}${map}${note ? `<p class="rq-track-note">${note}</p>` : ""}</div>`;
}

function trackRate(d) {
  if (d.status !== "delivered" || !d.driver_id) return "";
  const first = firstNameOf(d, t("the driver"));
  const rated = ratingsMap.get(d.id);
  if (rated) return `<div class="rq-tcard"><p class="rq-rated" tabindex="-1">${t("You rated {name} {n} of 5.", { name: esc(first), n: rated.rating })}</p></div>`;
  // Only promise the average once the server really shows one (0023).
  const shown = ratingSummary(driversById.get(d.id));
  return `
    <div class="rq-tcard">
      ${starPicker(d)}
      ${shown ? `<p class="rq-track-small">${t("Your rating is added to {name}'s average that other farmers and vendors see.", { name: esc(first) })}</p>` : ""}
    </div>`;
}

/** The Track page's "· About 2 h drive", filled in place when Mapbox answers. */
function driveSpan(d, sep) {
  const drive = driveTimeLabel(cachedMinutes(d.id));
  return `<span data-drive="${esc(d.id)}"${sep ? " data-sep" : ""}>${drive ? `${sep ? " · " : ""}${esc(keepUnits(drive))}` : ""}</span>`;
}
function showDrive(id) {
  const span = document.querySelector(`[data-drive="${CSS.escape(id)}"]`);
  const drive = driveTimeLabel(cachedMinutes(id));
  if (span && drive) span.textContent = `${span.hasAttribute("data-sep") ? " · " : ""}${keepUnits(drive)}`;
}

function trackRoute(d) {
  const facts = [];
  if (d.scheduled_pickup_at) {
    const window = windowLabel(d.pickup_window);
    facts.push(`${t("Pickup {day}", { day: keep(day(d.scheduled_pickup_at)) })}${window ? `, ${keep(window)}` : ""}`);
  }
  if (d.distance_km != null) facts.push(t("{km}&nbsp;km by road", { km: Math.round(Number(d.distance_km)).toLocaleString("en-PH") }));
  return `
    <div class="rq-tcard">
      <div class="rq-track-route-head">
        <h2>${t("Route")}</h2>
        <span class="rq-lock">${LOCK}${t("Can't be changed")}</span>
      </div>
      <div class="rq-route rq-route--stops">
        <p class="rq-stop rq-stop--from"><span class="rq-muted">${t("Pickup")}</span><br />${esc(d.pickup_address)}</p>
        <p class="rq-stop rq-stop--to"><span class="rq-muted">${t("Drop-off")}</span><br />${esc(d.dropoff_address)}</p>
      </div>
      ${facts.length || hasCoords(d) ? `<p class="rq-track-small">${facts.join(" · ")}${driveSpan(d, facts.length > 0)}</p>` : ""}
    </div>`;
}

function trackDetail(d, { back }) {
  const late = pickupPassed(d);
  let note = "";
  if (d.status === "pending") {
    note = t(late
      ? "The pickup date has passed, so drivers can't see this request anymore. Book it again with a new date."
      : "Drivers can see your request now. You can cancel until one accepts.");
  }
  let actions = "";
  if (d.status === "pending") {
    actions = `
      ${late ? `<button type="button" class="rq-btn" data-new-date="${esc(d.id)}">${t("Book a new date")}</button>` : ""}
      <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">${t("Cancel request")}</button>`;
  } else if (HISTORY_STATUSES.includes(d.status)) {
    actions = `<button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">${t("Book again")}</button>`;
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
      <p class="rq-track-small">${t("Fare for this trip · tolls included")}</p>
      <p>${d.recipient_name
        ? t("{name} pays the driver this amount in cash at drop-off.", { name: esc(d.recipient_name) })
        : t("Whoever receives the goods pays the driver this amount in cash at drop-off.")}</p>
    </div>
    ${actions ? `<div class="rq-track-actions">${actions}</div>` : ""}
    <button type="button" class="rq-track-help" data-open-contact="${esc(d.delivery_code)}" aria-haspopup="dialog">${t("Something wrong? Contact Support about {code}", { code: esc(d.delivery_code) })}</button>`;
}

function trackRowStatus(d) {
  const at = d.status_changed_at || d.updated_at;
  const since = isToday(at) ? time(at) : day(at);
  if (d.status === "in_transit") return t("On the road since {when}", { when: since });
  if (d.status === "picked_up") return t(isToday(at) ? "Picked up at {when}" : "Picked up on {when}", { when: since });
  if (pickupPassed(d)) return t("Pickup date passed");
  if (d.status === "driver_assigned") {
    return d.scheduled_pickup_at ? `${t("Driver assigned")} · ${keep(t("pickup {day}", { day: day(d.scheduled_pickup_at) }))}` : t("Driver assigned");
  }
  return t("Waiting for a driver");
}
function trackList(list) {
  return `
    ${trackTop("Track", false)}
    ${trackHead(["Your", "shipments."])}
    <p class="rq-track-sub">${t("Pick one to follow it. Trucks on the road come first.")}</p>
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
    <p class="rq-track-sub">${t("When you book a truck, you can follow it here from pickup to drop-off.")}</p>
    <a class="rq-btn" href="#book">${t("Book a truck")}</a>
    ${past ? `<a class="rq-track-help" href="#history">${t("Past deliveries are in History")}</a>` : ""}`;
}
function trackMissing(code) {
  return `
    ${trackTop("Shipment details", true)}
    ${trackHead(["Not", "found."])}
    <p class="rq-track-sub">${t("We couldn't find {code} on your account. Codes look like SK-00142.", { code: esc(code) })}</p>
    <a class="rq-btn rq-btn--ghost" href="#track">${t("See your shipments")}</a>`;
}

// What the Track page last drew, so live updates only redraw on a real change
// (a half-typed rating comment survives a notification arriving).
let trackShown = null;
// The parts a live truck update changes; those are swapped in place, not redrawn.
const CAPTION = /(<figcaption id="track-caption-[^"]*">)([^<]*)/;
const withoutLive = (html) => html
  .replace(CAPTION, "$1")
  .replace(/ src="https:\/\/api\.mapbox\.com[^"]*"/, "")
  .replace(/(<span data-drive="[^"]*"[^>]*>)[^<]*/, "$1"); // drive time arrives on its own
function renderTrack({ animate = false } = {}) {
  if (document.body.dataset.view !== "track") return;
  const page = $("trackPage");
  if (!deliveriesLoaded) {
    page.innerHTML = `${trackTop("Track", Boolean(trackCode))}<h1 id="trackTitle" class="rq-sr" tabindex="-1">${t("Track")}</h1>${skeletons()}`;
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
    const fresh = d && CAPTION.exec(html)?.[2];
    if (caption && fresh) caption.textContent = fresh;
    trackShown.html = html;
    return;
  }
  page.innerHTML = html;
  trackShown = { key, html, status: d?.status };
  if (d) loadRouteLines([d]);
  if (before?.key === key && d && STAGES.indexOf(d.status) > STAGES.indexOf(before.status)) {
    // The booking moved on while you watched: say it, fill the new step, fade the headline in.
    $("trackLive").textContent = t("{code} is now {status}.", { code: d.delivery_code, status: statusLabel(d.status) });
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
      ? `<button type="button" class="rq-btn rq-btn--ghost" data-track-rate="${esc(d.id)}">${driver ? t("Rate {name}", { name: esc(driver) }) : t("Rate driver")}</button>`
      : "";
  return `
    <article class="rq-card rq-history-card" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="${esc(d.status)}">${statusLabel(d.status)}</span> ${metaLine(d)}</p>
      <p>${esc(d.pickup_address)} → ${esc(d.dropoff_address)}</p>
      ${d.status === "delivered" ? `<div class="rq-fare">${fareAmount(d)}${rated ? `<span class="rq-muted">${t("You rated {name} {n} of 5", { name: esc(driver || t("the driver")), n: rated.rating })}</span>` : ""}</div>` : ""}
      <div class="rq-card-actions">
        ${rateBtn}
        <button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">${t("Book again")}</button>
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
    b.textContent = `${t({ all: "All", delivered: "Delivered", cancelled: "Cancelled" }[f])} (${counts[f]})`;
    b.setAttribute("aria-pressed", String(f === historyFilter));
  });
  const shown = historyFilter === "all" ? history : history.filter((d) => d.status === historyFilter);
  // 25 at a time, so a busy trader's 400 past deliveries don't all render on a budget phone.
  const pageState = paginate(shown, historyPage);
  historyPage = pageState.page;
  $("historyList").innerHTML = shown.length
    ? pageState.rows.map(historyCard).join("") + historyPager(pageState)
    : history.length
      ? `<div class="rq-card rq-empty"><p><strong>${t(historyFilter === "delivered" ? "No delivered deliveries" : "No cancelled deliveries")}</strong></p><button type="button" class="rq-btn rq-btn--ghost" data-filter-reset>${t("Show all")}</button></div>`
      : `<div class="rq-card rq-empty"><p><strong>${t("No past deliveries yet")}</strong></p><p class="rq-muted">${t("Delivered and cancelled bookings show up here.")}</p></div>`;
}

function historyPager(state) {
  if (state.totalPages < 2) return "";
  return `
    <nav class="rq-pager" aria-label="${t("History pages")}">
      <p class="rq-muted">${t("Showing {from}–{to} of {total}", { from: state.from, to: state.to, total: state.total })}</p>
      <div class="rq-pager-controls">
        <button type="button" class="rq-btn rq-btn--ghost" data-history-page="${state.page - 1}"${state.page === 1 ? " disabled" : ""}>${t("Previous")}</button>
        <span class="rq-pager-status">${t("Page {n} of {total}", { n: state.page, total: state.totalPages })}</span>
        <button type="button" class="rq-btn rq-btn--ghost" data-history-page="${state.page + 1}"${state.page === state.totalPages ? " disabled" : ""}>${t("Next")}</button>
      </div>
    </nav>`;
}

function renderRecentRoute() {
  const last = deliveries[0];
  $("recentRoute").hidden = !last;
  if (!last) return;
  const btn = $("recentRouteBtn");
  btn.dataset.rebookId = last.id;
  const route = `${shortPlace(last.pickup_address)} → ${shortPlace(last.dropoff_address)}`;
  const load = [last.goods_description, last.quantity_kg != null ? `${Number(last.quantity_kg).toLocaleString("en-PH")} kg` : ""].filter(Boolean).join(" · ");
  $("recentRouteText").textContent = route;
  $("recentRouteLoad").textContent = load;
  btn.setAttribute("aria-label", t("Use recent route: {route}, {load}", { route, load }));
}

function renderAll() {
  refreshSent();
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
        <p><strong>${t("We couldn't load your deliveries.")}</strong></p>
        <p class="rq-muted">${t("Check your signal, then try again.")}</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-reload>${t("Try again")}</button>
      </div>`;
    $("homeLists").innerHTML = failed;
    if (!deliveriesLoaded) {
      $("trackPage").innerHTML = `${trackTop("Track", Boolean(trackCode))}<h1 id="trackTitle" class="rq-sr" tabindex="-1">${t("Track")}</h1>${failed}`;
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

/** Fill the Book form with an old booking's route, recipient and load, then ask for the day. */
function rebookIntoForm(d) {
  for (const [id, value] of Object.entries(rebookValues(d))) {
    inputs[id].value = value;
    inputs[id].dispatchEvent(new Event("input", { bubbles: true }));
  }
  produceRows.load(inputs.goodsDescription.value, inputs.quantityKg.value);
  pendingQuote = null;
  sentBooking = null;
  if (document.body.dataset.view !== "book") goTo("book");
  setStep(1, { focus: false });
  $("openDate").focus({ preventScroll: true });
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
  $("newDateOld").textContent = t("Your old request {code} will be cancelled.", { code: d.delivery_code });
  $("newDateConfirm").textContent = `${t("Confirm booking")} · ${price}`;
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
  if (getIsOffline()) return newDateProblem(t("No connection. Check your signal and try again."));
  const btn = $("newDateConfirm");
  const label = btn.textContent;
  setBusy(btn, true, t("Booking…"));
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
      // Same recipient and time of day as before (bookings from before 0024 have neither).
      ...(d.recipient_name ? { recipient_name: d.recipient_name } : {}),
      ...(d.pickup_window ? { pickup_window: d.pickup_window } : {}),
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
  if (cancelError) toastError(t("Your new booking is in, but {code} couldn't be cancelled. Cancel it from Home.", { code: d.delivery_code }));
  else toastSuccess(t("Booked for {day}. Drivers can see it now.", { day: day(new Date(input.value).toISOString()) }));
});

// ---------- Card actions (one listener for every list) ----------
let cancelTarget = null;
document.addEventListener("click", async (e) => {
  const el = e.target.closest("button, a");
  if (!el) {
    // The whole card opens its Track page, not just the pill (Home and History).
    const card = e.target.closest("#homeLists .rq-ship, #historyList .rq-history-card");
    if (card && !e.target.closest("textarea, input")) openTrack(card.dataset.deliveryId);
    return;
  }
  if (el.dataset.shipDot) return goToShip(shipCards()[Number(el.dataset.shipDot)]?.dataset.deliveryId);

  if (el.matches("[data-reload]")) return loadDeliveries();
  if (el.dataset.details) return openTrack(el.dataset.details);
  if (el.dataset.trackRate) return openTrack(el.dataset.trackRate, { rate: true });
  if (el.matches("[data-track-back]")) {
    // Back to where you came from (Home, History, a notification); the Track tab otherwise.
    if (history.state?.back) history.back();
    else goTo("track");
    return;
  }
  if (el.dataset.tile) return openTile(el.dataset.tile);

  // Book a new date / Cancel can be tapped inside another sheet (details,
  // notifications); that one steps aside first so only one sheet is up.
  if (el.dataset.newDate || el.dataset.cancelId) {
    const host = el.closest("dialog");
    if (host?.open) {
      host._returnFocus = null;
      await closeSheet(host);
    }
  }
  if (el.dataset.newDate) return openNewDate(el.dataset.newDate);

  if (el.dataset.cancelId) {
    cancelTarget = deliveries.find((d) => d.id === el.dataset.cancelId);
    if (!cancelTarget) return;
    $("cancelWhat").textContent = `${cancelTarget.delivery_code} · ${cancelTarget.goods_description}, ${cancelTarget.pickup_address.split(",")[0]} → ${cancelTarget.dropoff_address.split(",")[0]}. ${t("No driver has accepted yet.")}`;
    openSheet($("cancelSheet"));
    return;
  }

  if (el.dataset.rebookId) {
    const d = deliveries.find((x) => x.id === el.dataset.rebookId);
    if (d) rebookIntoForm(d);
    return;
  }


  if (el.dataset.star) {
    const box = el.closest("[data-rate-for]");
    const value = Number(el.dataset.star);
    box.dataset.value = value;
    box.querySelectorAll("[data-star]").forEach((s) => {
      const n = Number(s.dataset.star);
      s.setAttribute("aria-checked", String(n === value));
      s.classList.toggle("is-on", n <= value);
    });
    box.querySelector("[data-send-rating]").disabled = false;
    return;
  }

  if (el.matches("[data-send-rating]")) {
    const box = el.closest("[data-rate-for]");
    const id = box.dataset.rateFor;
    const d = deliveries.find((x) => x.id === id);
    el.disabled = true;
    el.textContent = t("Sending…");
    const { error } = await submitRating(id, profile.id, d.driver_id, Number(box.dataset.value), box.querySelector("textarea").value.trim());
    if (error) {
      el.disabled = false;
      el.textContent = t("Send rating");
      toastError(t("Your rating didn't save. Check your signal and send it again."));
      return;
    }
    toastSuccess(t("Thanks. Your rating was saved."));
    await loadDeliveries();
    $("trackPage").querySelector(".rq-rated")?.focus({ preventScroll: true }); // the stars are gone; land on the result
    return;
  }

  if (el.dataset.filter) {
    historyFilter = el.dataset.filter;
    historyPage = 1;
    renderHistory();
    return;
  }
  if (el.matches("[data-filter-reset]")) {
    historyFilter = "all";
    historyPage = 1;
    renderHistory();
    return;
  }
  if (el.dataset.historyPage) {
    historyPage = Number(el.dataset.historyPage);
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
    toastError(t("No connection. Check your signal and try again."));
    return;
  }
  setBusy(btn, true, t("Cancelling…"));
  const { error } = await cancelMyDelivery(d.id, profile.id);
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = t("Cancel request");
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
        `<div class="rq-banner rq-banner--warn" role="alert"><p><strong>${t("A driver accepted first.")}</strong> ${t("Your cancel didn't go through. Only Sakada can cancel now.")} <button type="button" class="rq-link" data-open-contact="${esc(d.delivery_code)}" aria-haspopup="dialog">${t("Contact Support about {code}", { code: esc(d.delivery_code) })}</button></p></div>`,
      );
      card?.focus();
    } else {
      toastError(t("We couldn't cancel this. Check your signal and try again."));
    }
    return;
  }
  toastSuccess(t("Request cancelled"));
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
    showFieldError(input, t(problem));
    input.focus();
    return;
  }
  const d = findDelivery(deliveries, input.value);
  if (!d) {
    showFieldError(input, t("Nothing on your account matches \"{text}\". Codes look like SK-00142.", { text: input.value.trim() }));
    input.focus();
    return;
  }
  showFieldError(input, "");
  input.blur(); // put the phone keyboard away
  openTrack(d.id);
});

// ---------- Notifications ----------
// The database writes these in English (0008); each known one is shown in
// the chosen language, anything else as written.
const NOTICES = [
  [/^A driver accepted your delivery (\S+)\.$/, "A driver accepted your delivery {code}."],
  [/^Your delivery (\S+) has been picked up\.$/, "Your delivery {code} has been picked up."],
  [/^Your delivery (\S+) is in transit\.$/, "Your delivery {code} is in transit."],
  [/^Your delivery (\S+) has been delivered\.$/, "Your delivery {code} has been delivered."],
  [/^Your delivery (\S+) was cancelled\.$/, "Your delivery {code} was cancelled."],
];
function noticeText(message) {
  for (const [pattern, english] of NOTICES) {
    const m = pattern.exec(message || "");
    if (m) return t(english, { code: m[1] });
  }
  return message;
}
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
    b.setAttribute("aria-label", unread ? t("Notifications, {n} unread", { n: unread }) : t("Notifications")),
  );
  const words = [unread - late && t("{n} unread", { n: unread - late }), late && t(late > 1 ? "{n} need you" : "{n} needs you", { n: late })].filter(Boolean);
  document.querySelectorAll("[data-unread-text]").forEach((el) => (el.textContent = words.join(" · ")));
  renderNeeds();
}

/** Late requests sit at the top of the notifications sheet until they're rebooked or cancelled. */
function renderNeeds() {
  const late = lateList();
  $("notifNeeds").hidden = !late.length;
  $("notifNeeds").innerHTML = late.length ? `
    <h3 class="rq-needs-title">${t("Needs you")}</h3>
    ${late.map((d) => `
      <div class="rq-need" data-need="${esc(d.id)}">
        <p><strong>${esc(d.delivery_code)} · ${titleLine(d)}</strong><br /><span class="rq-muted">${shortRoute(d)}</span></p>
        <p>${t("The pickup date ({day}) passed before a driver accepted, so drivers can't see it anymore.", { day: day(d.scheduled_pickup_at) })}</p>
        <div class="rq-need-actions">
          <button type="button" class="rq-btn" data-new-date="${esc(d.id)}">${t("Book a new date")}</button>
          <button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">${t("Cancel request")}</button>
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
          <span><span class="rq-sr">${n.is_read ? "" : t("Unread. ")}</span>${esc(noticeText(n.message))}<br /><span class="rq-muted">${timeAgo(n.created_at)}</span></span>
        </button></li>`,
        )
        .join("")
    : `<li class="rq-empty"><p><strong>${t("No notifications yet")}</strong></p><p class="rq-muted">${t("Updates show here when a driver accepts, picks up and delivers.")}</p></li>`;
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
