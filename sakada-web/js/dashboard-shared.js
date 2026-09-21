import { sanitizeHTML, sanitizeText } from "./sanitize.js";
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

export function renderNotifications(list, notifBadge, notifPanel, onRead) {
  const unreadCount = list.filter((n) => !n.is_read).length;
  notifBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  notifBadge.classList.toggle("visible", unreadCount > 0);

  if (list.length === 0) {
    notifPanel.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
    return;
  }

  notifPanel.innerHTML = list
    .map(
      (n) => `
    <div class="notif-item ${n.is_read ? "" : "unread"}" data-notif-id="${sanitizeText(n.id)}" data-read="${n.is_read}">
      ${sanitizeHTML(n.message)}
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

export function renderRatingBlock(d, existingRating, ratedLabel) {
  if (d.status !== "delivered") return "";

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
      <textarea class="rating-comment" data-comment-for="${sanitizeText(d.id)}" rows="2" placeholder="How was this delivery? (optional)"></textarea>
      <button class="btn-small" data-submit-rating="${sanitizeText(d.id)}" data-other-user-id="${sanitizeText(d.driver_id || d.requester_id)}" disabled>Submit Rating</button>
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
        return { error };
      }

      onSuccess();
      return {};
    });
  });
}

export function setupNotifications(profile, notifBell, notifPanel, notifBadge) {
  async function loadNotifications() {
    const { data, error } = await getMyNotifications(profile.id);
    if (!error && data) renderNotifications(data, notifBadge, notifPanel, loadNotifications);
  }

  notifBell.addEventListener("click", () => {
    notifPanel.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-wrap"))
      notifPanel.classList.remove("open");
  });

  loadNotifications();
  subscribeToNotifications(profile.id, () => loadNotifications());

  return loadNotifications;
}
