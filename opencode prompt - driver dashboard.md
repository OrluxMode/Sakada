# OpenCode task: new driver dashboard (Phase 1) + owner rules for drivers

Rebuild the driver dashboard to match the approved Figma v4 frames, and add the owner's rules from 2026-10-15:
- **At most 2 active jobs per driver.** The database refuses a third accept.
- **A driver can mark a job Delivered even if the receiver didn't pay.** The job closes on delivery, not payment.
- **Unpaid deliveries are flagged** on the admin dashboard so Sakada can follow up.

The page has four views: **Home · New jobs · History · Profile**.
- **Phones:** bottom tabs, plus a sticky bar with the current job's next step.
- **Desktop (≥1024px):** a top bar, the current job on the left, New jobs always on the right.

What's new:
- **The job card:**
  - a 4-step bar (Accepted, Picked up, In transit, Delivered) and the next stop
  - Open in Maps, which uses coordinates when it has them
  - the cash to collect and the sender's notes
  - with 2 jobs, chips to switch between them
- **The steps:**
  - "I've picked up the load" and "I'm driving to drop-off" wait 8 seconds with an **Undo** (10 s for keyboard users). They save at once if the driver leaves the page or taps Open in Maps.
  - "I've delivered it" opens a **cash check**: *Yes, delivered and paid* / *Delivered, not paid* / *Not yet*.
- **Accept** goes through a confirm sheet.
- **Plain-words states:** no longer available, too many tries, 2-job cap, no vehicle yet, location off/blocked/unsupported, no signal, offline, Sakada cancelled a job, first visit.
- **History** has filters, rating the sender, and an **Unpaid** label.
- **Admin dashboard:** an "Unpaid, follow up" count and an Unpaid label in the deliveries table.

**All code below is final.** Claude built it on a copy of the site and ran it in a browser at 1440 and 390px (0 console errors, no sideways scrolling). Claude also ran the SQL in a real Postgres engine (PGlite):
- a third accept is refused
- payment can only be set with the Delivered step, and only once
- `status_changed_at` can't be forged
- the old driver page still works

Results: lint clean, **143/143 unit tests**, **65/65 e2e tests**.

**Copy every block exactly.** Don't change other files, and don't commit.

## 1. `sakada-backend/supabase/migrations/0020_driver_jobs_and_payment.sql`: already there, skip
Claude already put this file in the migrations folder, and the owner runs it in Supabase. **Don't create, change or delete it.**

## 2. Replace `sakada-web/dashboard/driver/index.html` with:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Driver Dashboard — Sakada Logistics</title>
    <meta name="robots" content="noindex" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://api.mapbox.com data:; connect-src 'self' https://*.supabase.co https://api.mapbox.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com wss://*.supabase.co; frame-src 'none';" />
    <link rel="stylesheet" href="../../css/fonts.css" />
    <link rel="stylesheet" href="../../css/style.css" />
    <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js" integrity="sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N" crossorigin="anonymous"></script>
  </head>
  <body class="rq dv" data-view="home">
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="offline-banner" id="offlineBanner">
      <span class="offline-banner__icon">⚠</span>
      You're offline. Updating a job waits until you're back online.
    </div>
    <div class="page-loader" id="pageLoader">
      <div class="page-loader__spinner"></div>
    </div>

    <!-- Desktop top bar (phones use the bottom tabs) -->
    <header class="rq-topbar">
      <a class="logo" href="../../index.html">SAKA<span class="mark">DA</span></a>
      <nav class="rq-topnav" aria-label="Dashboard">
        <a href="#home" data-tab="home">Home</a>
        <a href="#history" data-tab="history">History</a>
        <a href="#profile" data-tab="profile">Profile</a>
      </nav>
      <a class="rq-account" href="#profile">
        <span class="rq-avatar rq-avatar--sm" data-initials></span>
        <span class="dv-who"><span data-user-name>Loading…</span><span class="rq-muted" data-vehicle-line></span></span>
      </a>
    </header>

    <div class="rq-layout">
      <main class="rq-main" id="main" tabindex="-1">
        <!-- HOME -->
        <section class="rq-view" id="view-home" aria-labelledby="homeTitle">
          <div class="dv-head">
            <span class="rq-avatar" data-initials aria-hidden="true"></span>
            <span class="dv-who"><strong data-user-name>Loading…</strong><span class="rq-muted" data-vehicle-line></span></span>
          </div>
          <h1 id="homeTitle" class="rq-display">Home</h1>
          <div id="locBanner"></div>
          <div id="homeBody" aria-live="polite"></div>
          <a class="rq-help" id="helpRow" href="../../pages/contact.html">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <span class="dv-grow"><span class="rq-muted">Problem with a job?</span> <strong>Send Sakada a message</strong></span>
            <svg class="dv-chev" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </a>
        </section>

        <!-- HISTORY -->
        <section class="rq-view" id="view-history" aria-labelledby="historyTitle">
          <h1 id="historyTitle" class="rq-display">History</h1>
          <div class="rq-filters" role="group" aria-label="Show">
            <button type="button" class="rq-filter" data-filter="all" aria-pressed="true">All</button>
            <button type="button" class="rq-filter" data-filter="delivered" aria-pressed="false">Delivered</button>
            <button type="button" class="rq-filter" data-filter="cancelled" aria-pressed="false">Cancelled</button>
          </div>
          <div id="historyList" aria-live="polite"></div>
        </section>

        <!-- PROFILE -->
        <section class="rq-view" id="view-profile" aria-labelledby="profileTitle">
          <div class="rq-profile-head">
            <span class="rq-avatar rq-avatar--lg" data-initials aria-hidden="true"></span>
            <div>
              <h1 id="profileTitle" class="rq-display" data-user-name>Profile</h1>
              <p class="rq-muted"><span>Driver</span><span id="profileEmail"></span></p>
            </div>
          </div>

          <form id="vehicleForm" class="rq-card dv-vehicle" novalidate>
            <h2 class="rq-section-title">Your vehicle</h2>
            <p class="rq-muted">Senders see this once you accept their job, so they know which truck to look for.</p>
            <div class="field">
              <label for="vehicleType">Vehicle type</label>
              <input id="vehicleType" type="text" maxlength="40" autocomplete="off" aria-describedby="vehicleTypeHint" />
              <p class="rq-hint" id="vehicleTypeHint">e.g. Isuzu Elf, 6-wheeler, 10-wheeler</p>
            </div>
            <div class="field">
              <label for="vehiclePlate">Plate number</label>
              <input id="vehiclePlate" type="text" maxlength="15" autocomplete="off" autocapitalize="characters" />
            </div>
            <div id="vehicleMessage" class="rq-banner rq-banner--bad" role="alert" hidden></div>
            <button class="rq-btn rq-btn--ghost" type="submit" id="vehicleSaveBtn">Save vehicle</button>
          </form>

          <div class="rq-list">
            <button type="button" class="rq-row" data-open-notifs>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
              <span>Notifications</span><span class="rq-row-meta" data-unread-text></span>
            </button>
            <a class="rq-row" href="../../pages/contact.html">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
              <span>Send Sakada a message</span>
            </a>
            <a class="rq-row" href="../../pages/for-drivers.html">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
              <span>How it works for drivers</span>
            </a>
          </div>
          <button class="rq-btn rq-btn--ghost" id="signOutBtn" type="button">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
            Log out
          </button>
        </section>
      </main>

      <!-- NEW JOBS (its own tab on phones, a side panel on desktop) -->
      <aside class="rq-view dv-jobs" id="view-jobs" aria-labelledby="jobsTitle">
        <div class="dv-jobs-head">
          <h1 id="jobsTitle" class="rq-display">New jobs</h1>
          <button type="button" class="rq-link dv-refresh dv-refresh--desk" data-refresh>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
            Refresh
          </button>
        </div>
        <p class="rq-muted dv-jobs-sub">First driver to accept gets it. After you accept, only Sakada can cancel.</p>
        <p class="dv-checked">
          <button type="button" class="rq-link dv-refresh" data-refresh>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
            Refresh
          </button>
          <span class="rq-muted" id="checkedAt"></span>
        </p>
        <div id="jobsMessage"></div>
        <div id="jobsList" aria-live="polite"></div>
      </aside>
    </div>

    <!-- Phone: the current job's next step, above the tabs -->
    <div class="dv-bar" id="actionBar" hidden>
      <div class="dv-bar-top">
        <strong id="barJob"></strong>
        <span class="dv-share" id="barShare"></span>
      </div>
      <div id="barAction"></div>
    </div>

    <!-- Phone tab bar -->
    <nav class="rq-tabs" aria-label="Dashboard">
      <a href="#home" data-tab="home"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>Home</a>
      <a href="#jobs" data-tab="jobs"><span class="dv-tab-icon"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg><span class="rq-badge" data-jobs-count hidden></span></span>New jobs</a>
      <a href="#history" data-tab="history"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>History</a>
      <a href="#profile" data-tab="profile"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a>
    </nav>

    <!-- Undo / saving / saved -->
    <div class="dv-snack" id="snackbar" role="status" aria-live="polite" hidden></div>

    <!-- Notifications sheet -->
    <dialog class="rq-sheet" id="notifSheet" aria-labelledby="notifTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <div class="rq-sheet-head">
        <h2 id="notifTitle" class="rq-display">Notifications</h2>
        <span class="rq-row-meta" data-unread-text></span>
      </div>
      <ul class="rq-notifs" id="notifList"></ul>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet>Close</button>
    </dialog>

    <!-- Accept: confirm. "Yes" sits where Accept was, so a quick second tap works. -->
    <dialog class="rq-sheet" id="acceptSheet" aria-labelledby="acceptTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <h2 id="acceptTitle" class="rq-display">Take this job?</h2>
      <p class="rq-muted" id="acceptWhat"></p>
      <p>Once you accept, only Sakada can cancel it.</p>
      <div id="acceptMessage" class="rq-banner rq-banner--bad" role="alert" hidden></div>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet>Not now</button>
      <button class="rq-btn" type="button" id="acceptConfirm">Yes, take it</button>
    </dialog>

    <!-- Delivered: cash check -->
    <dialog class="rq-sheet" id="deliveredSheet" aria-labelledby="deliveredTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <h2 id="deliveredTitle" class="rq-display">Delivered?</h2>
      <div class="dv-collect">
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
        <span><span class="rq-muted">Did you collect</span><br /><strong class="dv-collect-amount" id="deliveredAmount"></strong></span>
      </div>
      <p>Only confirm after the goods are handed over. You can't undo this.</p>
      <div id="deliveredMessage" class="rq-banner rq-banner--bad" role="alert" hidden></div>
      <button class="rq-btn" type="button" data-paid="yes">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        Yes, delivered and paid
      </button>
      <button class="rq-btn rq-btn--ghost" type="button" data-paid="no">Delivered, not paid</button>
      <button class="rq-btn rq-btn--text dv-full" type="button" data-close-sheet>Not yet</button>
      <p class="rq-muted">Not paid? The job still closes. Sakada marks it Unpaid and follows up with the receiver.</p>
    </dialog>

    <script type="module" src="../../js/driver-dashboard.js"></script>
  </body>
