// The page the "reset your password" email opens (Figma 338:2158–338:2196).
// Supabase puts a one-time sign-in in the link; with it the person sets a new
// password and is then logged in. A used or expired link offers a new one.

import { supabase } from "./supabase-client.js";
import { getCurrentProfile, sendPasswordReset } from "./auth.js";
import { checkNewPassword, checkEmail, emailChecker } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
import { resetErrorCopy } from "./signup-result.js";
import { wirePasswordToggle } from "./password-toggle.js";
import { t, useLanguage, translatePage } from "./i18n.js";

// The reset page follows the language last chosen on this phone (Profile → Language).
useLanguage();
translatePage();

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

// Read the link before Supabase tidies the address bar.
const linkParams = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const fromLink = linkParams.get("type") === "recovery" || new URLSearchParams(location.search).has("code");
const linkFailed = linkParams.has("error") || linkParams.has("error_code");

const $ = (id) => document.getElementById(id);
const password = $("password");
wirePasswordToggle($("passwordToggle"), password);

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);
  button.setAttribute("aria-busy", String(busy));
  button.querySelector(".btn-label").textContent = label;
}
function say(el, text, kind = "error") {
  el.textContent = text;
  el.className = text ? `form-message visible ${kind}` : "form-message";
}
function show(step, title) {
  $("resetChecking").hidden = true;
  for (const id of ["setStep", "doneStep", "expiredStep"]) $(id).hidden = id !== step;
  $(title).focus();
}

let email = "";
async function start() {
  let session = null;
  if (!linkFailed) {
    try {
      ({ data: { session } } = await supabase.auth.getSession());
    } catch {
      session = null;
    }
  }
  if (fromLink && session) {
    email = session.user?.email || "";
    $("setFor").textContent = email ? t("For {email}", { email }) : "";
    show("setStep", "setTitle");
    return;
  }
  show("expiredStep", "expiredTitle");
}
start();

// ---- Set the new password ----
clearWhenFixed([[password, checkNewPassword]]);
password.addEventListener("input", () => say($("setMessage"), ""));
$("setForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  say($("setMessage"), "");
  if (!validateFields([[password, checkNewPassword]])) return;
  setBusy($("setBtn"), true, t("Saving…"));
  let error;
  try {
    ({ error } = await supabase.auth.updateUser({ password: password.value }));
  } catch (err) {
    error = err;
  }
  setBusy($("setBtn"), false, t("Save new password"));
  if (error) {
    if (error.status === 401 || /session/i.test(error.message || "")) return show("expiredStep", "expiredTitle");
    return say($("setMessage"), resetErrorCopy(error));
  }
  const profile = await getCurrentProfile().catch(() => null);
  $("doneLink").href = DASHBOARD_PATHS[profile?.role] || "login.html";
  show("doneStep", "doneTitle");
});

// ---- Expired or used link: send a new one ----
const again = $("againEmail");
clearWhenFixed([[again, (v) => checkEmail(v)]]);
again.addEventListener("input", () => say($("againMessage"), ""));
$("againForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  say($("againMessage"), "");
  if (!validateFields([[again, emailChecker()]])) return;
  setBusy($("againBtn"), true, t("Sending…"));
  let error;
  try {
    ({ error } = await sendPasswordReset(again.value.trim()));
  } catch (err) {
    error = err;
  }
  setBusy($("againBtn"), false, t("Send a new link"));
  if (error) return say($("againMessage"), resetErrorCopy(error));
  say($("againMessage"), t("We sent a new link to {email}. Open it on this phone.", { email: again.value.trim() }), "success");
});
