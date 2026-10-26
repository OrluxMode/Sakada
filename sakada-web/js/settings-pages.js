// Profile → Language and Profile → Phone alerts (Figma 349:2721, 350:2896).
//
// Language changes right away: saved on the phone and the account, then the
// page reloads on this screen in the new words. Phone alerts are per phone.

import { supabase } from "./supabase-client.js";
import { t, LANGUAGES, currentLanguage, chooseLanguage } from "./i18n.js";
import { alertsState, enableAlerts, disableAlerts } from "./push.js";

const CHECK = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8 5.2-6"/></svg>`;
const TICK = `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8 5.2-6"/></svg>`;

export function createSettingsPages({ profile }) {
  const $ = (id) => document.getElementById(id);

  // ---- Language ----
  const langList = $("langList");
  function renderLanguages() {
    const now = currentLanguage();
    $("langValue").textContent = LANGUAGES.find((l) => l.id === now).name;
    langList.innerHTML = LANGUAGES.map((l) => `
      <button type="button" class="rq-lang" role="radio" aria-checked="${l.id === now}" data-lang="${l.id}" lang="${l.id === "en" ? "en" : "fil"}">
        <span class="rq-lang-words"><strong>${l.name}</strong><span>${l.sample}</span></span>
        <span class="rq-lang-check">${CHECK}</span>
      </button>`).join("");
  }
  langList.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b || b.dataset.lang === currentLanguage()) return;
    langList.querySelectorAll("[data-lang]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    chooseLanguage(b.dataset.lang);
    // The account keeps it for other phones and for phone alerts; the phone has it either way.
    await supabase.from("profiles").update({ language: b.dataset.lang }).eq("id", profile.id).then(() => {}, () => {});
    location.reload();
  });
  // Arrow keys move between the three, like any radio group.
  langList.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const all = [...langList.querySelectorAll("[data-lang]")];
    all[(all.indexOf(document.activeElement) + step + all.length) % all.length]?.focus();
  });
  renderLanguages();

  // ---- Phone alerts ----
  const sw = $("alertsSwitch");
  let state = "off";
  let busy = false;
  const STATUS = {
    on: "On", off: "Off", blocked: "Blocked by the browser", "ios-browser": "Needs the Home Screen app",
    unsupported: "Not available in this browser", "not-ready": "Not ready yet",
  };
  function note(title, body) {
    return `<div class="rq-alerts-note"><strong>${t(title)}</strong><span>${t(body)}</span></div>`;
  }
  function paintAlerts() {
    const on = state === "on";
    sw.setAttribute("aria-checked", String(on));
    sw.disabled = busy || !(state === "on" || state === "off");
    sw.setAttribute("aria-busy", String(busy));
    $("alertsStatus").textContent = t(STATUS[state]);
    $("alertsStatus").classList.toggle("is-on", on);
    $("alertsValue").textContent = t(on ? "On" : state === "blocked" ? "Blocked" : "Off");
    const info = $("alertsInfo");
    if (on || state === "off") {
      info.innerHTML = `
        <div class="rq-list rq-alerts-list">
          <p>${t("You'll get an alert when")}</p>
          <ul>${["A driver accepts your booking", "It's picked up", "It's on the road", "It's delivered", "It's cancelled"]
            .map((s) => `<li>${TICK}${t(s)}</li>`).join("")}</ul>
        </div>
        <p class="rq-saved-note rq-saved-note--left">${t("Turn it on for each phone you use. Everything also stays in Profile → Notifications.")}</p>`;
    } else if (state === "blocked") {
      info.innerHTML = note("Alerts are blocked for Sakada", "Your browser said no to alerts earlier. To turn them on: open the browser's site settings for Sakada, set Notifications to Allow, then come back here.");
    } else if (state === "ios-browser") {
      info.innerHTML = `<div class="rq-alerts-note"><strong>${t("On iPhone, alerts need the Home Screen app")}</strong>
        <ol><li>${t("In Safari, tap Share (the square with an arrow).")}</li><li>${t("Tap Add to Home Screen.")}</li><li>${t("Open Sakada from your Home Screen and turn alerts on here.")}</li></ol></div>`;
    } else if (state === "unsupported") {
      info.innerHTML = note("This browser can't show alerts", "Try Chrome on Android, or the Home Screen app on iPhone.");
    } else {
      info.innerHTML = note("Phone alerts are almost ready", "We're still setting them up. Your updates are in Profile → Notifications until then.");
    }
  }
  async function refreshAlerts() {
    state = await alertsState().catch(() => "unsupported");
    paintAlerts();
  }
  async function setAlerts(on) {
    busy = true;
    $("alertsError").hidden = true;
    paintAlerts();
    try {
      state = on ? await enableAlerts() : await disableAlerts();
    } catch {
      state = await alertsState().catch(() => "off");
      $("alertsError").textContent = t("Couldn't turn on alerts. Check your signal and try again.");
      $("alertsError").hidden = false;
    }
    busy = false;
    paintAlerts();
    return state;
  }
  sw.addEventListener("click", () => setAlerts(state !== "on"));
  refreshAlerts();

  return {
    refreshAlerts,
    /** For the offer on Request sent. */
    turnOnAlerts: () => setAlerts(true),
  };
}
