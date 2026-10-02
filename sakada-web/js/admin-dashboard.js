import { sanitizeText } from "./sanitize.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  getAllProfiles,
  getAllDeliveries,
  getAllRatings,
  adminCancelDelivery,
} from "./admin-data.js";
import { statusLabel } from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";

const profile = await requireRole(
  "admin",
  "../../auth/admin-login.html",
  "../../index.html",
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
  .addEventListener("click", () => signOut("../../index.html"));

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}

const ACTIVE_STATUSES = ["driver_assigned", "picked_up", "in_transit"];
const CANCELLABLE_STATUSES = ["pending", "driver_assigned"];

// ---------- Tabs ----------
document.querySelectorAll(".admin-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".admin-tabs button")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".admin-panel")
      .forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document
      .getElementById(`panel-${btn.dataset.tab}`)
      .classList.add("active");
  });
});

function renderTableSkeletons(rows = 4, cols = 5) {
  return Array.from({ length: rows }, () => {
    const cells = Array.from(
      { length: cols },
      () => `<td><div class="skeleton__line skeleton__line--row"></div></td>`,
    ).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
}

let profilesById = new Map();

async function loadStatsAndUsers() {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = renderTableSkeletons(4, 4);

  const { data: profiles, error } = await getAllProfiles();
  if (error) {
    showMessage(`Couldn't load users: ${error.message}`, "error");
    toastError("Failed to load users");
    return;
  }

  profilesById = new Map(profiles.map((p) => [p.id, p]));

  document.getElementById("statFarmers").textContent = profiles.filter(
    (p) => p.role === "farmer",
  ).length;
  document.getElementById("statVendors").textContent = profiles.filter(
    (p) => p.role === "vendor",
  ).length;
  document.getElementById("statDrivers").textContent = profiles.filter(
    (p) => p.role === "driver",
  ).length;

  tbody.innerHTML = profiles
    .map(
      (p) => `
    <tr>
      <td>${sanitizeText(p.full_name)}</td>
      <td><span class="role-badge">${sanitizeText(p.role)}</span></td>
      <td>${sanitizeText(p.phone) || "—"}</td>
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
    </tr>
  `,
    )
    .join("");
}

async function loadDeliveries() {
  const tbody = document.getElementById("deliveriesTableBody");
  tbody.innerHTML = renderTableSkeletons(5, 7);

  const { data, error } = await getAllDeliveries();
  if (error) {
    showMessage(`Couldn't load deliveries: ${error.message}`, "error");
    toastError("Failed to load deliveries");
    return;
  }

  document.getElementById("statPending").textContent = data.filter(
    (d) => d.status === "pending",
  ).length;
  document.getElementById("statActive").textContent = data.filter((d) =>
    ACTIVE_STATUSES.includes(d.status),
  ).length;
  document.getElementById("statCompleted").textContent = data.filter(
    (d) => d.status === "delivered",
  ).length;

  tbody.innerHTML = data
    .map((d) => {
      const requesterName =
        profilesById.get(d.requester_id)?.full_name || "—";
      const driverName = d.driver_id
        ? profilesById.get(d.driver_id)?.full_name || "—"
        : "Unassigned";
      const canCancel = CANCELLABLE_STATUSES.includes(d.status);
      return `
      <tr>
        <td>${sanitizeText(d.delivery_code)}</td>
        <td>${sanitizeText(d.pickup_address)} → ${sanitizeText(d.dropoff_address)}</td>
        <td>${sanitizeText(requesterName)}</td>
        <td>${sanitizeText(driverName)}</td>
        <td><span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span></td>
        <td>₱${Number(d.estimated_cost).toLocaleString()}</td>
        <td>${canCancel ? `<button class="btn-small danger" data-cancel-id="${sanitizeText(d.id)}">Cancel</button>` : ""}</td>
      </tr>
    `;
    })
    .join("");

  tbody.querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (getIsOffline()) {
        toastError("Can't cancel — you're offline");
        return;
      }
      if (!confirm("Cancel this delivery? This can't be undone.")) return;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Cancelling…';
      const { error } = await adminCancelDelivery(btn.dataset.cancelId);
      if (error) {
        showMessage(`Couldn't cancel: ${error.message}`, "error");
        toastError("Cancel failed");
        btn.disabled = false;
        btn.textContent = "Cancel";
        return;
      }
      showMessage("Delivery cancelled.", "success");
      toastSuccess("Delivery cancelled");
      loadDeliveries();
    });
  });
}

async function loadFeedback() {
  const tbody = document.getElementById("feedbackTableBody");
  tbody.innerHTML = renderTableSkeletons(3, 5);

  const { data, error } = await getAllRatings();
  if (error) {
    showMessage(`Couldn't load feedback: ${error.message}`, "error");
    toastError("Failed to load feedback");
    return;
  }

  const { data: deliveries } = await getAllDeliveries();
  const deliveryCodeById = new Map(
    (deliveries || []).map((d) => [d.id, d.delivery_code]),
  );

  tbody.innerHTML = data.length
    ? data
        .map(
          (r) => `
        <tr>
          <td>${sanitizeText(deliveryCodeById.get(r.delivery_id)) || "—"}</td>
          <td>${sanitizeText(profilesById.get(r.rated_by)?.full_name) || "—"}</td>
          <td>${sanitizeText(profilesById.get(r.rated_user_id)?.full_name) || "—"}</td>
          <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
          <td>${sanitizeText(r.comment) || "—"}</td>
        </tr>
      `,
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No feedback yet.</td></tr>`;
}

await loadStatsAndUsers();
await loadDeliveries();
await loadFeedback();
