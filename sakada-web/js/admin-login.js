import {
  loginWithEmail,
  getCurrentProfile,
  signOut,
} from "./auth.js";
import { toastError } from "./toast.js";
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}

const form = document.getElementById("adminLoginForm");
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
  submitBtn.innerHTML = '<span class="spinner"></span>Logging in…';

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await loginWithEmail({ email, password });

  if (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
    showMessage("Invalid email or password.", "error");
    toastError("Login failed");
    return;
  }

  const profile = await getCurrentProfile();

  if (profile?.role !== "admin") {
    showMessage("Invalid email or password.", "error");
    toastError("Login failed");
    await signOut("../index.html");
    return;
  }

  window.location.href = "../dashboard/admin/index.html";
});
