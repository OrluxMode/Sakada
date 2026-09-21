import { supabase } from "./supabase-client.js";

const form = document.getElementById("contactForm");
const submitBtn = document.getElementById("contactSubmit");
const formMsg = document.getElementById("contactFormMsg");
const roleTabs = document.querySelectorAll(".role-tab");

let selectedRole = "farmer";

// Role tab switching
roleTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    roleTabs.forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    selectedRole = tab.dataset.role;
  });

  // Keyboard navigation for tabs
  tab.addEventListener("keydown", (e) => {
    const tabs = Array.from(roleTabs);
    const index = tabs.indexOf(tab);

    let newIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      newIndex = tabs.length - 1;
    }

    if (newIndex !== undefined) {
      tabs[newIndex].focus();
      tabs[newIndex].click();
    }
  });
});

// Form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Validate
  const name = document.getElementById("contactName").value.trim();
  const phone = document.getElementById("contactPhone").value.trim();
  const email = document.getElementById("contactEmail").value.trim();
  const purpose = document.getElementById("contactPurpose").value;
  const message = document.getElementById("contactMessageInput").value.trim();

  if (!name || !phone || !email || !message) {
    showFormMessage("Please fill in all required fields.", "error");
    return;
  }

  // Loading state
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span class="spinner" aria-hidden="true"></span>
    Sending…
  `;
  formMsg.className = "form-message";

  const { error } = await supabase.from("contact_submissions").insert({
    name,
    email,
    phone,
    role: selectedRole,
    purpose,
    message,
  });

  // Reset button
  submitBtn.disabled = false;
  submitBtn.innerHTML = `
    Send Message
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13L13 3M13 3H5M13 3V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  if (error) {
    showFormMessage(
      "Something went wrong. Please try again or email us directly.",
      "error"
    );
    return;
  }

  showFormMessage(
    "Message sent! We'll get back to you within 2 hours during business hours.",
    "success"
  );
  form.reset();

  // Reset role tab to farmer
  roleTabs.forEach((t) => t.classList.remove("active"));
  roleTabs[0].classList.add("active");
  selectedRole = "farmer";
});

function showFormMessage(text, type) {
  formMsg.textContent = text;
  formMsg.className = `form-message visible ${type}`;

  // Auto-dismiss success messages after 8 seconds
  if (type === "success") {
    setTimeout(() => {
      formMsg.className = "form-message";
    }, 8000);
  }
}
