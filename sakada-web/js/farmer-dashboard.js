import { sanitizeText } from "./sanitize.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  estimateCost,
  staticMapUrl,
} from "./mapbox-client.js";
import {
  createDelivery,
  getMyDeliveries,
  subscribeToDeliveryUpdates,
} from "./deliveries.js";
import { submitRating, getMyRatingsForDeliveries } from "./ratings.js";
import {
  statusLabel,
  HISTORY_STATUSES,
  renderRatingBlock,
  wireRatingControls,
  setupNotifications,
} from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";

const profile = await requireRole(
  "farmer",
  "../auth/login.html",
  "../index.html",
);
if (!profile) throw new Error("redirecting");

document.getElementById("pageLoader")?.classList.add("page-loader--hidden");
initOfflineDetection();
updateLastLogin();

document.getElementById("userName").textContent = profile.full_name;
document.getElementById("greeting").textContent =
  `Welcome, ${profile.full_name.split(" ")[0]}.`;

document
  .getElementById("signOutBtn")
  .addEventListener("click", () => signOut("../index.html"));

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}
function clearMessage() {
  messageEl.className = "form-message";
}

const form = document.getElementById("deliveryForm");
const estimateBtn = document.getElementById("estimateBtn");
const costPreview = document.getElementById("costPreview");
const confirmBtn = document.getElementById("confirmBtn");

let pendingQuote = null;

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (getIsOffline()) {
    toastError("Can't estimate — you're offline");
    return;
  }
  clearMessage();
  costPreview.classList.remove("visible");
  estimateBtn.disabled = true;
  estimateBtn.innerHTML = '<span class="spinner"></span>Calculating…';

  try {
    const pickupAddress = document
      .getElementById("pickupAddress")
      .value.trim();
    const dropoffAddress = document
      .getElementById("dropoffAddress")
      .value.trim();
    const quantityKg = parseFloat(
      document.getElementById("quantityKg").value,
    );

    const [pickup, dropoff] = await Promise.all([
      geocodeAddress(pickupAddress),
      geocodeAddress(dropoffAddress),
    ]);

    const distanceKm = await getDrivingDistanceKm(pickup, dropoff);
    const cost = estimateCost(distanceKm, quantityKg);

    pendingQuote = {
      pickupAddress,
      dropoffAddress,
      pickup,
      dropoff,
      distanceKm,
      quantityKg,
      cost,
    };

    document.getElementById("costDistance").textContent =
      `${distanceKm.toFixed(1)} km driving distance`;
    document.getElementById("costAmount").textContent =
      `₱${cost.toLocaleString()}`;
    costPreview.classList.add("visible");
  } catch (err) {
    showMessage(err.message, "error");
    toastError(err.message);
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.textContent = "Get Estimated Cost";
  }
});

confirmBtn.addEventListener("click", async () => {
  if (!pendingQuote) return;
  if (getIsOffline()) {
    toastError("Can't book — you're offline");
    return;
  }
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span class="spinner"></span>Booking…';

  const goodsDescription = document
    .getElementById("goodsDescription")
    .value.trim();
  const scheduledPickup =
    document.getElementById("scheduledPickup").value;
  const notes = document.getElementById("notes").value.trim();

  const { error } = await createDelivery({
    requester_id: profile.id,
    pickup_address: pendingQuote.pickupAddress,
    pickup_lat: pendingQuote.pickup.lat,
    pickup_lng: pendingQuote.pickup.lng,
    dropoff_address: pendingQuote.dropoffAddress,
    dropoff_lat: pendingQuote.dropoff.lat,
    dropoff_lng: pendingQuote.dropoff.lng,
    goods_description: goodsDescription,
    quantity_kg: pendingQuote.quantityKg,
    scheduled_pickup_at: scheduledPickup
      ? new Date(scheduledPickup).toISOString()
      : null,
    notes: notes || null,
    estimated_cost: pendingQuote.cost,
  });

  confirmBtn.disabled = false;
  confirmBtn.textContent = "Confirm Delivery";

  if (error) {
    showMessage(error.message, "error");
    toastError("Booking failed: " + error.message);
    return;
  }

  showMessage(
    "Delivery booked! Waiting for a driver to accept.",
    "success",
  );
  toastSuccess("Delivery booked — waiting for a driver");
  form.reset();
  costPreview.classList.remove("visible");
  pendingQuote = null;
  loadDeliveries();
});

const activeSubscriptions = new Map();