</html>
```

## 3. Replace `sakada-web/js/driver-dashboard.js` with:
```js
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
```

## 4. Create `sakada-web/css/driver.css` with:
```css
/* ================================================
   Driver dashboard (v4 design, Figma "driver dashboard" v4).
   The page is body.rq.dv: it reuses the farmer/vendor parts in
   requester.css (tabs, cards, sheets, banners, buttons) and adds the
   driver-only pieces here, all scoped to .dv.
   Phones: one view at a time, a sticky bar with the next step, tabs.
   ≥1024px: top bar, current job on the left, New jobs on the right.
   ================================================ */
.dv { --dv-bar-h: 124px; }
.dv[data-view="jobs"] #view-jobs { display: block; }
.dv .dv-grow { flex: 1; min-width: 0; }
.dv .dv-chev { color: var(--rq-meta); flex: none; }
.dv .dv-gap { margin-bottom: 12px; }
.dv .dv-full { width: 100%; }

/* Header (phones) */
.dv-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.dv-who { display: flex; flex-direction: column; min-width: 0; font-size: 17px; line-height: 1.3; }
.dv-who .rq-muted { font-size: 15px; }
.dv #homeTitle { margin-bottom: 12px; }

/* Location and other banners above the job */
.dv #locBanner .rq-banner { margin-bottom: 12px; }
.dv .rq-banner > svg { flex: none; margin-top: 2px; }
.dv .rq-banner--bad { color: var(--text-cream); }
.dv .rq-banner--bad > svg { color: var(--status-cancelled); }
.dv .rq-banner--warn > svg { color: #f0b25a; }
.dv .rq-banner--plain { border-color: var(--rq-edge); color: var(--text-cream); }
.dv .rq-banner--plain > svg { color: #f0b25a; }
.dv .rq-banner p { margin: 0; }
.dv .dv-blocked { flex-direction: column; gap: 12px; }

/* Two jobs: switcher chips */
.dv-chips { display: flex; gap: 8px; margin-bottom: 8px; }
.dv-chip {
  display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px;
  border-radius: 10px; border: 1px solid var(--rq-edge); background: var(--panel-dark);
  color: var(--text-cream); font-size: 16px; cursor: pointer;
  flex: 1 1 0; min-width: 0; justify-content: center;
}
.dv-chip-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dv-chip[aria-pressed="true"] {
  border-color: var(--accent-amber); background: rgb(224 151 47 / 0.12); color: #f0b25a; font-weight: 700;
}
.dv-chip-code { display: none; }
.dv-dot { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 50%; }
.dv-dot--green { background: var(--status-delivered); }
.dv-dot--grey { background: #8d8a80; }
.dv-dot--red { background: var(--status-cancelled); }
.dv-share-line { font-size: 15px; line-height: 1.45; margin-bottom: 12px !important; }

/* The job card */
.dv .dv-job { border-color: var(--accent-amber); gap: 14px; }
.dv .rq-card-title { font-family: inherit; font-weight: 600; letter-spacing: 0; }
.dv .dv-job-title { font-size: 19px; }
.dv-stack { display: grid; gap: 2px; min-width: 0; }
.dv .dv-stack .rq-muted { display: block; }
.dv .dv-stepper .rq-stepper-labels { display: flex; gap: 4px; }
.dv .rq-step-label { flex: 1; font-size: 15px; color: var(--rq-meta); }
.dv .rq-step-label.is-current { color: #f0b25a; font-weight: 700; }
.dv .dv-stepper .rq-step--done { background: var(--accent-amber); }
.dv .dv-stepper .rq-step--current { height: 10px; }
.dv .dv-stepper .rq-step--next { background: #6b6a62; border: 0; }
.dv-done { display: flex; gap: 10px; align-items: flex-start; font-size: 16px; line-height: 1.4; color: var(--rq-meta); }
.dv-done svg { color: var(--status-delivered); flex: none; margin-top: 2px; }

.dv-grid { display: grid; gap: 12px; }
.dv-side { display: grid; gap: 12px; align-content: start; }
.dv-side:empty { display: none; }
.dv-stop { padding: 14px; border-radius: 10px; background: var(--bg-black); }
.dv-stop-label { display: flex; align-items: center; gap: 10px; font-size: 16px; color: var(--rq-meta); }
.dv-ring { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid var(--accent-amber); box-sizing: border-box; flex: none; }
.dv-ring--green { border-color: var(--status-delivered); }
.dv-stop-place { margin: 10px 0 14px !important; font-size: 18px; font-weight: 600; line-height: 1.35; }
.dv .dv-maps { min-height: 52px; }
.dv .dv-maps-hint { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; margin-top: 10px !important; font-size: 15px; }
.dv-collect {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 10px;
  background: rgb(224 151 47 / 0.1); border: 1px solid var(--accent-amber); font-size: 15px; line-height: 1.35;
}
.dv-collect svg { color: #f0b25a; flex: none; }
.dv-collect-amount { font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 30px; line-height: 1.1; }
.dv-notes { display: flex; gap: 12px; padding: 14px; border-radius: 10px; background: var(--bg-black); font-size: 16px; line-height: 1.45; }
.dv-notes svg, .dv-cash-line svg { color: #f0b25a; flex: none; margin-top: 2px; }
.dv-notes .rq-muted { font-size: 15px; }
.dv-cash-line { display: flex; gap: 12px; font-size: 16px; line-height: 1.4; }
.dv-cash-line strong { color: #f0b25a; }
.dv-card-action { display: none; }
.dv .dv-jobs-row, .dv .dv-rate-row { margin-top: 12px; }
.dv .dv-jobs-row svg:first-child, .dv .dv-rate-row svg:first-child { color: #f0b25a; flex: none; }
.dv #helpRow { margin-top: 12px; }

/* Buttons that can't be used right now look it */
.dv .rq-btn.dv-wait,
.dv .rq-btn.dv-wait:hover {
  background: none; border: 1.5px dashed var(--rq-edge); color: var(--rq-meta); opacity: 1;
}

/* Phone: the next step sits in a bar above the tabs */
.dv-bar {
  position: fixed; left: 0; right: 0; z-index: 39;
  bottom: calc(var(--rq-tab-h) + env(safe-area-inset-bottom));
  padding: 12px 20px; background: #15160f; border-top: 1px solid var(--rq-edge);
}
.dv-bar[hidden] { display: none; }
.dv-bar-top { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px; font-size: 15px; }
.dv-share { display: inline-flex; align-items: center; gap: 6px; color: var(--rq-meta); font-size: 14px; white-space: nowrap; }
.dv .dv-bar-btn { min-height: 56px; font-size: 18px; }
.dv.dv-has-bar { padding-bottom: calc(var(--rq-tab-h) + var(--dv-bar-h) + 24px + env(safe-area-inset-bottom)); }

/* New jobs badge on the tab */
.dv-tab-icon { position: relative; display: inline-flex; }
.dv-tab-icon .rq-badge { top: -8px; right: -14px; }

/* Snackbar: Undo, saving, saved, next-step hints */
.dv-snack {
  position: fixed; left: 12px; right: 12px; z-index: 45; overflow: hidden;
  bottom: calc(var(--rq-tab-h) + 12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 12px 10px 16px;
  border-radius: 10px; background: #26271f; border: 1px solid var(--rq-edge);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.45); font-size: 16px; line-height: 1.35;
}
.dv-snack[hidden] { display: none; }
.dv.dv-has-bar .dv-snack { bottom: calc(var(--rq-tab-h) + var(--dv-bar-h) + 12px + env(safe-area-inset-bottom)); }
.dv-snack > svg { color: #f0b25a; flex: none; }
.dv-snack .spinner { flex: none; }
.dv-snack--bad { border-color: var(--status-cancelled); background: #2a1a14; }
.dv-snack--bad > svg { color: var(--status-cancelled); }
.dv-undo {
  flex: none; min-height: 44px; padding: 0 16px; border-radius: 8px;
  background: none; border: 1px solid var(--accent-amber); color: #f0b25a; font: inherit; font-weight: 700; cursor: pointer;
}
.dv-snack-timer {
  position: absolute; left: 0; bottom: 0; height: 3px; width: 100%;
  background: var(--accent-amber); transform-origin: left; animation: dv-undo-timer linear forwards;
}
@keyframes dv-undo-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@media (prefers-reduced-motion: reduce) { .dv-snack-timer { animation: none; opacity: 0.6; } }

/* New jobs */
.dv-jobs-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.dv .dv-refresh { display: inline-flex; gap: 8px; text-decoration: none; }
.dv .dv-refresh--desk { display: none; }
.dv-jobs-sub { margin: 6px 0 4px !important; font-size: 16px; line-height: 1.45; }
.dv-checked { display: flex; align-items: center; gap: 8px; margin-bottom: 12px !important; font-size: 15px; }
#jobsMessage > * { margin-bottom: 12px; }
.dv-cap {
  display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 10px;
  border: 1px solid var(--rq-field-line); font-size: 16px; line-height: 1.45;
}
.dv-cap svg { color: var(--text-cream); flex: none; margin-top: 2px; }
.dv .dv-offer { gap: 12px; }
.dv-offer-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.dv-price { flex: none; text-align: right; }
.dv-price strong { display: block; font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 30px; line-height: 1; }
.dv-price .rq-muted { font-size: 14px !important; display: block !important; }
.dv .dv-offer-route p { font-size: 16px; line-height: 1.4; }
.dv .dv-offer-route p + p { margin-top: 8px; }
.dv .dv-offer-route .rq-route-dots { margin: 8px 0 12px; }
.dv .dv-offer-route .rq-route-dots::after { bottom: -12px; }
.dv-offer-short { display: none !important; }
.dv-offer-facts { font-size: 16px; color: var(--rq-meta); }

/* Home: first visit, idle, rate prompt, cancelled by Sakada */
.dv .dv-first { border-color: var(--accent-amber); }
.dv .dv-first .rq-display, .dv .rq-card > .rq-display { font-size: 30px; }
.dv-steps { list-style: none; counter-reset: step; margin: 0; padding: 0; display: grid; gap: 14px; }
.dv-steps li {
  counter-increment: step; display: grid; grid-template-columns: 28px 1fr; gap: 12px;
  font-size: 16px; line-height: 1.45; color: var(--rq-meta);
}
.dv-steps li::before {
  content: counter(step); display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  border: 1.5px solid var(--accent-amber); color: #f0b25a; font-weight: 700; font-size: 14px;
}
.dv-rated { display: grid; gap: 12px; margin-bottom: 24px; }
.dv-rated:focus { outline: 2px solid var(--accent-amber); outline-offset: 4px; border-radius: 10px; }
.dv-rated .rq-banner { margin-bottom: 0; }
.dv-rate-bare { display: grid; gap: 10px; }
.dv-rate-row-wrap { display: grid; gap: 12px; }
.dv .dv-cancelled { border-color: var(--status-cancelled); }

/* History */
.dv .rq-card .rq-muted .status-pill + .status-pill { margin-left: -4px; }
.dv-paid .rq-muted { margin-left: auto; text-align: right; }
.dv .dv-unpaid { color: #f2a98a; }

/* Profile */
.dv .dv-vehicle { margin: 24px 0 0; gap: 16px; }
.dv .dv-vehicle .rq-section-title { margin: 0; }
.dv .dv-vehicle > .rq-muted { font-size: 16px; line-height: 1.5; }
.dv .dv-vehicle .rq-hint { margin-top: 8px; }
.dv #signOutBtn svg { flex: none; }

/* ---------- Desktop ---------- */
@media (min-width: 1024px) {
  .dv .dv-head { display: none; }
  .dv .dv-bar { display: none; }
  .dv.dv-has-bar { padding-bottom: 64px; }
  .dv .rq-account { min-height: 48px; }
  .dv .rq-topbar .dv-who { font-size: 16px; }
  .dv .rq-topbar .dv-who .rq-muted { font-size: 14px; }
  .dv .rq-display { font-size: 36px; }
  .dv-chip-code { display: inline; }
  .dv-chips .dv-chip { flex: 0 1 auto; padding: 0 16px; }
  .dv-rate-row-wrap { grid-template-columns: auto 1fr auto; align-items: center; }
  .dv-rate-row-wrap .dv-rate-bare { grid-column: 1; grid-template-columns: auto auto; align-items: center; }
  .dv-rate-row-wrap .dv-later { grid-column: 3; width: auto; min-width: 120px; }
  .dv-share-line--solo { display: block; }
  .dv .rq-layout { grid-template-columns: minmax(0, 1fr) 420px; }
  /* New jobs is always visible on desktop; #jobs just focuses it */
  .dv #view-jobs { display: block; position: sticky; top: 24px; }
  .dv #view-jobs .rq-display { font-size: 30px; }
  .dv[data-view="jobs"] #view-home { display: block; }
  .dv .dv-refresh--desk { display: inline-flex; }
  .dv .dv-checked .dv-refresh { display: none; }
  .dv .dv-jobs-sub { font-size: 15px; }
  .dv-offer .dv-offer-route { display: none; }
  .dv-offer-short { display: block !important; margin-top: -8px !important; font-size: 15px; }
  .dv-offer .rq-card-title { font-size: 17px; }
  .dv .dv-accept { background: none; border: 1px solid var(--accent-amber); color: #f0b25a; }
  .dv .dv-accept:hover { background: rgb(224 151 47 / 0.12); }
  .dv .dv-job { padding: 24px; }
  .dv-grid { grid-template-columns: 1fr 1fr; gap: 20px; }
  .dv .dv-maps { width: auto; }
  .dv-card-action { display: flex; align-items: center; gap: 16px; margin-top: 4px; }
  .dv-card-action .rq-btn { width: auto; min-height: 56px; padding: 0 24px; font-size: 18px; }
  .dv .dv-jobs-row { display: none; }
  .dv-snack, .dv.dv-has-bar .dv-snack { left: 64px; right: auto; width: 440px; bottom: 24px; }
}
```

## 5. `sakada-web/css/style.css`: add one line
Right after the line `@import "requester.css";`, add:
```css
@import "driver.css";
```

## 6. `sakada-web/css/dashboard.css`: add after the `.status-pill[data-status="cancelled"] { … }` rule
```css
/* Delivered but the receiver didn't pay (0020): Sakada follows up */
.status-pill[data-status="unpaid"] {
  --pill: var(--status-cancelled);
  --pill-text: var(--status-cancelled-text);
}
```

## 7. `sakada-web/js/deliveries.js`: add this function right above the comment `/** Deliveries a driver has accepted, most recent first. */`
```js
/**
 * The driver's Delivered step, with whether the receiver paid. The job
 * closes either way (owner rule, 2026-10-15); unpaid ones are flagged for
 * Sakada to follow up. The 0020 guard only lets payment_status be set
 * together with in_transit -> delivered.
 */
export async function markDelivered(deliveryId, driverId, paid) {
  return await supabase
    .from("deliveries")
    .update({ status: "delivered", payment_status: paid ? "paid" : "unpaid" })
    .eq("id", deliveryId)
    .eq("driver_id", driverId)
    .eq("status", "in_transit")
    .select()
    .single();
}

```

## 8. `sakada-web/dashboard/admin/index.html`: add a stat card
Right after the "Completed" stat card (the `<div class="admin-stat-card">` that holds `id="statCompleted"`), add:
```html
        <div class="admin-stat-card">
          <span class="admin-stat-number" id="statUnpaid">—</span>
          <div class="admin-stat-label">Unpaid, follow up</div>
        </div>
```

## 9. `sakada-web/js/admin-dashboard.js`: two edits
**a)** In `loadDeliveries()`, right after the `statCompleted` lines, add:
```js
  // Delivered without payment (driver chose "Delivered, not paid"): Sakada follows up.
  document.getElementById("statUnpaid").textContent = data.filter(
    (d) => d.payment_status === "unpaid",
  ).length;
```
**b)** In `renderDeliveries()`, replace the status cell line:
```js
        <td><span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span></td>
```
with:
```js
        <td><span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>${d.payment_status === "unpaid" ? ' <span class="status-pill" data-status="unpaid">Unpaid</span>' : ""}</td>
```

## 10. Replace `sakada-web/js/dashboard-shared.js` with:
```js
import { sanitizeText } from "./sanitize.js";
import { toastError } from "./toast.js";
import {
  getMyNotifications,
  markNotificationRead,
  subscribeToNotifications,
} from "./notifications.js";

export const HISTORY_STATUSES = ["delivered", "cancelled"];

export function statusLabel(status) {
  return (
    {
      pending: "Pending",
      driver_assigned: "Driver Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled",
    }[status] || status
  );
}

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Keep delivery codes like "SK-00142" on one line. Runs on text that
// sanitizeText already escaped, and only matches letters, digits and "-",
// so it can't inject markup.
const keepCodesTogether = (safeText) =>
  safeText.replace(/\bSK-\d+\b/g, (code) => `<span class="notif-code">${code}</span>`);

export function renderNotifications(list, notifBadge, notifPanel, onRead) {
  const unreadCount = list.filter((n) => !n.is_read).length;
  notifBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  notifBadge.classList.toggle("visible", unreadCount > 0);

  const head = `<div class="notif-head">Notifications</div>`;

  if (list.length === 0) {
    notifPanel.innerHTML = `${head}<div class="notif-empty"><strong>No notifications yet.</strong><span>Updates on your deliveries show up here.</span></div>`;
    return;
  }

  notifPanel.innerHTML = head + list
    .map(
      (n) => `
    <div class="notif-item ${n.is_read ? "" : "unread"}" data-notif-id="${sanitizeText(n.id)}" data-read="${n.is_read}">
      ${keepCodesTogether(sanitizeText(n.message))}
      <span class="notif-time">${timeAgo(n.created_at)}</span>
    </div>
  `,
    )
    .join("");

  notifPanel.querySelectorAll("[data-notif-id]").forEach((item) => {
    item.addEventListener("click", async () => {
      if (item.dataset.read === "true") return;
      await markNotificationRead(item.dataset.notifId);
      if (onRead) onRead();
    });
  });
}

export function renderRatingBlock(d, existingRating, ratedLabel, viewerId) {
  if (d.status !== "delivered") return "";

  const otherUserId =
    d.driver_id === viewerId ? d.requester_id : d.driver_id;

  if (existingRating) {
    return `
      <div class="rating-box">
        <div class="rating-given">
          ${ratedLabel}: <span class="stars-display">${"★".repeat(existingRating.rating)}${"☆".repeat(5 - existingRating.rating)}</span>
          ${existingRating.comment ? `<br>"${sanitizeText(existingRating.comment)}"` : ""}
        </div>
      </div>
    `;
  }

  return `
    <div class="rating-box">
      <div class="star-picker" data-delivery-id="${sanitizeText(d.id)}">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}">★</button>`).join("")}
      </div>
      <textarea class="rating-comment" data-comment-for="${sanitizeText(d.id)}" rows="2" maxlength="500" placeholder="How was this delivery? (optional)"></textarea>
      <button class="btn-small" data-submit-rating="${sanitizeText(d.id)}" data-other-user-id="${sanitizeText(otherUserId)}" disabled>Submit Rating</button>
    </div>
  `;
}

export function wireRatingControls(container, profile, submitRatingFn, onSuccess) {
  container.querySelectorAll(".star-picker").forEach((picker) => {
    const stars = picker.querySelectorAll("button");
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        const value = parseInt(star.dataset.star, 10);
        picker.dataset.selected = value;
        stars.forEach((s) =>
          s.classList.toggle(
            "selected",
            parseInt(s.dataset.star, 10) <= value,
          ),
        );
        const submitBtn = container.querySelector(
          `[data-submit-rating="${picker.dataset.deliveryId}"]`,
        );
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  });

  container.querySelectorAll("[data-submit-rating]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const deliveryId = btn.dataset.submitRating;
      const otherUserId = btn.dataset.otherUserId;
      const picker = container.querySelector(
        `.star-picker[data-delivery-id="${deliveryId}"]`,
      );
      const comment = container
        .querySelector(`[data-comment-for="${deliveryId}"]`)
        .value.trim();
      const rating = parseInt(picker?.dataset.selected || "0", 10);
      if (!rating) return;

      btn.disabled = true;
      btn.textContent = "Submitting...";

      const { error } = await submitRatingFn(
        deliveryId,
        profile.id,
        otherUserId,
        rating,
        comment,
      );

      if (error) {
        btn.disabled = false;
        btn.textContent = "Submit Rating";
        toastError("Couldn't save your rating: " + error.message);
        return;
      }

      onSuccess();
    });
  });
}

export function setupNotifications(profile, notifBell, notifPanel, notifBadge) {
  async function loadNotifications() {
    const { data, error } = await getMyNotifications(profile.id);
    if (!error && data) renderNotifications(data, notifBadge, notifPanel, loadNotifications);
  }

  const setOpen = (open) => {
    notifPanel.classList.toggle("open", open);
    notifBell.setAttribute("aria-expanded", String(open));
  };

  notifBell.addEventListener("click", () => {
    setOpen(!notifPanel.classList.contains("open"));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-wrap")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && notifPanel.classList.contains("open")) {
      setOpen(false);
      notifBell.focus();
    }
  });

  loadNotifications();
  subscribeToNotifications(profile.id, () => loadNotifications());

  return loadNotifications;
}

/**
 * True when the form no longer matches the quote the user saw, so the
 * quote must not be booked. Addresses compare trimmed; load compares
 * as a number.
 */
export function isQuoteStale(quote, form) {
  if (!quote) return true;
  return (
    quote.pickupAddress !== form.pickupAddress.trim() ||
    quote.dropoffAddress !== form.dropoffAddress.trim() ||
    quote.quantityKg !== parseFloat(form.quantityKg)
  );
}

/**
 * "Driver: Juan Dela Cruz · Isuzu Elf · NBC 1234" for a requester's delivery
 * card. `row` comes from getMyDeliveryDrivers(); returns "" when no driver
 * is assigned yet. Everything is sanitized.
 */
export function renderDriverLine(row) {
  if (!row || !row.driver_name) return "";
  const parts = [sanitizeText(row.vehicle_type), sanitizeText(row.vehicle_plate)].filter(Boolean);
  const vehicle = parts.length ? ` · ${parts.join(" · ")}` : " · Vehicle not added yet";
  return `<div class="delivery-driver">Driver: <strong>${sanitizeText(row.driver_name)}</strong>${vehicle}</div>`;
}

/** Form values for "Book again": same route, goods and weight; new date. */
export function rebookValues(d) {
  return {
    pickupAddress: d.pickup_address || "",
    dropoffAddress: d.dropoff_address || "",
    goodsDescription: d.goods_description || "",
    quantityKg: d.quantity_kg != null ? String(d.quantity_kg) : "",
  };
}

// ---------- Requester dashboard (v4 design) ----------

/** The five delivery stages in order. Cancelled sits outside the line. */
export const STAGES = ["pending", "driver_assigned", "picked_up", "in_transit", "delivered"];
const STAGE_LABELS = ["Waiting", "Driver assigned", "Picked up", "In transit", "Delivered"];

/**
 * The 5-step progress line. Done steps are dim amber, the current step is a
 * taller solid bar, upcoming steps are outlines, so it doesn't rely on colour
 * alone. Screen readers get one label ("Step 4 of 5, In transit"); the bars
 * are hidden from them.
 */
export function renderStageStepper(status) {
  const current = STAGES.indexOf(status);
  if (current < 0) return "";
  const bars = STAGES.map((s, i) => {
    const state = i < current ? "done" : i === current ? "current" : "next";
    return `<span class="rq-step rq-step--${state}${status === "pending" && i === 0 ? " rq-step--waiting" : ""}"></span>`;
  }).join("");
  const labels = STAGE_LABELS.map(
    (l, i) => `<span class="rq-step-label${i === current ? " is-current" : ""}">${l}</span>`,
  ).join("");
  const next = STAGE_LABELS[current + 1];
  const now = status === "pending" ? "Waiting for a driver" : STAGE_LABELS[current];
  return `
    <div class="rq-stepper" role="img" aria-label="Step ${current + 1} of 5, ${now}">
      <div class="rq-stepper-bars" aria-hidden="true">${bars}</div>
      <div class="rq-stepper-labels" aria-hidden="true">${labels}</div>
      <p class="rq-stepper-line" aria-hidden="true"><strong>${now}</strong>${next ? ` · Next: ${next}` : ""}</p>
    </div>`;
}

/** "Ana Reyes" -> "AR"; one name -> one letter; empty -> "?". */
export function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Splits active deliveries into the three Home sections. */
export function groupActive(deliveries) {
  const list = deliveries || [];
  return {
    onRoad: list.filter((d) => d.status === "picked_up" || d.status === "in_transit"),
    assigned: list.filter((d) => d.status === "driver_assigned"),
    waiting: list.filter((d) => d.status === "pending"),
  };
}

/** "1 on the road · 1 driver assigned · 1 waiting · 1 to rate" (zeros left out). */
export function homeSummary({ onRoad = 0, assigned = 0, waiting = 0, toRate = 0 }) {
  return [
    onRoad && `${onRoad} on the road`,
    assigned && `${assigned} driver assigned`,
    waiting && `${waiting} waiting`,
    toRate && `${toRate} to rate`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 3550 -> "₱3,550". */
export function formatPeso(amount) {
  return `₱${Math.round(Number(amount) || 0).toLocaleString("en-PH")}`;
}

/** The fare formula with this booking's numbers, as shown on the quote. */
export function fareBreakdown(distanceKm, quantityKg) {
  return `₱150 base + ${Number(distanceKm).toFixed(1)} km × ₱15 + ${quantityKg} kg × ₱2, rounded. Tolls included.`;
}

/** True when a delivery is still waiting but its pickup date is before today. */
export function pickupPassed(d, today = new Date()) {
  if (!d || d.status !== "pending" || !d.scheduled_pickup_at) return false;
  const pickup = new Date(d.scheduled_pickup_at);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return day(pickup) < day(today);
}

/**
 * Plain words for anything that can go wrong while getting a fare or
 * booking. `field` says which input to put it on ("pickup" / "dropoff"),
 * or null for the message above the button. Never shows error.message.
 */
export function bookingErrorCopy(error) {
  const message = String(error?.message || "");
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed|reach the map/i.test(message)) {
    return { kind: "offline", field: null, message: "No connection. Check your signal and try again. Your details are still here." };
  }
  const notFound = message.match(/Couldn't find "(.*)"/);
  if (notFound) {
    return { kind: "not-found", field: error?.which || "pickup", message: "We couldn't find this address. Add the town and province." };
  }
  if (/no driving route|calculate a route/i.test(message)) {
    return { kind: "no-route", field: "dropoff", message: "No road route from your pickup. Check both addresses." };
  }
  if (/too many requests/i.test(message) || error?.status === 429) {
    return { kind: "rate", field: null, message: "Too many bookings in a minute. Wait a minute, then confirm again. Your details are still here." };
  }
  if (/route distance does not match/i.test(message)) {
    return { kind: "mismatch", field: null, message: "We couldn't confirm the route. Get the fare again, then confirm." };
  }
  return { kind: "unknown", field: null, message: "We couldn't book this. Your details are still here. Try again." };
}

/** Link to the contact form with the booking code filled in. */
export function contactUrl(base, code) {
  return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}

// ---------- Driver dashboard (v4 design) ----------

/** A driver's four stages. Pending isn't theirs yet, so the line starts at Accepted. */
export const DRIVER_STAGES = ["driver_assigned", "picked_up", "in_transit", "delivered"];
const DRIVER_STAGE_LABELS = ["Accepted", "Picked up", "In transit", "Delivered"];
export const ACTIVE_JOB_STATUSES = ["driver_assigned", "picked_up", "in_transit"];
/** Owner rule (2026-10-15); the database enforces it too (0020). */
export const MAX_ACTIVE_JOBS = 2;

/** The 4-step line on a driver's job card; labels show on every screen size. */
export function renderDriverStepper(status) {
  const current = DRIVER_STAGES.indexOf(status);
  if (current < 0) return "";
  const bars = DRIVER_STAGES.map((s, i) => {
    const state = i < current ? "done" : i === current ? "current" : "next";
    return `<span class="rq-step rq-step--${state}"></span>`;
  }).join("");
  const labels = DRIVER_STAGE_LABELS.map(
    (l, i) => `<span class="rq-step-label${i === current ? " is-current" : ""}">${l}</span>`,
  ).join("");
  return `
    <div class="rq-stepper dv-stepper" role="img" aria-label="Step ${current + 1} of 4, ${DRIVER_STAGE_LABELS[current]}">
      <div class="rq-stepper-bars" aria-hidden="true">${bars}</div>
      <div class="rq-stepper-labels" aria-hidden="true">${labels}</div>
    </div>`;
}

/**
 * The one next step for a job, as the big button says it. `done` is the
 * undo line, `saving`/`seen` the snackbar copy. Delivered has no undo: it
 * opens the cash check instead.
 */
export function driverAction(status) {
  return (
    {
      driver_assigned: {
        next: "picked_up",
        label: "I've picked up the load",
        icon: "box",
        done: "Marked picked up",
        saving: "Picked up",
        seen: "Picked up",
      },
      picked_up: {
        next: "in_transit",
        label: "I'm driving to drop-off",
        icon: "truck",
        done: "Marked driving to drop-off",
        saving: "Driving to drop-off",
        seen: "In transit",
      },
      in_transit: {
        next: "delivered",
        label: "I've delivered it",
        icon: "check",
        cashCheck: true,
      },
    }[status] || null
  );
}

/** Jobs still in progress, oldest accepted first. */
export function activeJobs(list) {
  return (list || [])
    .filter((d) => ACTIVE_JOB_STATUSES.includes(d.status))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/**
 * Which job the Home card shows: the one the driver picked if it's still
 * active, else the one on the road (it's moving), else the oldest.
 */
export function pickCurrentJob(active, selectedId) {
  if (!active?.length) return null;
  return (
    active.find((d) => d.id === selectedId) ||
    active.find((d) => d.status === "in_transit" || d.status === "picked_up") ||
    active[0]
  );
}

/** Google Maps directions to a stop. Coordinates win over the typed address. */
export function mapsUrl(lat, lng, address) {
  const destination = lat != null && lng != null ? `${lat},${lng}` : String(address || "");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** "today", "tomorrow" or "Oct 16" for a pickup date; null when not set. */
export function pickupDayLabel(iso, today = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(today)) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** First part of an address: "Marikina Public Market, Marikina" -> "Marikina Public Market". */
export function shortPlace(address) {
  return String(address || "").split(",")[0].trim();
}

/**
 * Plain words for a failed accept or status step. Never shows error.message.
 * kind: offline | rate | cap | gone | unknown.
 */
export function jobErrorCopy(error) {
  const message = String(error?.message || "");
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed/i.test(message)) {
    return { kind: "offline", message: "That didn't save. Check your signal and tap again. Nothing changed on the job." };
  }
  if (/too many requests/i.test(message) || error?.status === 429) {
    return { kind: "rate", message: "Too many tries in a minute. Wait a minute, then try again." };
  }
  if (/2 active jobs/i.test(message)) {
    return { kind: "cap", message: "You have 2 jobs. Finish one to accept more." };
  }
  if (error?.code === "PGRST116" || /multiple \(or no\) rows|no rows/i.test(message)) {
    return { kind: "gone", message: "This job changed. Someone else got it first, or it was cancelled." };
  }
  return { kind: "unknown", message: "That didn't save. Check your signal and tap again. Nothing changed on the job." };
}

/**
 * Why location isn't being shared, from a GeolocationPositionError (or null
 * when the browser has no geolocation at all).
 * blocked = this site isn't allowed; off = the phone's Location is off;
 * weak = no fix in time.
 */
export function locationProblem(error) {
  if (!error) return "unsupported";
  if (error.code === 1) return "blocked";
  if (error.code === 2) return "off";
  return "weak";
}

/** How long the Undo snackbar waits: longer for keyboard users. */
export function undoSeconds(viaKeyboard) {
  return viaKeyboard ? 10 : 8;
}

/** "delivered and paid in cash" / "delivered, not paid" / "delivered" (older jobs). */
export function paymentLine(d) {
  if (d.payment_status === "paid") return "delivered and paid in cash";
  if (d.payment_status === "unpaid") return "delivered, not paid. Sakada is following up";
  return "delivered";
}
```

## 11. Replace `sakada-web/tests/dashboard-shared.test.js` with:
```js
import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

// Mock the notifications module (it imports from https URLs)
vi.mock("../js/notifications.js", () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

// Inject into global so sanitize.js can use it (same as sanitize.test.js)
globalThis.DOMPurify = DOMPurify(new JSDOM("").window);

import {
  statusLabel,
  timeAgo,
  HISTORY_STATUSES,
  renderRatingBlock,
  isQuoteStale,
  renderDriverLine,
  rebookValues,
} from "../js/dashboard-shared.js";

describe("HISTORY_STATUSES", () => {
  it("contains delivered and cancelled", () => {
    expect(HISTORY_STATUSES).toContain("delivered");
    expect(HISTORY_STATUSES).toContain("cancelled");
  });

  it("does not contain active statuses", () => {
    expect(HISTORY_STATUSES).not.toContain("pending");
    expect(HISTORY_STATUSES).not.toContain("driver_assigned");
    expect(HISTORY_STATUSES).not.toContain("picked_up");
    expect(HISTORY_STATUSES).not.toContain("in_transit");
  });
});

describe("statusLabel", () => {
  it("returns human-readable labels for all known statuses", () => {
    expect(statusLabel("pending")).toBe("Pending");
    expect(statusLabel("driver_assigned")).toBe("Driver Assigned");
    expect(statusLabel("picked_up")).toBe("Picked Up");
    expect(statusLabel("in_transit")).toBe("In Transit");
    expect(statusLabel("delivered")).toBe("Delivered");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });

  it("returns the raw status for unknown values", () => {
    expect(statusLabel("unknown_status")).toBe("unknown_status");
    expect(statusLabel("")).toBe("");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("2d ago");
  });

  it("handles exactly 1 minute", () => {
    const d = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1m ago");
  });

  it("handles exactly 1 hour", () => {
    const d = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1h ago");
  });

  it("handles exactly 1 day", () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1d ago");
  });
});

describe("renderRatingBlock", () => {
  const delivered = {
    id: "delivery-1",
    status: "delivered",
    driver_id: "driver-123",
    requester_id: "requester-456",
  };

  it("rates the requester when the viewer is the driver", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated the requester",
      "driver-123",
    );
    expect(html).toContain('data-other-user-id="requester-456"');
  });

  it("rates the driver when the viewer is the requester", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated this delivery",
      "requester-456",
    );
    expect(html).toContain('data-other-user-id="driver-123"');
  });
});

describe("isQuoteStale", () => {
  const quote = {
    pickupAddress: "La Trinidad, Benguet",
    dropoffAddress: "Baguio City",
    quantityKg: 400,
  };

  it("returns false when the form matches the quote (addresses trimmed)", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "  La Trinidad, Benguet  ",
        dropoffAddress: " Baguio City ",
        quantityKg: "400",
      }),
    ).toBe(false);
  });

  it("returns true when the pickup changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "Bugallon, Pangasinan",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the drop-off changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Dagupan City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the load changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "500",
      }),
    ).toBe(true);
  });

  it("returns true when there is no quote", () => {
    expect(
      isQuoteStale(null, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });
});

describe("renderDriverLine", () => {
  it("returns an empty string without a driver or a name", () => {
    expect(renderDriverLine(undefined)).toBe("");
    expect(renderDriverLine({ driver_name: null })).toBe("");
  });

  it("shows name, vehicle type and plate", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: "Isuzu Elf",
      vehicle_plate: "NBC 1234",
    });
    expect(html).toContain("Juan Dela Cruz");
    expect(html).toContain("Isuzu Elf · NBC 1234");
    expect(html).toContain('class="delivery-driver"');
  });

  it("says the vehicle isn't added yet when both fields are missing", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).toContain("Vehicle not added yet");
  });

  it("sanitizes the driver name", () => {
    const html = renderDriverLine({
      driver_name: "<img src=x onerror=alert(1)>Ana",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).not.toContain("<img");
  });
});

describe("rebookValues", () => {
  it("copies route, goods and weight, stringifying the weight", () => {
    expect(
      rebookValues({
        pickup_address: "A",
        dropoff_address: "B",
        goods_description: "Eggplant",
        quantity_kg: 500,
      }),
    ).toEqual({
      pickupAddress: "A",
      dropoffAddress: "B",
      goodsDescription: "Eggplant",
      quantityKg: "500",
    });
  });

  it("turns missing fields into empty strings", () => {
    expect(rebookValues({})).toEqual({
      pickupAddress: "",
      dropoffAddress: "",
      goodsDescription: "",
      quantityKg: "",
    });
  });
});

import {
  renderStageStepper,
  initialsFor,
  groupActive,
  homeSummary,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  bookingErrorCopy,
  contactUrl,
} from "../js/dashboard-shared.js";

describe("renderStageStepper", () => {
  it("labels the current step for screen readers", () => {
    const html = renderStageStepper("in_transit");
    expect(html).toContain('aria-label="Step 4 of 5, In transit"');
    expect(html.match(/rq-step--done/g)).toHaveLength(3);
    expect(html.match(/rq-step--current/g)).toHaveLength(1);
    expect(html).toContain("Next: Delivered");
  });
  it("shows Pending as waiting, not as progress", () => {
    const html = renderStageStepper("pending");
    expect(html).toContain("Step 1 of 5, Waiting for a driver");
    expect(html).toContain("rq-step--waiting");
  });
  it("draws nothing for cancelled", () => {
    expect(renderStageStepper("cancelled")).toBe("");
  });
});

describe("initialsFor", () => {
  it("uses first and last name", () => expect(initialsFor("Ana Maria Reyes")).toBe("AR"));
  it("handles one name and blanks", () => {
    expect(initialsFor("carlo")).toBe("C");
    expect(initialsFor("  ")).toBe("?");
  });
});

describe("groupActive and homeSummary", () => {
  const list = [
    { status: "pending" },
    { status: "driver_assigned" },
    { status: "picked_up" },
    { status: "in_transit" },
  ];
  it("splits active deliveries into Home sections", () => {
    const g = groupActive(list);
    expect(g.onRoad).toHaveLength(2);
    expect(g.assigned).toHaveLength(1);
    expect(g.waiting).toHaveLength(1);
  });
  it("leaves zeros out of the summary", () => {
    expect(homeSummary({ onRoad: 1, waiting: 2 })).toBe("1 on the road · 2 waiting");
    expect(homeSummary({})).toBe("");
  });
});

describe("formatPeso and fareBreakdown", () => {
  it("formats pesos", () => expect(formatPeso(3550)).toBe("₱3,550"));
  it("shows the real distance", () =>
    expect(fareBreakdown(118.43, 800)).toBe("₱150 base + 118.4 km × ₱15 + 800 kg × ₱2, rounded. Tolls included."));
});

describe("pickupPassed", () => {
  const today = new Date(2026, 9, 17);
  it("is true for a waiting delivery whose date is before today", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-16T00:00:00" }, today)).toBe(true);
  });
  it("is false for today, for other statuses, and with no date", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-17T08:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "driver_assigned", scheduled_pickup_at: "2026-10-10T00:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: null }, today)).toBe(false);
  });
});

describe("bookingErrorCopy", () => {
  it("maps each known error to plain words", () => {
    expect(bookingErrorCopy({ message: 'Couldn\'t find "San Roque". Try adding a city or province.', which: "pickup" })).toMatchObject({ kind: "not-found", field: "pickup" });
    expect(bookingErrorCopy({ message: "No driving route found between those two points." })).toMatchObject({ kind: "no-route", field: "dropoff" });
    expect(bookingErrorCopy({ message: "Too many requests. Please wait a minute and try again." }).kind).toBe("rate");
    expect(bookingErrorCopy({ message: "The route distance does not match the pickup and drop-off locations." }).kind).toBe("mismatch");
    expect(bookingErrorCopy(new TypeError("Failed to fetch")).kind).toBe("offline");
  });
  it("never passes the raw message through", () => {
    expect(bookingErrorCopy({ message: "duplicate key value violates unique constraint" }).message).not.toMatch(/duplicate/);
  });
});

describe("contactUrl", () => {
  it("adds the booking code", () =>
    expect(contactUrl("../../pages/contact.html", "SK-00003")).toBe("../../pages/contact.html?code=SK-00003"));
  it("leaves the link alone without a code", () =>
    expect(contactUrl("../../pages/contact.html", "")).toBe("../../pages/contact.html"));
});

describe("driver dashboard helpers", () => {
  it("renderDriverStepper: 4 steps with the current one marked", async () => {
    const { renderDriverStepper } = await import("../js/dashboard-shared.js");
    const html = renderDriverStepper("picked_up");
    expect(html).toContain('aria-label="Step 2 of 4, Picked up"');
    expect(html.match(/rq-step--done/g)).toHaveLength(1);
    expect(html.match(/rq-step--next/g)).toHaveLength(2);
    expect(renderDriverStepper("pending")).toBe("");
  });

  it("driverAction: the next step per status; delivered opens the cash check", async () => {
    const { driverAction } = await import("../js/dashboard-shared.js");
    expect(driverAction("driver_assigned")).toMatchObject({ next: "picked_up", label: "I've picked up the load" });
    expect(driverAction("picked_up")).toMatchObject({ next: "in_transit", seen: "In transit" });
    expect(driverAction("in_transit")).toMatchObject({ next: "delivered", cashCheck: true });
    expect(driverAction("delivered")).toBeNull();
  });

  it("activeJobs + pickCurrentJob: keeps the picked job, else the moving one", async () => {
    const { activeJobs, pickCurrentJob } = await import("../js/dashboard-shared.js");
    const list = [
      { id: "b", status: "in_transit", created_at: "2026-10-14T02:00:00Z" },
      { id: "a", status: "driver_assigned", created_at: "2026-10-14T01:00:00Z" },
      { id: "c", status: "delivered", created_at: "2026-10-13T01:00:00Z" },
    ];
    const active = activeJobs(list);
    expect(active.map((d) => d.id)).toEqual(["a", "b"]);
    expect(pickCurrentJob(active, null).id).toBe("b");
    expect(pickCurrentJob(active, "a").id).toBe("a");
    expect(pickCurrentJob(active, "gone").id).toBe("b");
    expect(pickCurrentJob([], null)).toBeNull();
  });

  it("mapsUrl prefers coordinates", async () => {
    const { mapsUrl } = await import("../js/dashboard-shared.js");
    expect(mapsUrl(14.65, 121.1, "Marikina")).toBe("https://www.google.com/maps/dir/?api=1&destination=14.65%2C121.1");
    expect(mapsUrl(null, null, "Gapan City")).toContain("destination=Gapan%20City");
  });

  it("pickupDayLabel: today, tomorrow, a date, or null", async () => {
    const { pickupDayLabel } = await import("../js/dashboard-shared.js");
    const today = new Date(2026, 9, 15, 9);
    expect(pickupDayLabel(new Date(2026, 9, 15, 0).toISOString(), today)).toBe("today");
    expect(pickupDayLabel(new Date(2026, 9, 16, 0).toISOString(), today)).toBe("tomorrow");
    expect(pickupDayLabel(new Date(2026, 9, 20, 0).toISOString(), today)).toBe("Oct 20");
    expect(pickupDayLabel(null, today)).toBeNull();
  });

  it("shortPlace keeps the first part", async () => {
    const { shortPlace } = await import("../js/dashboard-shared.js");
    expect(shortPlace("Marikina Public Market, Marikina")).toBe("Marikina Public Market");
    expect(shortPlace("")).toBe("");
  });

  it("jobErrorCopy maps errors to plain words", async () => {
    const { jobErrorCopy } = await import("../js/dashboard-shared.js");
    expect(jobErrorCopy({ message: "Too many requests. Please wait a minute and try again." }).kind).toBe("rate");
    expect(jobErrorCopy({ message: "You already have 2 active jobs. Finish one to accept more." }).kind).toBe("cap");
    expect(jobErrorCopy({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }).kind).toBe("gone");
    expect(jobErrorCopy({ message: "TypeError: Failed to fetch" }).kind).toBe("offline");
    const unknown = jobErrorCopy({ message: "permission denied for table deliveries" });
    expect(unknown.kind).toBe("unknown");
    expect(unknown.message).not.toContain("permission");
  });

  it("locationProblem reads the geolocation error code", async () => {
    const { locationProblem } = await import("../js/dashboard-shared.js");
    expect(locationProblem(null)).toBe("unsupported");
    expect(locationProblem({ code: 1 })).toBe("blocked");
    expect(locationProblem({ code: 2 })).toBe("off");
    expect(locationProblem({ code: 3 })).toBe("weak");
  });

  it("undoSeconds gives keyboard users longer", async () => {
    const { undoSeconds } = await import("../js/dashboard-shared.js");
    expect(undoSeconds(false)).toBe(8);
    expect(undoSeconds(true)).toBe(10);
  });

  it("paymentLine says whether the receiver paid", async () => {
    const { paymentLine } = await import("../js/dashboard-shared.js");
    expect(paymentLine({ payment_status: "paid" })).toBe("delivered and paid in cash");
    expect(paymentLine({ payment_status: "unpaid" })).toMatch(/not paid/);
    expect(paymentLine({ payment_status: null })).toBe("delivered");
  });
});
```

## 12. Replace `sakada-web/e2e/support/mock-supabase.mjs` with:
```js
// A fake Supabase for e2e tests, so the dashboards can load without a real
// account. It signs a fixture user in (the session supabase-js reads from
// localStorage) and answers auth, PostgREST and RPC calls from in-memory
// tables. Writes (PATCH/POST) change those tables, so a test can click
// Cancel or Accept and see the result. Realtime is silenced.
//
// Supports only the PostgREST bits the app uses: eq., neq., is.null and
// in.(...) filters, plus .single() / .maybeSingle().

const PROJECT_REF = "aeeniueayubeugvooyqj"; // must match js/config.js
const NOW = "2026-10-14T09:00:00.000Z";

export const IDS = {
  farmer: "00000000-0000-4000-8000-00000000f001",
  vendor: "00000000-0000-4000-8000-00000000f002",
  driver: "00000000-0000-4000-8000-00000000d001",
  admin: "00000000-0000-4000-8000-00000000a001",
};

const NAMES = {
  farmer: "Ana Reyes",
  vendor: "Ben Cruz",
  driver: "Carlo Santos",
  admin: "Dina Admin",
};

function delivery(n, status, extra = {}) {
  return {
    id: `00000000-0000-4000-8000-0000000de${String(n).padStart(3, "0")}`,
    delivery_code: `SK-${String(n).padStart(5, "0")}`,
    requester_id: IDS.farmer,
    driver_id: status === "pending" ? null : IDS.driver,
    pickup_address: "Cabanatuan City, Nueva Ecija",
    pickup_lat: 15.4865,
    pickup_lng: 120.9667,
    dropoff_address: "Marikina Public Market, Marikina",
    dropoff_lat: 14.6507,
    dropoff_lng: 121.1029,
    goods_description: "Eggplant, 32 crates",
    quantity_kg: 800,
    scheduled_pickup_at: "2026-10-15T00:00:00.000Z",
    notes: null,
    estimated_cost: 3550,
    distance_km: 120,
    status,
    payment_status: null,
    current_lat: status === "in_transit" || status === "picked_up" ? 15.1 : null,
    current_lng: status === "in_transit" || status === "picked_up" ? 121.0 : null,
    created_at: `2026-10-${String(10 + (n % 5)).padStart(2, "0")}T0${n % 9}:00:00.000Z`,
    updated_at: NOW,
    ...extra,
  };
}

/** Fresh tables for one test. Pass overrides to change any table. */
export function fixtures(overrides = {}) {
  const profiles = Object.entries(IDS).map(([role, id]) => ({
    id,
    role,
    full_name: NAMES[role],
    phone: null,
    avatar_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: NOW,
  }));
  const deliveries = [
    delivery(1, "pending"),
    delivery(2, "driver_assigned"),
    delivery(3, "in_transit", { notes: "Receiver is at stall 14. Ask for Aling Bebeng." }),
    delivery(4, "delivered"),
    delivery(5, "cancelled", { driver_id: null }),
    delivery(6, "pending", { requester_id: IDS.vendor, goods_description: "Tomatoes, 40 crates", quantity_kg: 600, estimated_cost: 2550 }),
  ];
  return {
    profiles,
    deliveries,
    driver_profiles: [{ id: IDS.driver, vehicle_type: "6-wheeler truck", vehicle_plate: "NBC 1234", is_available: true }],
    notifications: [
      {
        id: "00000000-0000-4000-8000-0000000c0001",
        user_id: IDS.farmer,
        delivery_id: deliveries[2].id,
        message: "Your delivery SK-00003 is now In Transit.",
        is_read: false,
        created_at: NOW,
      },
    ],
    ratings: [],
    contact_submissions: [],
    ...overrides,
  };
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    const value = row[key];
    if (raw.startsWith("eq.")) {
      if (String(value) !== raw.slice(3)) return false;
    } else if (raw.startsWith("neq.")) {
      if (String(value) === raw.slice(4)) return false;
    } else if (raw === "is.null") {
      if (value !== null && value !== undefined) return false;
    } else if (raw.startsWith("in.(")) {
      const list = raw.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      if (!list.includes(String(value))) return false;
    }
  }
  return true;
}

function rpcResult(name, db, userId) {
  if (name === "get_my_delivery_drivers") {
    return db.deliveries
      .filter((d) => d.requester_id === userId && d.driver_id)
      .map((d) => ({
        delivery_id: d.id,
        driver_name: NAMES.driver,
        vehicle_type: db.driver_profiles[0]?.vehicle_type ?? null,
        vehicle_plate: db.driver_profiles[0]?.vehicle_plate ?? null,
      }));
  }
  return null; // update_my_last_login and anything else: no content
}

/**
 * Sign `role` in and fake Supabase for this page. Returns the live tables
 * (`db`) so a test can inspect them after a write.
 */
export async function mockSupabase(page, role, overrides = {}) {
  const db = fixtures(overrides);
  const userId = IDS[role];
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: `${role}@example.com`,
    app_metadata: { provider: "email" },
    user_metadata: { full_name: NAMES[role], role },
    identities: [],
    created_at: "2026-09-01T00:00:00.000Z",
  };
  const session = {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  await page.addInitScript(
    ([key, value, r]) => {
      localStorage.setItem(key, value);
      localStorage.setItem("sakada.role", r);
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session), role],
  );

  await page.routeWebSocket(/\/realtime\/v1\//, () => {}); // never connects, never errors
  // Mapbox: geocoding echoes the query as a Philippine place, directions
  // returns 118.4 km, and static map images are a 1x1 PNG.
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/geocoding/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop().replace(/\.json$/, ""));
      if (/nowhere/i.test(query)) return route.fulfill({ json: { features: [] } });
      return route.fulfill({ json: { features: [{ center: [121.0, 14.6], place_name: `${query}, Philippines` }] } });
    }
    if (url.pathname.startsWith("/directions/")) {
      return route.fulfill({ json: { routes: [{ distance: 118400 }] } });
    }
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });
  await page.route(`https://${PROJECT_REF}.supabase.co/auth/v1/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ json: session });
  });
  await page.route(`https://${PROJECT_REF}.supabase.co/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const params = [...url.searchParams.entries()];
    const wantsOne = (req.headers()["accept"] || "").includes("vnd.pgrst.object");

    if (path.startsWith("rpc/")) {
      const result = rpcResult(path.slice(4), db, userId);
      return result === null ? route.fulfill({ status: 204, body: "" }) : route.fulfill({ json: result });
    }

    const table = db[path];
    if (!table) return route.fulfill({ status: 404, json: { message: `no table ${path}` } });

    let rows;
    if (req.method() === "GET" || req.method() === "HEAD") {
      rows = table.filter((r) => matches(r, params));
    } else if (req.method() === "PATCH") {
      const patch = req.postDataJSON();
      rows = table.filter((r) => matches(r, params));
      // 0020: a driver holds at most 2 active jobs.
      if (path === "deliveries" && patch.status === "driver_assigned") {
        const held = table.filter(
          (r) => r.driver_id === patch.driver_id && ["driver_assigned", "picked_up", "in_transit"].includes(r.status),
        ).length;
        if (held >= 2) {
          return route.fulfill({ status: 400, json: { code: "P0001", message: "You already have 2 active jobs. Finish one to accept more." } });
        }
      }
      rows.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
    } else if (req.method() === "POST") {
      const body = req.postDataJSON();
      rows = (Array.isArray(body) ? body : [body]).map((r, i) => ({
        id: `00000000-0000-4000-8000-0000000e${String(table.length + i).padStart(4, "0")}`,
        created_at: new Date().toISOString(),
        // the database defaults a new delivery gets
        ...(path === "deliveries"
          ? { delivery_code: `SK-${String(table.length + i + 1).padStart(5, "0")}`, status: "pending", driver_id: null, updated_at: NOW }
          : {}),
        ...r,
      }));
      table.push(...rows);
    } else {
      rows = [];
    }

    const headers = { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
    if (wantsOne) {
      if (rows.length !== 1) {
        return route.fulfill({ status: 406, headers, json: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
      }
      return route.fulfill({ headers, json: rows[0] });
    }
    return route.fulfill({ headers, json: rows });
  });

  return db;
}
```

## 13. Replace `sakada-web/e2e/dashboards.spec.mjs` with:
```js
// Dashboards load with a fake signed-in user (e2e/support/mock-supabase.mjs).
// These are the safety net for the dashboard redesign: each page loads with
// no errors and shows its real data.
import { test, expect } from "@playwright/test";
import { mockSupabase, fixtures, IDS } from "./support/mock-supabase.mjs";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

// The driver holds one job (SK-00002, accepted); SK-00001 and SK-00006 are open.
const oneJob = () => fixtures().deliveries.filter((d) => d.delivery_code !== "SK-00003");
const PHONE = { width: 390, height: 844 }; // the next-step bar is phone-only
const code = (db, c) => db.deliveries.find((d) => d.delivery_code === c);

test.describe("dashboards (fake sign-in)", () => {
  test("farmer sees their deliveries grouped by stage", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ana");
    const home = page.locator("#homeLists");
    const section = (name) => home.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(section("On the road")).toContainText("SK-00003");
    await expect(section("Driver assigned")).toContainText("SK-00002");
    await expect(section("Waiting for a driver")).toContainText("SK-00001");
    await expect(section("Rate your driver")).toContainText("SK-00004");
    await expect(home).not.toContainText("SK-00006"); // the vendor's
    await expect(page.getByRole("img", { name: /Step 4 of 5/ })).toBeVisible();
    await page.goto("/dashboard/farmer/index.html#history");
    await expect(page.locator("#historyList")).toContainText("SK-00004");
    await expect(page.locator("#historyList")).toContainText("SK-00005");
    expect(errors).toEqual([]);
  });

  test("farmer can cancel a delivery that is still waiting", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const card = page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00001" });
    await card.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("vendor sees only their own deliveries", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "vendor");
    await page.goto("/dashboard/vendor/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ben");
    await expect(page.locator("#homeLists")).toContainText("SK-00006");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
    expect(errors).toEqual([]);
  });

  test("farmer books a truck: fare first, then confirm", async ({ page }) => {
    const errors = trackErrors(page);
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "Cabanatuan City, Nueva Ecija");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#quoteAmount")).toHaveText("₱3,526"); // 150 + 118.4 km × 15 + 800 kg × 2
    expect(db.deliveries).toHaveLength(6); // nothing booked until confirm
    await page.locator("#confirmBtn").click();
    await expect(page.locator("#bookedBanner")).toBeVisible();
    expect(db.deliveries).toHaveLength(7);
    expect(db.deliveries[6]).toMatchObject({ goods_description: "Eggplant, 32 crates", quantity_kg: 800 });
    await expect(
      page.locator("#homeLists section").filter({ has: page.getByRole("heading", { name: "Waiting for a driver" }) }),
    ).toContainText("SK-00007");
    expect(errors).toEqual([]);
  });

  test("an address Mapbox can't find gets a plain error and no fare", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "nowhere");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#pickupAddressError")).toHaveText("We couldn't find this address. Add the town and province.");
    await expect(page.locator("#pickupAddress")).toBeFocused();
    await expect(page.locator("#quote")).toBeHidden();
  });

  test("on a phone the tabs switch views and the landing link opens Book", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#deliveryForm");
    await expect(page.locator("#deliveryForm")).toBeVisible();
    const tabs = page.locator(".rq-tabs");
    await tabs.getByRole("link", { name: "History" }).click();
    await expect(page.locator("#historyList")).toBeVisible();
    await expect(page.locator("#deliveryForm")).toBeHidden();
    await tabs.getByRole("link", { name: "Home" }).click();
    await expect(page.locator("#homeLists")).toBeVisible();
  });

  test("a notification opens its delivery", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await page.locator("[data-open-notifs]").first().click();
    await expect(page.locator("#notifSheet")).toBeVisible();
    await page.locator("#notifList").getByText("SK-00003").click();
    await expect(page.locator("#notifSheet")).toBeHidden();
    await expect(page.locator("[data-delivery-id]", { hasText: "SK-00003" })).toBeFocused();
    await expect.poll(() => db.notifications[0].is_read).toBe(true);
  });

  test("driver sees their 2 jobs, the cap on new jobs and their vehicle", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("2 jobs in progress");
    await expect(page.locator(".dv-job")).toContainText("SK-00003"); // on the road, so it's shown first
    await expect(page.locator(".dv-job")).toContainText("Receiver is at stall 14");
    await expect(page.getByRole("img", { name: "Step 3 of 4, In transit" })).toBeVisible();
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("#jobsList")).toContainText("SK-00001");
    await expect(page.locator("#jobsMessage")).toContainText("You have 2 jobs");
    await expect(page.locator("[data-accept-id]")).toHaveCount(0); // Accept is off at the cap
    await page.goto("/dashboard/driver/index.html#profile");
    await expect(page.locator("#vehicleType")).toHaveValue("6-wheeler truck");
    expect(errors).toEqual([]);
  });

  test("driver marks picked up; it saves after the Undo time", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.clock.install();
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html");
    const bar = page.locator("#actionBar");
    await bar.getByRole("button", { name: "I've picked up the load" }).click();
    await expect(page.locator("#snackbar")).toContainText("Marked picked up");
    expect(code(db, "SK-00002").status).toBe("driver_assigned"); // not yet: Undo is still open
    await page.clock.runFor(9000);
    await expect.poll(() => code(db, "SK-00002").status).toBe("picked_up");
    await expect(page.locator("#snackbar")).toContainText('The sender sees "Picked up"');
    await expect(bar.getByRole("button", { name: "I'm driving to drop-off" })).toBeVisible();
  });

  test("Undo leaves the job as it was", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.clock.install();
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html");
    await page.locator("#actionBar").getByRole("button", { name: "I've picked up the load" }).click();
    await page.locator("#snackbar").getByRole("button", { name: "Undo" }).click();
    await page.clock.runFor(12000);
    expect(code(db, "SK-00002").status).toBe("driver_assigned");
    await expect(page.locator("#actionBar").getByRole("button", { name: "I've picked up the load" })).toBeVisible();
  });

  test("delivered without payment closes the job and flags it Unpaid", async ({ page }) => {
    await page.setViewportSize(PHONE);
    const db = await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await page.locator("#actionBar").getByRole("button", { name: "I've delivered it" }).click();
    const sheet = page.locator("#deliveredSheet");
    await expect(sheet).toContainText("₱3,550 in cash?");
    await sheet.getByRole("button", { name: "Delivered, not paid" }).click();
    await expect.poll(() => code(db, "SK-00003").status).toBe("delivered");
    expect(code(db, "SK-00003").payment_status).toBe("unpaid");
    await expect(page.locator(".dv-rated")).toContainText("Marked Unpaid");
    await page.goto("/dashboard/driver/index.html#history");
    await expect(page.locator("#historyList [data-delivery-id]", { hasText: "SK-00003" })).toContainText("Unpaid");
  });

  test("driver accepts a job after a confirm", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    await expect(page.locator("#acceptSheet")).toContainText("Once you accept, only Sakada can cancel it.");
    await page.locator("#acceptConfirm").click();
    await expect.poll(() => code(db, "SK-00001").status).toBe("driver_assigned");
    expect(code(db, "SK-00001").driver_id).toBe(IDS.driver);
    await expect(page.locator("#homeTitle")).toHaveText("2 jobs in progress");
    await expect(page.locator(".dv-job")).toContainText("SK-00001");
  });

  test("a job someone else took shows 'no longer available'", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    Object.assign(code(db, "SK-00001"), { status: "driver_assigned", driver_id: "someone-else" });
    await page.locator("#acceptConfirm").click();
    await expect(page.locator("#jobsMessage")).toContainText("This job is no longer available");
    await expect(page.locator("#jobsList")).not.toContainText("SK-00001");
  });

  test("the database's 2-job rule shows in plain words", async ({ page }) => {
    const db = await mockSupabase(page, "driver", { deliveries: oneJob() });
    await page.goto("/dashboard/driver/index.html#jobs");
    await page.locator("[data-offer-id]", { hasText: "SK-00001" }).getByRole("button", { name: "Accept job" }).click();
    Object.assign(code(db, "SK-00006"), { status: "driver_assigned", driver_id: IDS.driver }); // took one on another phone
    await page.locator("#acceptConfirm").click();
    await expect(page.locator("#jobsMessage")).toContainText("You have 2 jobs");
    expect(code(db, "SK-00001").status).toBe("pending");
  });

  test("a new driver adds their vehicle before accepting", async ({ page }) => {
    const db = await mockSupabase(page, "driver", {
      deliveries: fixtures().deliveries.filter((d) => d.status === "pending"),
      driver_profiles: [{ id: IDS.driver, vehicle_type: null, vehicle_plate: null, is_available: true }],
    });
    await page.goto("/dashboard/driver/index.html");
    await expect(page.getByRole("heading", { name: "Add your vehicle" })).toBeVisible();
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("#jobsMessage")).toContainText("Add your vehicle first");
    await expect(page.locator("[data-accept-id]")).toHaveCount(0);
    await page.goto("/dashboard/driver/index.html#profile");
    await page.fill("#vehicleType", "Isuzu Elf");
    await page.fill("#vehiclePlate", "abc 123");
    await page.locator("#vehicleSaveBtn").click();
    await expect(page.locator("#snackbar")).toContainText("Vehicle saved");
    expect(db.driver_profiles[0].vehicle_plate).toBe("ABC 123");
    await page.goto("/dashboard/driver/index.html#jobs");
    await expect(page.locator("[data-accept-id]").first()).toBeVisible();
  });

  test("admin sees the stats and the deliveries table", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "admin");
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#userName")).toHaveText("Dina Admin");
    await expect(page.getByRole("cell", { name: "SK-00001" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("admin sees deliveries the receiver didn't pay for", async ({ page }) => {
    const deliveries = fixtures().deliveries;
    Object.assign(deliveries[3], { payment_status: "unpaid" }); // SK-00004, delivered
    await mockSupabase(page, "admin", { deliveries });
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#statUnpaid")).toHaveText("1");
    await expect(page.getByRole("row", { name: /SK-00004/ })).toContainText("Unpaid");
  });

  test("a farmer opening the driver dashboard is sent home", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/driver/index.html");
    await expect(page).toHaveURL(/\/index(\.html)?$|\/$/);
  });
});
```

## 14. Checks (from `sakada-web/`)
```
npm run lint         # no errors
npx vitest run       # 143 passed
npm run test:e2e     # 65 passed
```
If a check fails, stop and paste the output. Don't "fix" the code.
