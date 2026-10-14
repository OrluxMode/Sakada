# OpenCode task: rebuild the Contact page

Rebuild `pages/contact.html` from the approved Figma design. The old page made promises the business can't keep: a fake email, a fake hotline, "within 2 hours", 24/7, "guaranteed payouts", and a stat strip. All of that goes. The form keeps saving to the same `contact_submissions` table, so **no database change is needed.**

Don't commit.

## Reference (Figma file `8q1102hOL3ZvFsiePuJrQv`, page "contact")
- **"contact"**: desktop, 1440.
- **"contact (mobile)"**: 390.
- **"contact — form states (desktop)"**: 7 form states. Build every one of them.

## Product facts this copy relies on (don't change them)
- **No public email and no phone number.** The form is the only way to reach Sakada, and only admins can read messages (RLS in migration 0014).
- No reply-time, office-hours or 24/7 promises anywhere, including the success and error messages.
- A requester can cancel their own booking only while it's Pending ("Cancel request" on the delivery card in My Deliveries). After a driver accepts, an admin can cancel it until pickup (migration 0007).
- The fare is ₱150 + ₱15/km + ₱2/kg, with tolls included. The receiver pays the driver in cash at drop-off.
- DB limits (migration 0015):
  - name 1–120 characters
  - email 3–254
  - phone nullable; **stop sending it**
  - role is null or one of `farmer|vendor|driver|partner`
  - purpose is null or one of `booking|driver|vendor|support|other`
  - message 1–5000

## Files you may touch
- `sakada-web/pages/contact.html`: the `<head>` meta descriptions, and the whole `<main>`
- `sakada-web/css/contact.css`: **replace the whole file**. Only contact.html loads it.
- `sakada-web/js/contact.js`: **replace the whole file**
- `sakada-web/js/landing-auth.js`: one line (section 4)
- `sakada-web/e2e/smoke.spec.mjs`: append the tests in section 5

Nothing else. In particular, **don't edit `css/forms.css`.** It styles login, register and the dashboards, so the new inputs are scoped to `.ct-*` classes instead.

---

## 1. `pages/contact.html`

### 1a. `<head>`
Replace the two description metas:
```html
    <meta
      name="description"
      content="Questions about a booking, driving with Sakada, or partnering with us? Send the Sakada team a message and we'll reply by email."
    />
```
```html
    <meta property="og:description" content="Questions about a booking, driving with Sakada, or partnering with us? Send the Sakada team a message and we'll reply by email." />
```
Keep everything else in `<head>`: the CSP, the stylesheets (`fonts.css`, `style.css`, `contact.css`) and the favicon. Keep the header/nav, the footer and the three `<script>` tags exactly as they are.