function renderMapBlock(d) {
  const isTrackable =
    (d.status === "picked_up" || d.status === "in_transit") &&
    d.current_lat &&
    d.current_lng;
  if (!isTrackable) return "";
  return `
    <div class="tracking-map-wrap">
      <img id="map-${d.id}" src="${staticMapUrl(d.current_lat, d.current_lng)}" alt="Current driver location" />
    </div>
    <div class="tracking-map-caption" id="map-caption-${d.id}">Live location — updates automatically</div>
  `;
}

function renderSkeletons(count = 2) {
  return Array.from({ length: count }, () => `
    <div class="skeleton skeleton--card">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div class="skeleton__line skeleton__line--title"></div>
        <div class="skeleton__line skeleton__line--badge"></div>
      </div>
      <div class="skeleton__line skeleton__line--text"></div>
      <div class="skeleton__line skeleton__line--text" style="width:60%"></div>
    </div>
  `).join("");
}

async function loadDeliveries() {
  const activeEl = document.getElementById("activeDeliveryList");
  const historyEl = document.getElementById("historyDeliveryList");
  activeEl.innerHTML = renderSkeletons();
  historyEl.innerHTML = renderSkeletons(1);

  const { data, error } = await getMyDeliveries(profile.id);

  if (error) {
    activeEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <p class="empty-state__title">Couldn't load deliveries</p>
        <p class="empty-state__desc">${sanitizeText(error.message)}</p>
      </div>`;
    historyEl.innerHTML = "";
    toastError("Failed to load deliveries");
    return;
  }

  const active = (data || []).filter(
    (d) => !HISTORY_STATUSES.includes(d.status),
  );
  const history = (data || []).filter((d) =>
    HISTORY_STATUSES.includes(d.status),
  );

  activeEl.innerHTML = active.length
    ? active
        .map(
          (d) => `
        <div class="delivery-card">
          <div class="delivery-card-top">
            <span class="delivery-code">${sanitizeText(d.delivery_code)}</span>
            <span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>
          </div>
          <div class="delivery-route">${sanitizeText(d.pickup_address)} → ${sanitizeText(d.dropoff_address)}</div>
          <div class="delivery-meta">${sanitizeText(d.goods_description)} · ${d.quantity_kg} kg · ₱${Number(d.estimated_cost).toLocaleString()}</div>
          ${renderMapBlock(d)}
        </div>
      `,
        )
        .join("")
    : `
      <div class="empty-state">
        <div class="empty-state__icon">📦</div>
        <p class="empty-state__title">No active deliveries</p>
        <p class="empty-state__desc">Create a delivery above to get started</p>
      </div>`;

  const ratingsMap = await getMyRatingsForDeliveries(
    history.map((d) => d.id),
    profile.id,
  );

  historyEl.innerHTML = history.length
    ? history
        .map(
          (d) => `
        <div class="delivery-card">
          <div class="delivery-card-top">
            <span class="delivery-code">${sanitizeText(d.delivery_code)}</span>
            <span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>
          </div>
          <div class="delivery-route">${sanitizeText(d.pickup_address)} → ${sanitizeText(d.dropoff_address)}</div>
          <div class="delivery-meta">${sanitizeText(d.goods_description)} · ${d.quantity_kg} kg · ₱${Number(d.estimated_cost).toLocaleString()}</div>
          ${renderRatingBlock(d, ratingsMap.get(d.id), "You rated this delivery")}
        </div>
      `,
        )
        .join("")
    : `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <p class="empty-state__title">No completed deliveries yet</p>
        <p class="empty-state__desc">Your delivery history will appear here</p>
      </div>`;

  wireRatingControls(historyEl, profile, submitRating, loadDeliveries);

  activeSubscriptions.forEach((channel) => channel.unsubscribe());
  activeSubscriptions.clear();

  active
    .filter((d) => d.status === "picked_up" || d.status === "in_transit")
    .forEach((d) => {
      const channel = subscribeToDeliveryUpdates(d.id, (updated) => {
        const img = document.getElementById(`map-${d.id}`);
        if (img && updated.current_lat && updated.current_lng) {
          img.src = staticMapUrl(
            updated.current_lat,
            updated.current_lng,
          );
        }
        const caption = document.getElementById(`map-caption-${d.id}`);
        if (caption)
          caption.textContent = `Live location — last updated ${new Date().toLocaleTimeString()}`;
      });
      activeSubscriptions.set(d.id, channel);
    });
}

loadDeliveries();
document
  .getElementById("refreshBtn")
  .addEventListener("click", loadDeliveries);

setupNotifications(
  profile,
  document.getElementById("notifBell"),
  document.getElementById("notifPanel"),
  document.getElementById("notifBadge"),
);
