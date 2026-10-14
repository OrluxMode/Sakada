import { registerWithEmail, loginWithGoogle } from "./auth.js";
import { checkName, checkEmail, emailChecker, checkNewPassword } from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";
import { isExistingAccount, signupErrorCopy } from "./signup-result.js";

const ROLES = ["farmer", "vendor", "driver"];
const NEXT_STEP = {
  requester: "Book your first truck from your dashboard. You see the fare before you confirm.",
  driver: "Add your vehicle in your dashboard so senders know which truck to look for.",
};

// ---- Role (native radios; ?role= presets it) ----
const roleInputs = [...document.querySelectorAll('input[name="role"]')];
const presetRole = new URLSearchParams(window.location.search).get("role");
if (ROLES.includes(presetRole)) {
  roleInputs.find((input) => input.value === presetRole).checked = true;
}
const selectedRole = () => roleInputs.find((input) => input.checked)?.value || "farmer";

// The left panel speaks to drivers when Driver is picked.
const pitches = document.querySelectorAll("[data-pitch]");
function showPitch() {
  const which = selectedRole() === "driver" ? "driver" : "requester";
  pitches.forEach((el) => (el.hidden = el.dataset.pitch !== which));
}
roleInputs.forEach((input) => input.addEventListener("change", showPitch));
showPitch();

// ---- Form message (offline, rate limit, unknown) ----
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

// ---- Show / hide password ----
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
passwordToggle.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(show));
  passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// ---- Validation ----
const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const nameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const RULES = [
  [nameInput, checkName],
  [emailInput, emailChecker()],
  [passwordInput, checkNewPassword],
];
clearWhenFixed([
  [nameInput, checkName],
  [emailInput, (v) => checkEmail(v)],
  [passwordInput, checkNewPassword],
]);
form.addEventListener("input", clearMessage);

function showExistingAccount() {
  showFieldError(emailInput, "This email already has an account.");
  const link = document.createElement("a");
  link.href = "login.html";
  link.className = "field-error-link";
  link.textContent = "Log in instead";
  document.getElementById("emailError").append(" ", link);
  // A server-side error: any edit to the email clears it.
  emailInput.addEventListener("input", () => showFieldError(emailInput, ""), { once: true });
  emailInput.focus();
}

function showError(error) {
  const copy = signupErrorCopy(error);
  if (copy.kind === "exists") return showExistingAccount();
  if (copy.field) {
    const input = copy.field === "email" ? emailInput : passwordInput;
    showFieldError(input, copy.message);
    input.focus();
    return;
  }
  showMessage(copy.message);
}

// ---- Success: the panel replaces the form (values are kept for Start over) ----
const formPanel = document.getElementById("signupFormPanel");
const successPanel = document.getElementById("signupSuccess");
function showSuccess(email) {
  document.getElementById("successEmail").textContent = email;
  document.getElementById("successNext").textContent =
    NEXT_STEP[selectedRole() === "driver" ? "driver" : "requester"];
  passwordInput.value = "";
  formPanel.hidden = true;
  successPanel.hidden = false;
  successPanel.focus();
}
document.getElementById("startOver").addEventListener("click", () => {
  successPanel.hidden = true;
  formPanel.hidden = false;
  emailInput.focus();
  emailInput.select();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  if (!validateFields(RULES)) return;
  setBusy(submitBtn, true, "Creating account…");

  const email = emailInput.value.trim();
  let result;
  try {
    result = await registerWithEmail({
      email,
      password: passwordInput.value,
      fullName: nameInput.value.trim(),
      role: selectedRole(),
    });
  } catch (err) {
    result = { error: err };
  }
  setBusy(submitBtn, false, "Create account");

  if (result.error) return showError(result.error);
  if (isExistingAccount(result.data)) return showExistingAccount();
  showSuccess(email);
});

// ---- Google ----
const googleBtn = document.getElementById("googleBtn");
googleBtn.addEventListener("click", async () => {
  clearMessage();
  setBusy(googleBtn, true, "Opening Google…");
  let error;
  try {
    ({ error } = await loginWithGoogle(selectedRole()));
  } catch (err) {
    error = err;
  }
  if (error) {
    setBusy(googleBtn, false, "Continue with Google");
    showMessage(signupErrorCopy(error).message);
  }
});
// Coming back with the Back button restores the page from cache: un-stick the button.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) setBusy(googleBtn, false, "Continue with Google");
});
