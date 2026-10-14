# OpenCode task: input validation on every form

**Bug from production:** the contact form accepted `name@gmail.co`. Its basic email check (and the browser's own `type="email"` on every other form) accepts anything shaped like `a@b.cc`. That's a typo nobody will ever get a reply at.

**Fix:** one shared validator module and one error-display helper, wired into **every form on the site**:
- contact
- register
- login
- admin login
- the farmer/vendor booking form
- the driver vehicle form
- the rating comment

The validator and helper code below is final and already passes its unit tests. **Copy it exactly.**

Don't commit.

## How the email check works (so you don't "simplify" it)
- **Format:** one `@`, real domain labels, and an ending of 2+ letters.
- **Blocked, with a "Did you mean …?" suggestion:**
  - a big provider's name on the wrong ending (`gmail.co`, `yahoo.co`, `icloud.co`, `gmail.com.ph`)
  - endings that don't exist (`.con`, `.cmo`, …)
- **Warned once:** a likely misspelling (`gmial.com`, `yaho.com`). If the person submits the same value again, it's accepted, because it might be real.
- **Accepted:** real domains like `yahoo.com.ph`, `mail.com`, school `.edu.ph` and company domains.
- **"Use name@gmail.com" button:** the error has one, so a single tap fixes the address.

## Files you may touch
- **New:**
  - `sakada-web/js/validators.js`
  - `sakada-web/js/field-errors.js`
  - `sakada-web/tests/validators.test.js`
- `sakada-web/css/forms.css`: append one block
- `sakada-web/js/contact.js`: replace the whole file
- `sakada-web/js/register.js`, `js/login.js`, `js/admin-login.js`
- `sakada-web/js/requester-dashboard.js`, `js/driver-dashboard.js`, `js/dashboard-shared.js`
- `sakada-web/auth/register.html`, `auth/login.html`, `auth/admin-login.html`: add `novalidate` only
- `sakada-web/dashboard/farmer/index.html`, `dashboard/vendor/index.html`, `dashboard/driver/index.html`: add `novalidate` only
- `sakada-web/e2e/smoke.spec.mjs`

Nothing else. No database changes.

---

## 1. New file `js/validators.js`
```js
// Input checks shared by every form on the site. Each check takes the raw
// value and returns an error message ("" when the value is fine), so every
// page words its errors the same way. Pure functions: no DOM, easy to test.

// ---------- Email ----------

// One "@", a domain made of dot-separated labels, and an ending of 2+ letters.
const EMAIL_FORMAT =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

// Big providers and every domain that is really theirs. Their name on any
// other ending (gmail.co, yahoo.con) is a typo, never a real inbox.
const PROVIDERS = {
  gmail: ["gmail.com"],
  googlemail: ["googlemail.com"],
  yahoo: ["yahoo.com", "yahoo.com.ph", "yahoo.co.uk"],
  ymail: ["ymail.com"],
  hotmail: ["hotmail.com", "hotmail.co.uk"],
  outlook: ["outlook.com"],
  live: ["live.com", "live.co.uk"],
  icloud: ["icloud.com"],
  protonmail: ["protonmail.com"],
};

// Real domains that look like a misspelt provider (mail.com vs gmail.com).
const NOT_TYPOS = new Set([
  "mail.com", "email.com", "gmx.com", "aol.com", "me.com", "mac.com",
  "msn.com", "proton.me", "pm.me", "zoho.com", "yandex.com",
]);

// Endings that don't exist; people type them when they mean ".com".
const BAD_ENDINGS = new Set(["con", "cmo", "cpm", "vom", "xom", "comm", "coom", "clm", "ocm"]);

// Damerau-Levenshtein distance (optimal string alignment).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Looks for a likely typo in a well-formed email.
 * Returns null, or { fix, sure }:
 * - sure: true  → certainly wrong (gmail.co, name@site.con); block it.
 * - sure: false → probably wrong (gmial.com); warn once, allow on retry.
 */
export function emailTypo(email) {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  const dot = domain.indexOf(".");
  const name = domain.slice(0, dot);
  const ending = domain.slice(dot + 1);

  // 1. A provider's name on the wrong ending: gmail.co, yahoo.cm
  if (PROVIDERS[name]) {
    if (PROVIDERS[name].includes(domain)) return null;
    return { fix: `${local}@${PROVIDERS[name][0]}`, sure: true };
  }

  // 2. An ending that doesn't exist: name@site.con
  if (BAD_ENDINGS.has(ending)) {
    return { fix: `${local}@${name}.com`, sure: true };
  }

  // 3. A misspelt provider name on a normal ending: gmial.com, yaho.com.ph
  if (!NOT_TYPOS.has(domain) && ["com", "com.ph", "co", "ph", "net"].includes(ending)) {
    for (const [provider, domains] of Object.entries(PROVIDERS)) {
      const limit = provider.length >= 6 ? 2 : 1;
      if (distance(name, provider) <= limit) {
        return { fix: `${local}@${domains[0]}`, sure: false };
      }
    }
  }
  return null;
}

/**
 * Checks an email. `allowed` is a value the user already re-sent after a
 * "probably wrong" warning, so it's accepted as typed.
 * Returns { message, fix }: message "" means OK; fix is a suggested email.
 */
export function checkEmail(value, allowed = "") {
  const v = value.trim();
  if (!v) return { message: "Enter your email.", fix: "" };
  if (v.length > 254 || !EMAIL_FORMAT.test(v)) {
    return { message: "That email doesn't look right. Check it, like name@email.com.", fix: "" };
  }
  const typo = emailTypo(v);
  if (!typo || (!typo.sure && v === allowed)) return { message: "", fix: "" };
  return {
    message: typo.sure
      ? `Did you mean ${typo.fix}?`
      : `Did you mean ${typo.fix}? If ${v} is correct, just submit again.`,
    fix: typo.fix,
  };
}

/**
 * A stateful email check for one form: a "probably wrong" warning shows
 * once, and the same value is accepted if the user submits it again.
 */
export function emailChecker() {
  let warned = "";
  return (value) => {
    const result = checkEmail(value, warned);
    const typo = result.fix ? emailTypo(value.trim()) : null;
    warned = typo && !typo.sure ? value.trim() : "";
    return result;
  };
}

// ---------- People ----------

export function checkName(value) {
  const v = value.trim();
  if (!v) return "Enter your name.";
  if (v.length < 2) return "Enter your full name.";
  if (v.length > 120) return "Keep your name under 120 characters.";
  if (!/\p{L}/u.test(v)) return "Your name needs at least one letter.";
  if (/[<>{}[\]\\/@#$%^*=+|~_]/.test(v)) return "Use letters, spaces, dots, dashes, or apostrophes only.";
  return "";
}

export function checkNewPassword(value) {
  if (!value) return "Create a password.";
  if (value.length < 8) return "Use at least 8 characters.";
  if (value.length > 72) return "Keep your password under 72 characters.";
  if (!value.trim()) return "Your password can't be only spaces.";
  return "";
}

export function checkPassword(value) {
  return value ? "" : "Enter your password.";
}

// ---------- Bookings ----------

export function checkAddress(value, which) {
  const v = value.trim();
  if (!v) return `Enter the ${which} address.`;
  if (v.length < 5) return "Add more detail, like the barangay and town or city.";
  if (v.length > 200) return "Keep the address under 200 characters.";
  if (!/\p{L}/u.test(v)) return "Write the address with the place name, not only numbers.";
  return "";
}

export function checkGoods(value) {
  const v = value.trim();
  if (!v) return "Say what you're sending, like onions or rice.";
  if (v.length < 2) return "Say what you're sending, like onions or rice.";
  if (v.length > 120) return "Keep this under 120 characters.";
  return "";
}

export function checkKg(value) {
  const v = String(value).trim();
  if (!v) return "Enter the weight in kg.";
  if (!/^\d+$/.test(v)) return "Use a whole number of kilograms, like 800.";
  const kg = Number(v);
  if (kg < 1) return "The weight must be at least 1 kg.";
  if (kg > 100000) return "That's over 100 tonnes. Check the number.";
  return "";
}

/** Local YYYY-MM-DD for `date` (what an <input type="date"> uses). */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function checkPickupDate(value, today = new Date()) {
  if (!value) return "Pick a pickup date.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Pick a pickup date from the calendar.";
  if (value < localDateString(today)) return "Pick today or a later date.";
  return "";
}

export function checkNotes(value) {
  return value.trim().length > 500 ? "Keep notes under 500 characters." : "";
}

// ---------- Driver vehicle ----------

export function checkVehicleType(value) {
  return value.trim().length > 40 ? "Keep this under 40 characters." : "";
}

export function checkPlate(value) {
  const v = value.trim();
  if (!v) return "";
  if (v.length > 15) return "Keep the plate under 15 characters.";
  if (!/^[A-Za-z0-9 -]+$/.test(v)) return "Use letters, numbers, spaces, or dashes only.";
  if (!/\d/.test(v)) return "A plate number has at least one digit.";
  return "";
}

// ---------- Contact ----------

export function checkMessage(value) {
  const v = value.trim();
  if (!v) return "Write your message.";
  if (v.length > 4900) return "Keep your message under 4,900 characters.";
  return "";
}

export function checkBookingCode(value) {
  const v = value.trim();
  if (!v) return "";
  return /^SK-?\d{3,8}$/i.test(v) ? "" : "Booking codes look like SK-00142.";
}
```

## 2. New file `js/field-errors.js`
```js
// Shows and clears the error under one form field. The message element
// sits right after the input (id = `${input.id}Error`; an existing one is
// reused) and is linked with aria-describedby, so screen readers read it
// together with the field.

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
    btn.textContent = `Use ${fix}`;
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
```

## 3. Append to the end of `css/forms.css`
```css
/* Per-field errors (js/field-errors.js) */
.field-error {
  margin: 0;
  font-size: 15px;
  line-height: 1.5;
  color: #f2a98a;
}
.field-error[hidden] { display: none; }
.field-error-fix {
  padding: 10px 0;
  margin: -10px 0;
  border: 0;
  background: none;
  color: var(--accent-amber);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.field-error-fix:hover,
.field-error-fix:focus-visible { color: var(--text-cream); }
.field input[aria-invalid="true"],
.field textarea[aria-invalid="true"],
.field select[aria-invalid="true"] {
  border-color: #e0542f;
  box-shadow: 0 0 0 1px #e0542f;
}
```

## 4. Add `novalidate` to these forms
The browser's own bubbles would fire before our checks and accept `gmail.co`, so turn them off. Change only the opening tag, nothing else in these files:
- `auth/register.html`: `<form id="registerForm">` → `<form id="registerForm" novalidate>`
- `auth/login.html`: `<form id="loginForm">` → `<form id="loginForm" novalidate>`
- `auth/admin-login.html`: `<form id="adminLoginForm">` → `<form id="adminLoginForm" novalidate>`
- `dashboard/farmer/index.html` and `dashboard/vendor/index.html`: `<form id="deliveryForm" class="delivery-form">` → `<form id="deliveryForm" class="delivery-form" novalidate>`
- `dashboard/driver/index.html`: `<form id="vehicleForm" class="vehicle-form">` → `<form id="vehicleForm" class="vehicle-form" novalidate>`

`pages/contact.html` already has `novalidate`. Don't touch it.

---

## 5. `js/contact.js`: replace the WHOLE file with this
It's the same page behaviour as now, but it uses the shared checks. The existing `contactNameError` / `contactEmailError` / `contactMessageError` elements are reused, and the booking code gets checked too.
```js
import { supabase } from "./supabase-client.js";
import { checkName, checkEmail, emailChecker, checkMessage, checkBookingCode } from "./validators.js";
import { validateFields, clearWhenFixed, clearFieldErrors } from "./field-errors.js";

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

// Topics where a booking code is useful. Must stay inside the DB's
// contact_purpose_valid list (booking, driver, vendor, support, other).
const CODE_TOPICS = new Set(["booking", "support"]);
const DESKTOP = window.matchMedia("(min-width: 901px)");

const checkCode = (v) => (codeField.hidden ? "" : checkBookingCode(v));
const RULES = [
  [nameInput, checkName],
  [emailInput, emailChecker()],
  [codeInput, checkCode],
  [messageInput, checkMessage],
];
clearWhenFixed([
  [nameInput, checkName],
  [emailInput, (v) => checkEmail(v)],
  [codeInput, checkCode],
  [messageInput, checkMessage],
]);

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
  // checked and sent for booking topics.
  codeField.hidden = !CODE_TOPICS.has(purpose.value);
  if (codeField.hidden) clearFieldErrors([codeInput]);
}
purpose.addEventListener("change", syncTopic);

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
  if (!validateFields(RULES)) return;

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
  clearFieldErrors([nameInput, emailInput, codeInput, messageInput]);
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
```

---

## 6. `js/register.js`
**6a.** Add these imports under the existing `import` line:
```js
import { checkName, checkEmail, emailChecker, checkNewPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
```

**6b.** Directly after `const submitBtn = document.getElementById("submitBtn");` add:
```js
const nameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
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
```

**6c.** In the submit handler, directly after `e.preventDefault();` add:
```js
  if (!validateFields(RULES)) return;
```
Nothing else changes in that file.

## 7. `js/login.js` and `js/admin-login.js` (the same change in both)
**7a.** Add these imports after the existing imports:
```js
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
```

**7b.** Directly after `const submitBtn = document.getElementById("submitBtn");` add:
```js
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
```

**7c.** In the submit handler, directly after `e.preventDefault();` add:
```js
  if (!validateFields(RULES)) return;
```

## 8. `js/requester-dashboard.js` (the farmer/vendor booking form)
**8a.** Add these imports after the existing imports:
```js
import {
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
  localDateString,
} from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
```

**8b.** Directly after `let pendingQuote = null;` add:
```js
const pickupDateInput = document.getElementById("scheduledPickup");
pickupDateInput.min = localDateString(); // no pickups in the past
const BOOKING_RULES = [
  [document.getElementById("pickupAddress"), (v) => checkAddress(v, "pickup")],
  [document.getElementById("dropoffAddress"), (v) => checkAddress(v, "drop-off")],
  [document.getElementById("goodsDescription"), checkGoods],
  [document.getElementById("quantityKg"), checkKg],
  [pickupDateInput, (v) => checkPickupDate(v)],
  [document.getElementById("notes"), checkNotes],
];
clearWhenFixed(BOOKING_RULES);
```

**8c.** In `form.addEventListener("submit", …)`, directly after the offline check's closing `}` (just before `clearMessage();`), add:
```js
  if (!validateFields(BOOKING_RULES)) return;
```

**8d.** In `confirmBtn.addEventListener("click", …)`, directly after `if (!pendingQuote) return;` add the following. The goods, date and notes can change after the estimate.
```js
  if (!validateFields(BOOKING_RULES)) return;
```

## 9. `js/driver-dashboard.js` (vehicle form)
**9a.** Add these imports after the existing imports:
```js
import { checkVehicleType, checkPlate } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
```

**9b.** Directly before `document.getElementById("vehicleForm").addEventListener("submit", …)` add:
```js
const VEHICLE_RULES = [
  [document.getElementById("vehicleType"), checkVehicleType],
  [document.getElementById("vehiclePlate"), checkPlate],
];
clearWhenFixed(VEHICLE_RULES);
```

**9c.** In that submit handler, directly after the offline check's closing `}`, add:
```js
  if (!validateFields(VEHICLE_RULES)) return;
```

## 10. `js/dashboard-shared.js` (rating comment)
In `renderRatingBlock`, add `maxlength="500"` to the rating textarea:
```html
<textarea class="rating-comment" data-comment-for="${sanitizeText(d.id)}" rows="2" maxlength="500" placeholder="How was this delivery? (optional)"></textarea>
```

---

## 11. New file `tests/validators.test.js`
```js
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkEmail,
  emailChecker,
  checkName,
  checkNewPassword,
  checkPassword,
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
  checkPlate,
  checkVehicleType,
  checkMessage,
  checkBookingCode,
} from "../js/validators.js";
import { validateFields, showFieldError } from "../js/field-errors.js";

describe("checkEmail", () => {
  it.each([
    "name@gmail.com",
    "maria.dela.cruz+sakada@gmail.com",
    "name@yahoo.com.ph",
    "name@mail.com",
    "juan@company.com.ph",
    "juan@mail.company.com",
    "juan@tip.edu.ph",
    "ana@proton.me",
  ])("accepts %s", (email) => {
    expect(checkEmail(email).message).toBe("");
  });

  it.each([
    ["name@gmail.co", "name@gmail.com"],
    ["name@gmail.con", "name@gmail.com"],
    ["name@yahoo.co", "name@yahoo.com"],
    ["ana@icloud.co", "ana@icloud.com"],
    ["ana@gmail.com.ph", "ana@gmail.com"],
    ["juan@site.con", "juan@site.com"],
  ])("blocks the typo %s and suggests %s", (email, fix) => {
    const r = checkEmail(email);
    expect(r.message).toBe(`Did you mean ${fix}?`);
    expect(r.fix).toBe(fix);
  });

  it.each(["juan@gmail", "juan@@gmail.com", "juan@.com", "juan.@gmail.com", "juan gmail.com"])(
    "rejects the badly formed %s",
    (email) => {
      expect(checkEmail(email).message).toMatch(/doesn't look right/);
    },
  );

  it("asks for an empty email", () => {
    expect(checkEmail("  ").message).toBe("Enter your email.");
  });

  it("warns once about a likely misspelling, then accepts it", () => {
    const check = emailChecker();
    expect(check("ana@gmial.com").fix).toBe("ana@gmail.com");
    expect(check("ana@gmial.com").message).toBe("");
  });

  it("never lets a certain typo through, even when re-sent", () => {
    const check = emailChecker();
    expect(check("ana@gmail.co").message).not.toBe("");
    expect(check("ana@gmail.co").message).not.toBe("");
  });
});

describe("people", () => {
  it("names", () => {
    expect(checkName("Ma. Dela Cruz-O'Neil")).toBe("");
    expect(checkName("José Rizal")).toBe("");
    expect(checkName("")).toBe("Enter your name.");
    expect(checkName("J")).toBe("Enter your full name.");
    expect(checkName("1234")).not.toBe("");
    expect(checkName("Juan <b>")).not.toBe("");
  });
  it("passwords", () => {
    expect(checkNewPassword("abcdefgh")).toBe("");
    expect(checkNewPassword("short")).toBe("Use at least 8 characters.");
    expect(checkNewPassword("        ")).not.toBe("");
    expect(checkNewPassword("a".repeat(73))).not.toBe("");
    expect(checkPassword("")).toBe("Enter your password.");
  });
});

describe("bookings", () => {
  const today = new Date(2026, 9, 14);
  it("addresses and goods", () => {
    expect(checkAddress("Marikina Public Market, Marikina City", "pickup")).toBe("");
    expect(checkAddress("", "pickup")).toBe("Enter the pickup address.");
    expect(checkAddress("12345", "drop-off")).not.toBe("");
    expect(checkGoods("Onions")).toBe("");
    expect(checkGoods("")).not.toBe("");
  });
  it("weight", () => {
    expect(checkKg("800")).toBe("");
    expect(checkKg("8.5")).not.toBe("");
    expect(checkKg("0")).not.toBe("");
    expect(checkKg("-3")).not.toBe("");
    expect(checkKg("")).toBe("Enter the weight in kg.");
  });
  it("pickup date", () => {
    expect(checkPickupDate("2026-10-14", today)).toBe("");
    expect(checkPickupDate("2026-12-01", today)).toBe("");
    expect(checkPickupDate("2026-10-13", today)).toBe("Pick today or a later date.");
    expect(checkPickupDate("", today)).toBe("Pick a pickup date.");
  });
  it("notes", () => {
    expect(checkNotes("Gate code 1234")).toBe("");
    expect(checkNotes("x".repeat(501))).not.toBe("");
  });
});

describe("vehicle and contact", () => {
  it("plates and vehicle type", () => {
    expect(checkPlate("NBC 1234")).toBe("");
    expect(checkPlate("123-ABC")).toBe("");
    expect(checkPlate("")).toBe("");
    expect(checkPlate("NB$123")).not.toBe("");
    expect(checkPlate("ABC")).not.toBe("");
    expect(checkVehicleType("x".repeat(41))).not.toBe("");
  });
  it("message and booking code", () => {
    expect(checkMessage("")).toBe("Write your message.");
    expect(checkBookingCode("sk-00142")).toBe("");
    expect(checkBookingCode("")).toBe("");
    expect(checkBookingCode("12345")).toBe("Booking codes look like SK-00142.");
  });
});

describe("field errors", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form><div class="field"><input id="email" /></div>
      <div class="field"><input id="name" /></div></form>`;
  });

  it("shows errors under the fields, links them, and focuses the first", () => {
    const email = document.getElementById("email");
    const name = document.getElementById("name");
    const ok = validateFields([
      [email, (v) => checkEmail(v)],
      [name, checkName],
    ]);
    expect(ok).toBe(false);
    expect(document.getElementById("emailError").textContent).toBe("Enter your email.");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe("emailError");
    expect(document.activeElement).toBe(email);
  });

  it("offers a one-tap fix that applies the suggestion", () => {
    const email = document.getElementById("email");
    email.value = "ana@gmail.co";
    validateFields([[email, (v) => checkEmail(v)]]);
    document.querySelector(".field-error-fix").click();
    expect(email.value).toBe("ana@gmail.com");
    expect(email.hasAttribute("aria-invalid")).toBe(false);
    expect(document.getElementById("emailError").hidden).toBe(true);
  });

  it("clears the error when shown with an empty message", () => {
    const name = document.getElementById("name");
    showFieldError(name, "Enter your name.");
    showFieldError(name, "");
    expect(document.getElementById("nameError").hidden).toBe(true);
    expect(name.hasAttribute("aria-invalid")).toBe(false);
  });
});
```

## 12. `e2e/smoke.spec.mjs`
**12a.** In the existing test "empty send shows field errors and sends nothing", change
```js
    await expect(page.locator("#contactEmailError")).toHaveText("Enter your email so we can reply.");
