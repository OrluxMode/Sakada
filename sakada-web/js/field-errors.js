
// Shows and clears the error under one form field. The message element
// sits right after the input (id = `${input.id}Error`; an existing one is
// reused) and is linked with aria-describedby, so screen readers read it
// together with the field.

import { t } from "./i18n.js";

export function showFieldError(input, message, fix = "") {
  const id = `${input.id}Error`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("p");
    el.id = id;
    el.className = "field-error";
    input.insertAdjacentElement("afterend", el);
  }
  const described = (input.getAttribute("aria-describedby") || "").split(" ").filter(Boolean);
  if (!described.includes(id)) input.setAttribute("aria-describedby", [...described, id].join(" "));

  el.textContent = message;
  if (message && fix) {
    // One tap applies the suggested correction (e.g. gmail.co → gmail.com).
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "field-error-fix";
    btn.textContent = t("Use {fix}", { fix });
    btn.addEventListener("click", () => {
      input.value = fix;
      showFieldError(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    el.append(" ", btn);
  }
  el.hidden = !message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

export function clearFieldErrors(inputs) {
  inputs.forEach((input) => showFieldError(input, ""));
}

function toResult(r) {
  return typeof r === "string" ? { message: r, fix: "" } : r;
}

/**
 * Runs [[input, check], …]. Each check(value) returns a message string or
 * { message, fix }. Shows every error, focuses the first bad field, and
 * returns true only when everything passes.
 */
export function validateFields(rules) {
  let first = null;
  for (const [input, check] of rules) {
    const { message, fix } = toResult(check(input.value));
    showFieldError(input, message, fix);
    if (message && !first) first = input;
  }
  if (first) first.focus();
  return !first;
}

/** Once a field is flagged, clear its error as soon as the value is fixed. */
export function clearWhenFixed(rules) {
  for (const [input, check] of rules) {
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") !== "true") return;
      if (!toResult(check(input.value)).message) showFieldError(input, "");
    });
  }
}
