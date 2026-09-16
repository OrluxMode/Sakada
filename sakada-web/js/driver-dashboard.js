import { sanitizeText } from "./sanitize.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  getAvailableDeliveries,
  acceptDelivery,
  getMyAssignedDeliveries,
  updateDeliveryStatus,
  updateDeliveryLocation,
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

const STATUS_FLOW = {
  driver_assigned: { next: "picked_up", label: "Mark Picked Up" },
  picked_up: { next: "in_transit", label: "Mark In Transit" },
  in_transit: { next: "delivered", label: "Mark Delivered" },
};

const profile = await requireRole(
  "driver",
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

async function loadAvailable() {
  const listEl = document.getElementById("availableList");
  listEl.innerHTML = renderSkeletons(3);

  const { data, error } = await getAvailableDeliveries();

  if (error) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <p class="empty-state__title">Couldn't load deliveries</p>
        <p class="empty-state__desc">${sanitizeText(error.message)}</p>
      </div>`;
    toastError("Failed to load available deliveries");
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🚛</div>
        <p class="empty-state__title">No available deliveries</p>
        <p class="empty-state__desc">Check back soon — new deliveries come in regularly</p>
      </div>`;
    return;
  }

  listEl.innerHTML = data
    .map(
      (d) => `
    <div class="delivery-card" data-id="${sanitizeText(d.id)}">
      <div class="delivery-card-top">
        <span class="delivery-code">${sanitizeText(d.delivery_code)}</span>
        <span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>
      </div>
      <div class="delivery-route">${sanitizeText(d.pickup_address)} → ${sanitizeText(d.dropoff_address)}</div>
      <div class="delivery-meta">${sanitizeText(d.goods_description)} · ${d.quantity_kg} kg · Est. ₱${Number(d.estimated_cost).toLocaleString()}</div>
      <button class="btn-accept" data-accept-id="${sanitizeText(d.id)}">Accept Delivery</button>
    </div>
  `,
    )
    .join("");

  listEl.querySelectorAll("[data-accept-id]").forEach((btn) => {
    btn.addEventListener("click", () =>
      handleAccept(btn.dataset.acceptId, btn),
    );
  });
}

async function handleAccept(deliveryId, btn) {
  if (getIsOffline()) {
    toastError("Can't accept — you're offline");
    return;
  }
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Accepting…';

  const { error } = await acceptDelivery(deliveryId, profile.id);

  if (error) {
    showMessage(
      "That delivery was just taken by another driver, or is no longer available.",
      "error",
    );
    toastError("Couldn't accept delivery");
    btn.disabled = false;
    btn.textContent = "Accept Delivery";
    loadAvailable();
    return;
  }

  showMessage(
    "Delivery accepted — check My Assigned Deliveries below.",
    "success",
  );
  toastSuccess("Delivery accepted");
  loadAvailable();
  loadAssigned();
}

async function loadAssigned() {
  const activeEl = document.getElementById("assignedActiveList");
  const historyEl = document.getElementById("assignedHistoryList");
  activeEl.innerHTML = renderSkeletons();
  historyEl.innerHTML = renderSkeletons(1);

  const { data, error } = await getMyAssignedDeliveries(profile.id);

  if (error) {
    activeEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <p class="empty-state__title">Couldn't load assigned deliveries</p>
        <p class="empty-state__desc">${sanitizeText(error.message)}</p>
      </div>`;
    historyEl.innerHTML = "";
    toastError("Failed to load assigned deliveries");
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
        .map((d) => {
          const action = STATUS_FLOW[d.status];
          const actionBtn = action
            ? `<button class="btn-accept" data-status-id="${sanitizeText(d.id)}" data-current="${sanitizeText(d.status)}" data-next="${sanitizeText(action.next)}">${sanitizeText(action.label)}</button>`
            : "";
          const isTrackable =
            d.status === "picked_up" || d.status === "in_transit";
          const trackingBadge = isTrackable
            ? `<div class="tracking-badge" id="tracking-badge-${sanitizeText(d.id)}">📍 Sharing your location…</div>`
            : "";
          return `
          <div class="delivery-card">
            <div class="delivery-card-top">
              <span class="delivery-code">${sanitizeText(d.delivery_code)}</span>
              <span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>
            </div>
            <div class="delivery-route">${sanitizeText(d.pickup_address)} → ${sanitizeText(d.dropoff_address)}</div>
            <div class="delivery-meta">${sanitizeText(d.goods_description)} · ${d.quantity_kg} kg · ₱${Number(d.estimated_cost).toLocaleString()}</div>
            ${trackingBadge}
            ${actionBtn}
          </div>
        `;
        })
        .join("")
    : `
      <div class="empty-state">
        <div class="empty-state__icon">📋</div>
        <p class="empty-state__title">No active assignments</p>
        <p class="empty-state__desc">Accept a delivery above to get started</p>
      </div>`;

  activeEl.querySelectorAll("[data-status-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleStatusUpdate(btn));
  });

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
          ${renderRatingBlock(d, ratingsMap.get(d.id), "You rated the requester")}
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

  wireRatingControls(historyEl, profile, submitRating, loadAssigned);

  updateTrackingTargets(active);
}

async function handleStatusUpdate(btn) {
  if (getIsOffline()) {
    toastError("Can't update — you're offline");
    return;
  }
  const deliveryId = btn.dataset.statusId;
  const currentStatus = btn.dataset.current;
  const nextStatus = btn.dataset.next;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Updating…';

  const { error } = await updateDeliveryStatus(
    deliveryId,
    profile.id,
    currentStatus,
    nextStatus,
  );

  if (error) {
    showMessage(`Couldn't update status: ${error.message}`, "error");
    toastError("Status update failed");
    btn.disabled = false;
    btn.textContent = STATUS_FLOW[currentStatus]?.label || "Update";
    return;
  }

  showMessage(`Marked ${statusLabel(nextStatus)}.`, "success");
  toastSuccess(`Marked as ${statusLabel(nextStatus)}`);
  loadAssigned();
}

// ---------- Location broadcasting ----------
let trackingIds = [];
let trackingInterval = null;
let locationErrorShown = false;

function updateTrackingTargets(deliveries) {
  trackingIds = deliveries
    .filter((d) => d.status === "picked_up" || d.status === "in_transit")
    .map((d) => d.id);

  if (trackingIds.length > 0 && !trackingInterval) {
    pushLocation();
    trackingInterval = setInterval(pushLocation, 20000);
  } else if (trackingIds.length === 0 && trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser doesn't support location sharing."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

async function pushLocation() {
  if (trackingIds.length === 0) return;

  try {
    const position = await getBrowserPosition();
    const { latitude, longitude } = position.coords;

    await Promise.all(
      trackingIds.map((id) =>
        updateDeliveryLocation(id, profile.id, latitude, longitude),
      ),
    );

    trackingIds.forEach((id) => {
      const badge = document.getElementById(`tracking-badge-${id}`);
      if (badge) badge.textContent = "📍 Sharing your location…";
    });
  } catch (err) {
    if (!locationErrorShown) {
      showMessage(
        "Couldn't get your location — check that this site has permission to use it in your browser settings.",
        "error",
      );
      toastError("Location access denied");
      locationErrorShown = true;
    }
  }
}

loadAvailable();
loadAssigned();
document.getElementById("refreshBtn").addEventListener("click", () => {
  loadAvailable();
  loadAssigned();
});

setupNotifications(
  profile,
  document.getElementById("notifBell"),
  document.getElementById("notifPanel"),
  document.getElementById("notifBadge"),
);
