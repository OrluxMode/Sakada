import { toastWarning } from "./toast.js";

const SUBMIT_SELECTORS =
  'button[type="submit"], .btn-primary:not([type="button"]), .btn-accept, .btn-small[data-submit-rating]';

let banner = null;
let isOffline = !navigator.onLine;

function disableSubmits() {
  document.querySelectorAll(SUBMIT_SELECTORS).forEach((btn) => {
    btn.disabled = true;
    btn.dataset.offlineDisabled = "true";
  });
}

function enableSubmits() {
  document
    .querySelectorAll(`${SUBMIT_SELECTORS}[data-offline-disabled]`)
    .forEach((btn) => {
      btn.disabled = false;
      delete btn.dataset.offlineDisabled;
    });
}

function showBanner() {
  if (!banner) return;
  banner.classList.add("offline-banner--visible");
}

function hideBanner() {
  if (!banner) return;
  banner.classList.remove("offline-banner--visible");
}

function handleOffline() {
  isOffline = true;
  showBanner();
  disableSubmits();
  toastWarning("You're offline — changes won't be saved until you reconnect");
}

function handleOnline() {
  isOffline = false;
  hideBanner();
  enableSubmits();
  toastWarning("You're back online");
}

export function initOfflineDetection() {
  banner = document.getElementById("offlineBanner");

  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);

  if (!navigator.onLine) {
    handleOffline();
  }
}

export function getIsOffline() {
  return isOffline;
}
