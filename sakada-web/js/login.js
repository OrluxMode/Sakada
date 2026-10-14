import {
  loginWithEmail,
  loginWithGoogle,
  getCurrentProfile,
} from "./auth.js";
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
import { loginErrorCopy } from "./signup-result.js";

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
const passwordToggle = document.getElementById("passwordToggle");
passwordToggle.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(show));
  passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

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
