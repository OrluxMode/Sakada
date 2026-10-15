import { sanitizeText } from "./sanitize.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  getAllProfiles,
  getAllDeliveries,
  getAllRatings,
  getContactSubmissions,
  adminCancelDelivery,
} from "./admin-data.js";
import { statusLabel } from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";
import { paginate, pageList } from "./pagination.js";

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

const CHEVRON_LEFT = `<svg aria-hidden="true" width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="M6.5 1 1.5 6l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEVRON_RIGHT = `<svg aria-hidden="true" width="8" height="12" viewBox="0 0 8 12" fill="none"><path d="m1.5 1 5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Renders "Showing 1–25 of 212 messages" + Previous / 1 2 … 9 / Next. */
function renderPager(nav, state, noun, onPage) {
  if (state.total === 0) {
    nav.innerHTML = "";
    return;
  }
  const range = `<p class="pager-range">Showing ${state.from}–${state.to} of ${state.total} ${noun}</p>`;
  if (state.totalPages === 1) {
    nav.innerHTML = range;
    return;
  }
  const nums = pageList(state.page, state.totalPages)
    .map((p) =>
      p === "…"
        ? `<span class="pager-gap" aria-hidden="true">…</span>`
        : `<button type="button" class="pager-btn pager-num" data-page="${p}"${p === state.page ? ' aria-current="page"' : ""} aria-label="Page ${p}">${p}</button>`,
    )
    .join("");
  nav.innerHTML = `${range}
    <div class="pager-controls">
      <button type="button" class="pager-btn" data-page="${state.page - 1}" aria-label="Previous page"${state.page === 1 ? " disabled" : ""}>${CHEVRON_LEFT}<span class="pager-label">Previous</span></button>
      ${nums}
      <span class="pager-status">Page ${state.page} of ${state.totalPages}</span>
      <button type="button" class="pager-btn" data-page="${state.page + 1}" aria-label="Next page"${state.page === state.totalPages ? " disabled" : ""}><span class="pager-label">Next</span>${CHEVRON_RIGHT}</button>
    </div>`;
  nav.onclick = (e) => {
    const btn = e.target.closest("button[data-page]");
    if (btn && !btn.disabled) onPage(Number(btn.dataset.page));
  };
}

let profilesById = new Map();
let deliveryCodeById = new Map();

const pages = { users: 1, deliveries: 1, feedback: 1, messages: 1 };
let usersData = [];
let deliveriesData = [];
let ratingsData = [];
let messagesData = [];

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

  usersData = profiles;
  renderUsers();
}

function renderUsers() {
  const tbody = document.getElementById("usersTableBody");
  const state = paginate(usersData, pages.users);
  pages.users = state.page;

  tbody.innerHTML = state.rows
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

  renderPager(document.getElementById("usersPager"), state, "users", (p) => {
    pages.users = p;
    renderUsers();
  });
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
  // Delivered without payment (driver chose "Delivered, not paid"): Sakada follows up.
  document.getElementById("statUnpaid").textContent = data.filter(
    (d) => d.payment_status === "unpaid",
  ).length;

  deliveryCodeById = new Map(data.map((d) => [d.id, d.delivery_code]));

  deliveriesData = data;
  renderDeliveries();
}

function renderDeliveries() {
  const tbody = document.getElementById("deliveriesTableBody");
  const state = paginate(deliveriesData, pages.deliveries);
  pages.deliveries = state.page;

  tbody.innerHTML = state.rows
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
        <td><span class="status-pill" data-status="${sanitizeText(d.status)}">${statusLabel(d.status)}</span>${d.payment_status === "unpaid" ? ' <span class="status-pill" data-status="unpaid">Unpaid</span>' : ""}</td>
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

  renderPager(
    document.getElementById("deliveriesPager"),
    state,
    "deliveries",
    (p) => {
      pages.deliveries = p;
      renderDeliveries();
    },
  );
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

  ratingsData = data;
  renderFeedback();
}

function renderFeedback() {
  const tbody = document.getElementById("feedbackTableBody");
  const state = paginate(ratingsData, pages.feedback);
  pages.feedback = state.page;

  tbody.innerHTML = ratingsData.length
    ? state.rows
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

  renderPager(
    document.getElementById("feedbackPager"),
    state,
    "ratings",
    (p) => {
      pages.feedback = p;
      renderFeedback();
    },
  );
}

async function loadMessages() {
  const tbody = document.getElementById("messagesTableBody");
  tbody.innerHTML = renderTableSkeletons(3, 7);

  const { data, error } = await getContactSubmissions();
  if (error) {
    showMessage(`Couldn't load messages: ${error.message}`, "error");
    toastError("Failed to load messages");
    return;
  }

  messagesData = data;
  renderMessages();
}

function renderMessages() {
  const tbody = document.getElementById("messagesTableBody");
  const state = paginate(messagesData, pages.messages);
  pages.messages = state.page;

  tbody.innerHTML = messagesData.length
    ? state.rows
        .map(
          (m) => `
        <tr>
          <td>${new Date(m.created_at).toLocaleString()}</td>
          <td>${sanitizeText(m.name) || "—"}</td>
          <td>${sanitizeText(m.email) || "—"}</td>
          <td>${sanitizeText(m.phone) || "—"}</td>
          <td>${sanitizeText(m.role) || "—"}</td>
          <td>${sanitizeText(m.purpose) || "—"}</td>
          <td>${sanitizeText(m.message)}</td>
        </tr>
      `,
        )
        .join("")
    : `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No messages yet.</td></tr>`;

  renderPager(
    document.getElementById("messagesPager"),
    state,
    "messages",
    (p) => {
      pages.messages = p;
      renderMessages();
    },
  );
}

await loadStatsAndUsers();
await loadDeliveries();
await loadFeedback();
await loadMessages();
