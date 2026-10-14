
import { supabase } from "./supabase-client.js";

const form = document.getElementById("contactForm");
const fields = document.getElementById("contactFields");
const formWrap = document.getElementById("contactFormWrap");
const submitBtn = document.getElementById("contactSubmit");
const sendError = document.getElementById("contactSendError");
const sent = document.getElementById("contactSent");
const sentHeading = document.getElementById("contactSentHeading");
const sentLead = document.getElementById("contactSentLead");
const againBtn = document.getElementById("contactAgain");
const nameInput = document.getElementById("contactName");
const emailInput = document.getElementById("contactEmail");
const messageInput = document.getElementById("contactMessage");
const purpose = document.getElementById("contactPurpose");
const codeField = document.getElementById("contactCodeField");
const codeInput = document.getElementById("contactCode");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Topics where a booking code is useful. Must stay inside the DB's
// contact_purpose_valid list (booking, driver, vendor, support, other).
const CODE_TOPICS = new Set(["booking", "support"]);
const DESKTOP = window.matchMedia("(min-width: 901px)");

const REQUIRED = [
  {
    input: nameInput,
    error: document.getElementById("contactNameError"),
    check: (v) => (v ? "" : "Enter your name."),
  },
  {
    input: emailInput,
    error: document.getElementById("contactEmailError"),
    check: (v) => {
      if (!v) return "Enter your email so we can reply.";
      return EMAIL_RE.test(v) ? "" : "That email doesn't look right. Check it, like name@email.com.";
    },
  },
  {
    input: messageInput,
    error: document.getElementById("contactMessageError"),
    check: (v) => (v ? "" : "Write your message."),
  },
];

// Role pills are radios. Both questions are optional, so clicking the
// selected pill again clears it.
document.querySelectorAll(".ct-pill").forEach((label) => {
  const input = label.querySelector("input");
  let wasChecked = false;
  label.addEventListener("pointerdown", () => {
    wasChecked = input.checked;
  });
  input.addEventListener("click", () => {
    if (wasChecked) input.checked = false;
    wasChecked = false;
  });
});

function syncTopic() {
  purpose.classList.toggle("is-empty", purpose.value === "");
  // A typed code stays in the field if the topic changes, but is only
  // sent for booking topics (see the submit handler).
  codeField.hidden = !CODE_TOPICS.has(purpose.value);
}
purpose.addEventListener("change", syncTopic);

function showError(field, msg) {
  field.error.textContent = msg;
  field.error.hidden = !msg;
  if (msg) field.input.setAttribute("aria-invalid", "true");
  else field.input.removeAttribute("aria-invalid");
}

/** Shows every field error and returns the first invalid input, or null. */
function validate() {
  let first = null;
  for (const field of REQUIRED) {
    const msg = field.check(field.input.value.trim());
    showError(field, msg);
    if (msg && !first) first = field.input;
  }
  return first;
}

// Once a field has been flagged, clear its error as soon as it's fixed.
REQUIRED.forEach((field) => {
  field.input.addEventListener("input", () => {
    if (field.input.hasAttribute("aria-invalid")) {
      showError(field, field.check(field.input.value.trim()));
    }
  });
});

let sending = false;

function setSending(on) {
  sending = on;
  if (on) {
    // Keep the button the same width while its label changes.
    submitBtn.style.minWidth = `${submitBtn.offsetWidth}px`;
    submitBtn.textContent = "Sending…";
  } else {
    submitBtn.style.minWidth = "";
  }
  fields.disabled = on;
  submitBtn.disabled = on;
  submitBtn.setAttribute("aria-busy", String(on));
}

function showSent(name, email) {
  const firstName = name.split(/\s+/)[0];
  sentLead.textContent = `Thanks, ${firstName}. We'll reply to ${email}.`;
  formWrap.hidden = true;
  sent.hidden = false;
  sentHeading.focus();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sending) return;
  sendError.hidden = true;

  const firstInvalid = validate();
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const role = form.querySelector('input[name="contactRole"]:checked')?.value ?? null;
  const topic = purpose.value || null;
  const code = CODE_TOPICS.has(purpose.value) ? codeInput.value.trim().toUpperCase() : "";
  const text = messageInput.value.trim();
  // No booking-code column: the code goes at the top of the message.
  const message = code ? `Booking code: ${code}\n\n${text}` : text;

  setSending(true);
  let error = null;
  try {
    ({ error } = await supabase
      .from("contact_submissions")
      .insert({ name, email, role, purpose: topic, message }));
  } catch (err) {
    error = err;
  }
  setSending(false);

  if (error) {
    submitBtn.textContent = "Try again";
    sendError.hidden = false;
    return;
  }
  showSent(name, email);
});

againBtn.addEventListener("click", () => {
  // Keep who they are; clear what they wrote.
  const name = nameInput.value;
  const email = emailInput.value;
  form.reset();
  nameInput.value = name;
  emailInput.value = email;
  REQUIRED.forEach((field) => showError(field, ""));
  syncTopic();
  submitBtn.textContent = "Send message";
  sendError.hidden = true;
  sent.hidden = true;
  formWrap.hidden = false;
  messageInput.focus();
});

// "Before you write": always open on desktop; an accordion on mobile
// with the first question open.
const answers = document.querySelectorAll(".ct-qa");
function syncAnswers() {
  answers.forEach((d, i) => {
    d.open = DESKTOP.matches ? true : i === 0;
  });
}
answers.forEach((d) => {
  d.addEventListener("toggle", () => {
    if (DESKTOP.matches && !d.open) d.open = true;
  });
});
DESKTOP.addEventListener("change", syncAnswers);
syncAnswers();
syncTopic();
