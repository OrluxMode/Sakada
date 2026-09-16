import { registerWithEmail, loginWithGoogle } from "./auth.js";

const tabs = document.querySelectorAll(".role-tabs button");
const params = new URLSearchParams(window.location.search);
const presetRole = params.get("role");
let selectedRole = "farmer";

if (presetRole && ["farmer", "vendor", "driver"].includes(presetRole)) {
  selectedRole = presetRole;
}

function setActiveTab(role) {
  selectedRole = role;
  tabs.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.role === role),
  );
}
setActiveTab(selectedRole);

tabs.forEach((btn) =>
  btn.addEventListener("click", () => setActiveTab(btn.dataset.role)),
);

const messageEl = document.getElementById("formMessage");
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `form-message visible ${type}`;
}

const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await registerWithEmail({
    email,
    password,
    fullName,
    role: selectedRole,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Create Account";

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage(
    "Account created. Check your email to confirm, then log in.",
    "success",
  );
  form.reset();
});

document
  .getElementById("googleBtn")
  .addEventListener("click", async () => {
    const { error } = await loginWithGoogle(selectedRole);
    if (error) showMessage(error.message, "error");
  });