### 1b. Replace the whole `<main id="main"> … </main>` with:
```html
    <main id="main">
      <section class="ct-hero" aria-labelledby="ct-title">
        <h1 id="ct-title">Get in touch.</h1>
        <div class="ct-hero-side">
          <p class="ct-lede">Send us a message and we'll reply by email. If it's about a delivery, include its booking code, like SK-00142. You'll find it on the delivery card in My Deliveries.</p>
          <a class="hiw-link ct-jump" href="#contact-form-heading">Write to us now</a>
        </div>
      </section>

      <div class="ct-band">
        <section class="ct-card" aria-labelledby="contact-form-heading">
          <div id="contactFormWrap">
            <h2 id="contact-form-heading" tabindex="-1">Send a message</h2>
            <form id="contactForm" novalidate>
              <fieldset class="ct-fields" id="contactFields">
                <fieldset class="ct-roles">
                  <legend class="ct-label">I'm writing as a <span class="ct-opt">(optional)</span></legend>
                  <div class="ct-pills">
                    <label class="ct-pill"><input class="visually-hidden" type="radio" name="contactRole" value="farmer" /><span>Farmer</span></label>
                    <label class="ct-pill"><input class="visually-hidden" type="radio" name="contactRole" value="vendor" /><span>Vendor</span></label>
                    <label class="ct-pill"><input class="visually-hidden" type="radio" name="contactRole" value="driver" /><span>Driver</span></label>
                    <label class="ct-pill"><input class="visually-hidden" type="radio" name="contactRole" value="partner" /><span>Business partner</span></label>
                  </div>
                </fieldset>

                <div class="ct-row">
                  <div class="ct-field">
                    <label class="ct-label" for="contactName">Full name <span class="ct-req" aria-hidden="true">*</span></label>
                    <input class="ct-input" id="contactName" name="name" type="text" autocomplete="name" maxlength="120" required placeholder="e.g. Maria Dimagiba" aria-describedby="contactNameError" />
                    <p class="ct-error" id="contactNameError" hidden></p>
                  </div>
                  <div class="ct-field">
                    <label class="ct-label" for="contactEmail">Email <span class="ct-req" aria-hidden="true">*</span></label>
                    <input class="ct-input" id="contactEmail" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required placeholder="you@email.com" aria-describedby="contactEmailError" />
                    <p class="ct-error" id="contactEmailError" hidden></p>
                  </div>
                </div>

                <div class="ct-field">
                  <label class="ct-label" for="contactPurpose">What's it about? <span class="ct-opt">(optional)</span></label>
                  <select class="ct-input is-empty" id="contactPurpose" name="purpose">
                    <option value="">Choose one</option>
                    <option value="booking">A booking I made</option>
                    <option value="support">A problem at drop-off</option>
                    <option value="vendor">Partnering with Sakada</option>
                    <option value="other">Something else</option>
                  </select>
                </div>

                <div class="ct-field" id="contactCodeField" hidden>
                  <label class="ct-label" for="contactCode">Booking code <span class="ct-opt">(optional)</span></label>
                  <input class="ct-input" id="contactCode" name="code" type="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="SK-00142" />
                </div>

                <div class="ct-field">
                  <label class="ct-label" for="contactMessage">Message <span class="ct-req" aria-hidden="true">*</span></label>
                  <textarea class="ct-input" id="contactMessage" name="message" rows="4" maxlength="4900" required placeholder="Tell us what you're moving, from where to where, or what went wrong." aria-describedby="contactMessageError"></textarea>
                  <p class="ct-error" id="contactMessageError" hidden></p>
                </div>
              </fieldset>

              <p class="ct-send-error" id="contactSendError" role="alert" hidden>It didn't send. Your message is still here. Check your connection and try again.</p>

              <div class="ct-actions">
                <button class="btn-primary ct-submit" type="submit" id="contactSubmit">Send message</button>
                <p class="ct-note">Only the Sakada team can read your message.</p>
              </div>
            </form>
          </div>

          <div class="ct-sent" id="contactSent" hidden>
            <h2 id="contactSentHeading" tabindex="-1">Message sent.</h2>
            <p class="ct-sent-lead" id="contactSentLead"></p>
            <p class="ct-note">Forgot something? Send another message.</p>
            <button class="btn-outline" type="button" id="contactAgain">Send another</button>
          </div>
        </section>

        <section class="ct-answers" aria-labelledby="ct-answers-heading">
          <h2 id="ct-answers-heading">Before you write</h2>
          <p class="ct-answers-sub"><span class="ct-mobile-only">Tap a question. </span>You might not need to wait for a reply.</p>
          <div class="ct-qa-list">
            <details class="ct-qa" open>
              <summary>A problem with a booking?<svg class="ct-chev" width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1l6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
              <p>Still Pending? Cancel it yourself with Cancel request on the delivery card in My Deliveries. Already accepted by a driver? Send us the booking code, and we can cancel it until pickup.</p>
              <p class="ct-qa-more"><a class="hiw-link" href="../auth/login.html" data-dashboard-link>Go to My Deliveries</a></p>
            </details>
            <details class="ct-qa">
              <summary>The driver asked for more than the fare?<svg class="ct-chev" width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1l6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
              <p>The driver is paid exactly the fare in the booking. Whoever booked can show it from My Deliveries; if you're the receiver, ask them for it. Then send us the booking code.</p>
            </details>
            <details class="ct-qa">
              <summary>Want to drive with Sakada?<svg class="ct-chev" width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1l6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
              <p>No need to message us. Sign up as a driver and you can start accepting jobs.</p>
              <p class="ct-qa-more"><a class="hiw-link" href="../auth/register.html?role=driver" data-auth-cta="drive">Sign up to drive</a></p>
            </details>
            <details class="ct-qa">
              <summary>How is the fare worked out?<svg class="ct-chev" width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1l6 6 6-6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
              <p>₱150 base + ₱15 per km + ₱2 per kg, with expressway tolls included. The receiver pays the driver that amount in cash at drop-off.</p>
              <p class="ct-qa-more"><a class="hiw-link" href="how-it-works.html">See how it works</a></p>
            </details>
          </div>
        </section>
      </div>
    </main>
```
Notes:
- `hiw-link` (pages.css) already gives links a 44px hit area. `visually-hidden` (nav.css), `btn-primary` and `btn-outline` already exist. Reuse them; don't redefine them.
- The phone field, eyebrow, contact cards, pulsing status dot and stat strip are all gone. Make sure none of them are left in the file.

---