```
to
```js
    await expect(page.locator("#contactEmailError")).toHaveText("Enter your email.");
```

**12b.** Append at the end of the file:
```js
test.describe("email typos are caught", () => {
  test("register blocks gmail.co and one tap fixes it", async ({ page }) => {
    let called = false;
    await page.route("**/auth/v1/**", (route) => {
      called = true;
      return route.abort();
    });
    await page.goto("/auth/register.html");
    await page.fill("#fullName", "Ana Reyes");
    await page.fill("#email", "name@gmail.co");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.locator("#emailError")).toContainText("Did you mean name@gmail.com?");
    expect(called).toBe(false);
    await page.getByRole("button", { name: "Use name@gmail.com" }).click();
    await expect(page.locator("#email")).toHaveValue("name@gmail.com");
    await expect(page.locator("#emailError")).toBeHidden();
  });

  test("contact blocks gmail.co", async ({ page }) => {
    let posted = false;
    await page.route("**/rest/v1/contact_submissions**", (route) => {
      posted = true;
      return route.abort();
    });
    await page.goto("/pages/contact.html");
    await page.fill("#contactName", "Ana Reyes");
    await page.fill("#contactEmail", "name@gmail.co");
    await page.fill("#contactMessage", "Hello");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactEmailError")).toContainText("Did you mean name@gmail.com?");
    expect(posted).toBe(false);
  });

  test("login rejects a badly formed email", async ({ page }) => {
    await page.goto("/auth/login.html");
    await page.fill("#email", "juan@gmail");
    await page.fill("#password", "x");
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page.locator("#emailError")).toContainText("doesn't look right");
  });
});
```

---

## Rules
- Copy `validators.js`, `field-errors.js`, `contact.js` and the test file exactly. Don't "improve" the regexes or the messages.
- Don't change how any form submits or what it sends. Only add the checks.
- No new colours beyond the ones above.

## Check before you finish
From `sakada-web/`, run:
1. `npm run lint`
2. `npx vitest run` (the new validators tests plus the old 72)
3. `npm run test:e2e`

All three must pass. Report each result.
