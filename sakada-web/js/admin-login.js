import {
  loginWithEmail,
  getCurrentProfile,
  signOut,
} from "./auth.js";

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}

const form = document.getElementById("adminLoginForm");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
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

  if (profile?.role !== "admin") {
    showMessage("This account doesn't have admin access.", "error");
    await signOut("../index.html");
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
    return;
  }

  window.location.href = "../dashboard/admin/index.html";
});