## 2. `css/contact.css`: replace the WHOLE file with this
```css
/* ================================================
   Contact page (pages/contact.html only)
   Inputs are scoped to .ct-* so forms.css (login,
   register, dashboards) is untouched.
   ================================================ */

/* Hero */
.ct-hero {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(0, 1fr);
  column-gap: 96px;
  align-items: start;
  padding: 40px clamp(20px, 5vw, 64px) 32px;
  border-bottom: 1px solid var(--line);
}
.ct-hero h1 { margin: 0; font-size: clamp(40px, 5.5vw, 64px); }
.ct-hero-side { display: flex; flex-direction: column; gap: 20px; padding-top: 10px; }
.ct-lede { margin: 0; max-width: 576px; font-size: 18px; line-height: 1.65; color: var(--text-muted); }
.ct-jump { display: none; }

/* Form + answers band */
.ct-band {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
  column-gap: 96px;
  align-items: start;
  padding: 56px clamp(20px, 5vw, 64px) 72px;
}

.ct-card {
  padding: 32px;
  border: 1px solid rgba(184, 180, 166, 0.35);
  border-radius: var(--radius-md);
}
.ct-card h2 { margin: 0 0 24px; font-size: 32px; }
.ct-card h2:focus { outline: none; }
.ct-card :focus-visible { outline-color: var(--text-cream); }

.ct-fields,
.ct-roles {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}
.ct-fields { display: flex; flex-direction: column; gap: 24px; }
.ct-fields:disabled { opacity: 0.55; }

.ct-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ct-field { display: flex; flex-direction: column; gap: 8px; }
.ct-field[hidden] { display: none; }

.ct-label {
  padding: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-cream);
}
.ct-req { color: var(--accent-amber); }
.ct-opt { font-weight: 400; color: var(--text-muted); }

/* Role pills (radio group) */
.ct-roles legend { margin-bottom: 10px; }
.ct-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.ct-pill span {
  display: inline-flex;
  align-items: center;
  min-height: 50px;
  padding: 0 18px;
  border: 1px solid rgba(184, 180, 166, 0.6);
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-cream);
  cursor: pointer;
  transition: border-color 150ms ease-out, background 150ms ease-out, color 150ms ease-out;
}
.ct-pill:hover span { border-color: var(--text-cream); }
.ct-pill input:checked + span {
  border-color: var(--accent-amber);
  background: rgba(224, 151, 47, 0.12);
  color: var(--accent-amber);
}
.ct-pill input:focus-visible + span {
  outline: 2px solid var(--text-cream);
  outline-offset: 2px;
}

/* Inputs */
.ct-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 52px;
  padding: 13px 16px;
  background: var(--bg-black);
  border: 1px solid rgba(184, 180, 166, 0.6);
  border-radius: var(--radius-md);
  color: var(--text-cream);
  font-family: inherit;
  font-size: 16px;
  line-height: 1.5;
  transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
}
.ct-input::placeholder { color: #858175; opacity: 1; }
.ct-input:hover { border-color: rgba(184, 180, 166, 0.85); }
.ct-input:focus-visible {
  outline: none;
  border-color: var(--text-cream);
  box-shadow: 0 0 0 1px var(--text-cream);
}
.ct-input[aria-invalid="true"] {
  border-color: #e0542f;
  box-shadow: 0 0 0 1px #e0542f;
}
textarea.ct-input { min-height: 132px; resize: vertical; }
select.ct-input {
  appearance: none;
  padding-right: 48px;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='8' viewBox='0 0 14 8'%3E%3Cpath d='M1 1l6 6 6-6' fill='none' stroke='%23f3efe4' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 18px center;
}
select.ct-input.is-empty { color: #858175; }
select.ct-input option { background: var(--panel-dark); color: var(--text-cream); }

.ct-error { margin: 0; font-size: 15px; line-height: 1.5; color: #f2a98a; }

/* Send row */
.ct-send-error { margin: 24px 0 0; font-size: 16px; line-height: 1.6; color: #f2a98a; }
.ct-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  margin-top: 32px;
}
.ct-submit { justify-content: center; }
.ct-submit:disabled { cursor: progress; transform: none; }
.ct-note { margin: 0; font-size: 16px; line-height: 1.6; color: var(--text-muted); }

/* Sent (replaces the form in place) */
.ct-sent { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
.ct-sent[hidden] { display: none; }
.ct-sent h2 { margin: 0; }
.ct-sent-lead { margin: 0; font-size: 18px; line-height: 1.6; color: #a9d18f; }

/* Before you write */
.ct-answers h2 { margin: 0; font-size: 32px; }
.ct-answers-sub { margin: 12px 0 0; font-size: 16px; line-height: 1.6; color: var(--text-muted); }
.ct-mobile-only { display: none; }
.ct-qa-list { margin-top: 20px; }
.ct-qa {
  padding: 24px 0;
  border-top: 1px solid rgba(184, 180, 166, 0.35);
}
.ct-qa summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  list-style: none;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 700;
  font-size: 24px;
  line-height: 1.2;
  color: var(--text-cream);
  cursor: default;
}
.ct-qa summary::-webkit-details-marker { display: none; }
.ct-chev { display: none; flex-shrink: 0; transition: transform 150ms ease-out; }
.ct-qa p { margin: 8px 0 0; font-size: 16px; line-height: 1.6; color: var(--text-muted); }
.ct-qa .ct-qa-more { margin-top: 8px; }

@media (min-width: 901px) {
  /* Desktop: the answers are always open, not an accordion */
  .ct-qa summary { pointer-events: none; }
}

@media (max-width: 900px) {
  .ct-hero {
    grid-template-columns: 1fr;
    row-gap: 20px;
    padding: 72px clamp(20px, 5vw, 64px) 48px;
  }
  .ct-hero-side { padding-top: 0; }
  .ct-lede { font-size: 16px; }
  .ct-jump { display: inline-block; }

  .ct-band {
    grid-template-columns: 1fr;
    row-gap: 40px;
    padding: 48px clamp(20px, 5vw, 64px) 72px;
  }
  .ct-answers { order: -1; }
  .ct-answers h2 { font-size: 28px; }
  .ct-mobile-only { display: inline; }
  .ct-qa { padding: 16px 0; }
  .ct-qa:last-child { border-bottom: 1px solid rgba(184, 180, 166, 0.35); }
  .ct-qa summary { min-height: 44px; font-size: 20px; cursor: pointer; }
  .ct-chev { display: block; }
  .ct-qa[open] .ct-chev { transform: rotate(180deg); }

  .ct-card { padding: 24px 20px; }
  .ct-card h2 { font-size: 28px; }
  .ct-row { grid-template-columns: 1fr; gap: 24px; }
  .ct-actions { flex-direction: column; align-items: stretch; }
  .ct-submit { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .ct-pill span,
  .ct-input,
  .ct-chev { transition: none; }
}
```

