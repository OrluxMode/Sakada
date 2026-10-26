import {
  loginWithEmail,
  loginWithGoogle,
  getCurrentProfile,
  sendPasswordReset,
} from "./auth.js";
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
import { loginErrorCopy, resetErrorCopy } from "./signup-result.js";
import { wirePasswordToggle } from "./password-toggle.js";

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

const messageEl = document.getElementById("formMessage");
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.className = "form-message visible error";
}
function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "form-message";
}

// Busy state for the submit and Google buttons: spinner + new label.
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);
  button.setAttribute("aria-busy", String(busy));
  button.querySelector(".btn-label").textContent = label;
}

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// ---- Show / hide password ----
wirePasswordToggle(document.getElementById("passwordToggle"), passwordInput);

const RULES = [
  [emailInput, emailChecker()],
  [passwordInput, checkPassword],
];
clearWhenFixed([
  [emailInput, (v) => checkEmail(v)],
  [passwordInput, checkPassword],
]);
form.addEventListener("input", clearMessage);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  if (!validateFields(RULES)) return;
  setBusy(submitBtn, true, "Logging in…");

  let error;
  try {
    ({ error } = await loginWithEmail({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    }));
  } catch (err) {
    error = err;
  }

  if (error) {
    setBusy(submitBtn, false, "Log in");
    showMessage(loginErrorCopy(error));
    return;
  }

  const profile = await getCurrentProfile();
  window.location.href =
    DASHBOARD_PATHS[profile?.role] || "../index.html";
});

// ---- Google ----
const googleBtn = document.getElementById("googleBtn");
googleBtn.addEventListener("click", async () => {
  clearMessage();
  setBusy(googleBtn, true, "Opening Google…");
  let error;
  try {
    ({ error } = await loginWithGoogle());
  } catch (err) {
    error = err;
  }
  if (error) {
    setBusy(googleBtn, false, "Continue with Google");
    showMessage(loginErrorCopy(error));
  }
});
// Coming back with the Back button restores the page from cache: un-stick the buttons.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  setBusy(googleBtn, false, "Continue with Google");
  setBusy(submitBtn, false, "Log in");
});

// ---- Forgot password (Figma 338:2112, 338:2135): a second step on this page at #reset ----
const loginStep = document.getElementById("loginStep");
const resetStep = document.getElementById("resetStep");
const resetAsk = document.getElementById("resetAsk");
const resetSent = document.getElementById("resetSent");
const resetEmail = document.getElementById("resetEmail");
const resetBtn = document.getElementById("resetBtn");
const resendBtn = document.getElementById("resendBtn");
const resetMessage = document.getElementById("resetMessage");
const resendMessage = document.getElementById("resendMessage");
const RESEND_WAIT = 60; // seconds before another email can be asked for
let sentTo = "";
let countdown = 0;
let tickTimer = 0;
let cameFromLogin = false; // Forgot password? added a history entry: Back to log in undoes it

function say(el, text) {
  el.textContent = text;
  el.className = text ? "form-message visible error" : "form-message";
}

/** The two steps swap in place with a short fade (no slide: it's the same page). */
function showStep(step) {
  const reset = step === "reset";
  if (resetStep.hidden === !reset) return;
  loginStep.hidden = reset;
  resetStep.hidden = !reset;
  const shown = reset ? resetStep : loginStep;
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    shown.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
  if (reset) {
    if (!resetEmail.value) resetEmail.value = emailInput.value.trim();
    (resetSent.hidden ? document.getElementById("resetTitle") : document.getElementById("resetSentTitle")).focus();
  } else {
    passwordInput.focus();
  }
}
const syncStep = () => showStep(location.hash === "#reset" ? "reset" : "login");
window.addEventListener("hashchange", syncStep);
syncStep();

document.getElementById("forgotLink").addEventListener("click", () => {
  resetEmail.value = emailInput.value.trim(); // carry over what they typed
  cameFromLogin = true;
});
document.getElementById("backToLogin").addEventListener("click", (e) => {
  e.preventDefault();
  if (cameFromLogin) {
    cameFromLogin = false;
    history.back(); // hashchange shows the log in step
    return;
  }
  history.replaceState(null, "", location.pathname + location.search);
  syncStep();
});

clearWhenFixed([[resetEmail, (v) => checkEmail(v)]]);
resetEmail.addEventListener("input", () => say(resetMessage, ""));

function tick() {
  clearTimeout(tickTimer);
  if (countdown > 0) {
    resendBtn.disabled = true;
    resendBtn.textContent = `Resend link in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`;
    countdown -= 1;
    tickTimer = setTimeout(tick, 1000);
  } else {
    resendBtn.disabled = false;
    resendBtn.textContent = "Resend link";
  }
}

async function sendLink(email) {
  let error;
  try {
    ({ error } = await sendPasswordReset(email));
  } catch (err) {
    error = err;
  }
  return error;
}

document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  say(resetMessage, "");
  if (!validateFields([[resetEmail, emailChecker()]])) return;
  const email = resetEmail.value.trim();
  setBusy(resetBtn, true, "Sending…");
  const error = await sendLink(email);
  setBusy(resetBtn, false, "Send reset link");
  if (error) return say(resetMessage, resetErrorCopy(error));
  sentTo = email;
  document.getElementById("resetSentLead").textContent = `We sent a reset link to ${email}. Open it on this phone to set a new password.`;
  resetAsk.hidden = true;
  resetSent.hidden = false;
  say(resendMessage, "");
  document.getElementById("resetSentTitle").focus();
  countdown = RESEND_WAIT;
  tick();
});

resendBtn.addEventListener("click", async () => {
  if (resendBtn.disabled || !sentTo) return;
  resendBtn.disabled = true;
  resendBtn.textContent = "Sending…";
  const error = await sendLink(sentTo);
  say(resendMessage, error ? resetErrorCopy(error) : "");
  if (!error) {
    resendMessage.textContent = `Sent again to ${sentTo}.`;
    resendMessage.className = "form-message visible success";
  }
  countdown = error ? 0 : RESEND_WAIT;
  tick();
});

document.getElementById("differentEmail").addEventListener("click", () => {
  resetSent.hidden = true;
  resetAsk.hidden = false;
  resetEmail.focus();
  resetEmail.select();
});
