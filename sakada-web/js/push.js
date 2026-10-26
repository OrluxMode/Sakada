// Phone alerts (Figma 350:2792–350:3087): web push per phone. The phone's
// subscription is saved with save_push_subscription (0028); the Edge
// Function send-push sends an alert when a notification row is added.
//
// iPhone only allows it from the Home Screen app (iOS 16.4+), so Safari
// gets the steps to add Sakada there instead of a switch.

import { supabase } from "./supabase-client.js";
import { config } from "./config.js";

const OFFER_KEY = "sakada.alertsOffer"; // when "Not now" was tapped
const OFFER_REST = 14 * 24 * 60 * 60 * 1000; // ask again after two weeks

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** The worker, registered once from the site root so it covers every page. */
let ready = null;
function worker() {
  ready ||= navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: "/" })
    .then(() => navigator.serviceWorker.ready);
  return ready;
}

async function subscription() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Where this phone stands: "on", "off", "blocked" (said no before),
 * "ios-browser" (iPhone, not the Home Screen app), "unsupported", or
 * "not-ready" (the backend key isn't set yet).
 */
export async function alertsState() {
  if (isIos() && !isStandalone()) return "ios-browser";
  if (!supported()) return "unsupported";
  if (!config.vapidPublicKey) return "not-ready";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  return (await subscription()) ? "on" : "off";
}

function keyBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Ask the phone, subscribe, save it to the account. Returns the new state. */
export async function enableAlerts() {
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "off";
  const reg = await worker();
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.vapidPublicKey) });
  const { endpoint, keys } = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  });
  if (error) {
    await sub.unsubscribe().catch(() => {});
    throw error;
  }
  return "on";
}

/** Stop alerts on this phone (switch off, or logging out). */
export async function disableAlerts() {
  const sub = await subscription().catch(() => null);
  if (!sub) return "off";
  // Supabase's query has then() but no catch(): a failed delete still unsubscribes the phone.
  await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint }).then(() => {}, () => {});
  await sub.unsubscribe().catch(() => {});
  return "off";
}

/** Offer alerts on Request sent? Only when a tap can turn them on, and not right after "Not now". */
export async function shouldOffer() {
  if ((await alertsState()) !== "off") return false;
  try {
    return Date.now() - Number(localStorage.getItem(OFFER_KEY) || 0) > OFFER_REST;
  } catch {
    return true;
  }
}

export function notNow() {
  try {
    localStorage.setItem(OFFER_KEY, String(Date.now()));
  } catch { /* fine: it asks again next time */ }
}
