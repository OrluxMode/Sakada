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