---

## 3. `js/contact.js`: replace the WHOLE file with this
```js
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
```

---

## 4. `js/landing-auth.js`: one change
The contact page now has a second `data-dashboard-link` ("Go to My Deliveries"), and `applyLandingState` only updates the first. Replace:
```js
  const dash = doc.querySelector("[data-dashboard-link]");
  if (dash) dash.href = state.dashboard;
```
with:
```js
  doc.querySelectorAll("[data-dashboard-link]").forEach((el) => (el.href = state.dashboard));
```
Change nothing else in that file. `tests/landing-auth.test.js` must still pass.

---

## 5. `e2e/smoke.spec.mjs`: append at the end of the file
```js
test.describe("contact form", () => {
  test("empty send shows field errors and sends nothing", async ({ page }) => {
    let posted = false;
    await page.route("**/rest/v1/contact_submissions**", (route) => {
      posted = true;
      return route.abort();
    });
    await page.goto("/pages/contact.html");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactNameError")).toHaveText("Enter your name.");
    await expect(page.locator("#contactEmailError")).toHaveText("Enter your email so we can reply.");
    await expect(page.locator("#contactMessageError")).toHaveText("Write your message.");
    await expect(page.locator("#contactName")).toBeFocused();
    expect(posted).toBe(false);
  });

  test("booking code field only shows for booking topics", async ({ page }) => {
    await page.goto("/pages/contact.html");
    await expect(page.locator("#contactCodeField")).toBeHidden();
    await page.selectOption("#contactPurpose", "booking");
    await expect(page.locator("#contactCodeField")).toBeVisible();
    await page.selectOption("#contactPurpose", "other");
    await expect(page.locator("#contactCodeField")).toBeHidden();
  });

  test("a failed send keeps the message and offers Try again", async ({ page }) => {
    await page.route("**/rest/v1/contact_submissions**", (route) => route.abort());
    await page.goto("/pages/contact.html");
    await page.fill("#contactName", "Ana Reyes");
    await page.fill("#contactEmail", "ana.reyes@email.com");
    await page.fill("#contactMessage", "Test message");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator("#contactSendError")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.locator("#contactMessage")).toHaveValue("Test message");
  });

  test("has no phone field and no fake contact details", async ({ page }) => {
    await page.goto("/pages/contact.html");
    await expect(page.locator("#contactPhone")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("hello@sakadalogistics.ph");
    expect(body).not.toContain("8800");
    expect(body).not.toContain("2 hours");
  });
});
```

---

## Rules
- Copy text exactly as written above: apostrophes, "₱", "…" and the "SK-00142" example.
- No new colours beyond the ones in the CSS above. No icons other than the chevron SVG and the select's data-URI chevron. No emoji.
- Don't touch any other page, `forms.css`, `pages.css`, `nav.css` or the database.
- No inline `style=""` attributes in the HTML.

## Check before you finish
From `sakada-web/`, run:
1. `npm run lint`
2. `npx vitest run`
3. `npm run test:e2e`

All three must pass. Report each result.
