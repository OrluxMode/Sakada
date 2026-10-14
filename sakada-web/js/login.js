import {
  loginWithEmail,
  loginWithGoogle,
  getCurrentProfile,
} from "./auth.js";
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const RULES = [
  [emailInput, emailChecker()],
  [passwordInput, checkPassword],
];
clearWhenFixed([
  [emailInput, (v) => checkEmail(v)],
  [passwordInput, checkPassword],
]);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validateFields(RULES)) return;
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await loginWithEmail({ email, password });

  if (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
    showMessage(error.message, "error");
    return;
  }

  const profile = await getCurrentProfile();
  window.location.href =
    DASHBOARD_PATHS[profile?.role] || "../index.html";
});

document
  .getElementById("googleBtn")
  .addEventListener("click", async () => {
    const { error } = await loginWithGoogle();
    if (error) showMessage(error.message, "error");
  });
