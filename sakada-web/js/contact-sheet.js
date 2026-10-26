// Contact Support inside the dashboard (Figma 327:1289, sent 327:1391).
// Same table and checks as the website's contact form, but the name and
// email come from the account, so only the topic and message are asked.
// Opened from Profile, or from a shipment with its booking code filled in.

import { supabase } from "./supabase-client.js";
import { checkMessage, checkBookingCode } from "./validators.js";
import { validateFields, clearWhenFixed, clearFieldErrors } from "./field-errors.js";

// Topics where a booking code helps. Must stay inside the DB's
// contact_purpose_valid list (booking, driver, vendor, support, other).
const CODE_TOPICS = new Set(["booking", "support"]);

/**
 * @param {object} o
 * @param {HTMLDialogElement} o.sheet
 * @param {(dialog: HTMLDialogElement) => void} o.openSheet
 * @param {{ full_name: string }} o.profile
 * @param {string} o.role  farmer or vendor
 * @param {() => string} o.email  the account's email (loads after the page)
 */
export function createContactSheet({ sheet, openSheet, profile, role, email }) {
  const $ = (id) => sheet.querySelector(`#${id}`);
  const form = $("contactForm");
  const formWrap = $("contactFormWrap");
  const sent = $("contactSent");
  const codeField = $("contactCodeField");
  const codeInput = $("contactCode");
  const message = $("contactMessage");
  const submitBtn = $("contactSubmit");
  const sendError = $("contactSendError");
  const topics = [...form.querySelectorAll('input[name="contactTopic"]')];

  const topic = () => topics.find((t) => t.checked)?.value || "";
  const checkCode = (v) => (codeField.hidden ? "" : checkBookingCode(v));
  const rules = [
    [codeInput, checkCode],
    [message, checkMessage],
  ];
  clearWhenFixed(rules);

  function syncTopic() {
    // A typed code stays if the topic changes; it's only checked and sent for booking topics.
    codeField.hidden = !CODE_TOPICS.has(topic());
    if (codeField.hidden) clearFieldErrors([codeInput]);
  }
  topics.forEach((t) => t.addEventListener("change", syncTopic));
  // The topic is optional: tapping the chosen one again clears it.
  topics.forEach((t) => {
    let was = false;
    t.closest("label").addEventListener("pointerdown", () => (was = t.checked));
    t.addEventListener("click", () => {
      if (was) {
        t.checked = false;
        syncTopic();
      }
      was = false;
    });
  });

  let sending = false;
  function setSending(on) {
    sending = on;
    submitBtn.disabled = on;
    submitBtn.setAttribute("aria-busy", String(on));
    submitBtn.textContent = on ? "Sending…" : "Send message";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    sendError.hidden = true;
    if (!validateFields(rules)) return;
    const purpose = topic() || null;
    const code = CODE_TOPICS.has(purpose) ? codeInput.value.trim().toUpperCase() : "";
    const text = message.value.trim();
    const to = email();
    setSending(true);
    let error = null;
    try {
      ({ error } = await supabase.from("contact_submissions").insert({
        name: profile.full_name.slice(0, 120),
        email: to,
        role,
        purpose,
        // No booking-code column: the code goes at the top, as on the website.
        message: code ? `Booking code: ${code}\n\n${text}` : text,
      }));
    } catch (err) {
      error = err;
    }
    setSending(false);
    if (error) {
      submitBtn.textContent = "Try again";
      sendError.hidden = false;
      return;
    }
    $("contactSentLead").textContent = `We'll reply by email to ${to}.${code ? ` Your message is about ${code}.` : ""}`;
    formWrap.hidden = true;
    sent.hidden = false;
    $("contactSentTitle").focus();
  });

  /** Open the sheet; with a booking code, it's about that booking. */
  return function open(bookingCode = "") {
    if (!sent.hidden) {
      // Last time ended on "Message sent": start a fresh message.
      form.reset();
      sent.hidden = true;
      formWrap.hidden = false;
      submitBtn.textContent = "Send message";
    }
    if (bookingCode) {
      topics.find((t) => t.value === "booking").checked = true;
      codeInput.value = bookingCode;
    }
    syncTopic();
    sendError.hidden = true;
    clearFieldErrors([codeInput, message]);
    const to = email();
    $("contactReply").textContent = to ? `We reply by email to ${to}.` : "We reply by email.";
    openSheet(sheet);
  };
}

/**
 * Keeps a bottom sheet's fields above the phone keyboard: while it's open,
 * the sheet sits on top of the keyboard instead of behind it.
 */
export function liftAboveKeyboard(dialog) {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    dialog.style.setProperty("--rq-keyboard", `${Math.round(covered)}px`);
  };
  dialog.addEventListener("focusin", () => {
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
  });
  dialog.addEventListener("close", () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    dialog.style.removeProperty("--rq-keyboard");
  });
}
