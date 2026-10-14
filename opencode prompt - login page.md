# OpenCode task: log-in page to match the new sign-up page

Bring `sakada-web/auth/login.html` in line with the new sign-up page. It reuses the same layout and the same stylesheet (`css/signup.css`, all scoped to `.signup`):
- the photo panel on the left (a thin photo band on mobile)
- 48px fields with 16px text
- a show/hide password button
- sentence-case "Log in"
- spinners while "Log in" and "Continue with Google" are working
- errors in plain words, never Supabase's own message: wrong password, unconfirmed email, offline, too many tries

**Admin login (`auth/admin-login.html`) does not change.**

**All code below is final.** Claude built it and ran it in a browser at 1440 and 390px. On a copy of the site: lint clean, **118/118 unit tests**, **47/47 e2e tests**. **Copy every block exactly.** Don't change other files, and don't commit.

## 1. Replace `sakada-web/auth/login.html` with:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Log in — Sakada Logistics</title>
    <meta name="robots" content="noindex" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.mapbox.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com wss://*.supabase.co; frame-src 'none';" />
    <link rel="stylesheet" href="../css/fonts.css" />
    <link rel="stylesheet" href="../css/style.css" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="signup">
      <aside class="signup-aside">
        <div class="signup-top">
          <a class="logo" href="../index.html">SAKA<span class="mark">DA</span></a>
          <a class="signup-back" href="../index.html">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            <span class="signup-back-long">Back to home</span><span class="signup-back-short">Home</span>
          </a>
        </div>
        <div class="signup-pitch">
          <p class="signup-headline"><span>Your harvest.</span> <span>Their truck.</span> <span>One booking.</span></p>
          <p class="signup-lede">Book a truck, see where your delivery is, or pick up your next job. Every fare is set when the booking is made.</p>
        </div>
      </aside>

      <main class="signup-main" id="main">
        <div class="signup-panel">
          <h1>Welcome back</h1>
          <p class="signup-sub">Log in to book, track, or manage deliveries.</p>

          <form id="loginForm" novalidate>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" required autocomplete="email" inputmode="email" />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <div class="password-wrap">
                <input id="password" type="password" required autocomplete="current-password" />
                <button type="button" class="password-toggle" id="passwordToggle" aria-label="Show password" aria-pressed="false">
                  <svg class="icon-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2" /><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M2 2l20 20" /></svg>
                </button>
              </div>
              <p class="field-error" id="passwordError" hidden></p>
            </div>

            <div id="formMessage" class="form-message" role="alert"></div>

            <button class="btn-primary" type="submit" id="submitBtn">
              <span class="btn-spinner" aria-hidden="true"></span>
              <span class="btn-label">Log in</span>
            </button>
          </form>

          <div class="auth-divider">or</div>

          <button class="google-btn" id="googleBtn" type="button">
            <span class="btn-spinner" aria-hidden="true"></span>
            <svg class="google-g" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9C16.66 14.2 17.64 11.9 17.64 9.2z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            <span class="btn-label">Continue with Google</span>
          </button>

          <p class="auth-footer-link">
            New here? <a href="register.html">Create an account</a>
          </p>
          <p class="signup-admin">
            Are you an admin? <a href="admin-login.html">Admin login</a>
          </p>
        </div>
      </main>
    </div>

    <script type="module" src="../js/login.js"></script>
  </body>
</html>
```

## 2. Replace `sakada-web/js/login.js` with:
```js
import {
  loginWithEmail,
  loginWithGoogle,
  getCurrentProfile,
} from "./auth.js";
import { checkEmail, emailChecker, checkPassword } from "./validators.js";
import { validateFields, clearWhenFixed } from "./field-errors.js";
import { loginErrorCopy } from "./signup-result.js";

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

const messageEl = document.getElementById("formMessage");
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.className = "form-message visible error";
}
function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "form-message";
}

// Busy state for the submit and Google buttons: spinner + new label.
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);
  button.setAttribute("aria-busy", String(busy));
  button.querySelector(".btn-label").textContent = label;
}

const form = document.getElementById("loginForm");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// ---- Show / hide password ----
const passwordToggle = document.getElementById("passwordToggle");
passwordToggle.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(show));
  passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

const RULES = [
  [emailInput, emailChecker()],
  [passwordInput, checkPassword],
];
clearWhenFixed([
  [emailInput, (v) => checkEmail(v)],
  [passwordInput, checkPassword],
]);
form.addEventListener("input", clearMessage);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  if (!validateFields(RULES)) return;
  setBusy(submitBtn, true, "Logging in…");

  let error;
  try {
    ({ error } = await loginWithEmail({
      email: emailInput.value.trim(),
      password: passwordInput.value,
    }));
  } catch (err) {
    error = err;
  }

  if (error) {
    setBusy(submitBtn, false, "Log in");
    showMessage(loginErrorCopy(error));
    return;
  }

  const profile = await getCurrentProfile();
  window.location.href =
    DASHBOARD_PATHS[profile?.role] || "../index.html";
});

// ---- Google ----
const googleBtn = document.getElementById("googleBtn");
googleBtn.addEventListener("click", async () => {
  clearMessage();
  setBusy(googleBtn, true, "Opening Google…");
  let error;
  try {
    ({ error } = await loginWithGoogle());
  } catch (err) {
    error = err;
  }
  if (error) {
    setBusy(googleBtn, false, "Continue with Google");
    showMessage(loginErrorCopy(error));
  }
});
// Coming back with the Back button restores the page from cache: un-stick the buttons.
window.addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  setBusy(googleBtn, false, "Continue with Google");
  setBusy(submitBtn, false, "Log in");
});
```

## 3. Replace `sakada-web/js/signup-result.js` with:
(Same as now, plus a shared `isOffline` helper and a new `loginErrorCopy`.)
```js
// Turns a Supabase sign-up or log-in result into what the page shows.
// Never show Supabase's own error.message: it's developer English.

/**
 * With email confirmation on, Supabase does NOT return an error for an
 * email that already has an account (so nobody can probe which emails
 * exist). It returns a user with an empty `identities` list instead.
 */
export function isExistingAccount(data) {
  const identities = data?.user?.identities;
  return Array.isArray(identities) && identities.length === 0;
}

export const OFFLINE_MESSAGE =
  "No connection. Check your signal and try again. Your details are still here.";

/**
 * Plain copy for a sign-up (or Google) error.
 * `field` says which input the message belongs on; null = the form message.
 */
function isOffline(error) {
  return (
    error?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|load failed/i.test(String(error?.message || ""))
  );
}

export function signupErrorCopy(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const status = error?.status;

  if (isOffline(error)) {
    return { kind: "offline", field: null, message: OFFLINE_MESSAGE };
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered/i.test(message)
  ) {
    return { kind: "exists", field: "email", message: "This email already has an account." };
  }
  if (code.startsWith("over_") || status === 429) {
    return {
      kind: "rate",
      field: null,
      message: "Too many sign-ups right now. Try again in a few minutes.",
    };
  }
  if (code === "weak_password") {
    return {
      kind: "password",
      field: "password",
      message: "Pick a harder password: at least 8 characters that aren't easy to guess.",
    };
  }
  if (code === "email_address_invalid" || /email address .* is invalid/i.test(message)) {
    return {
      kind: "email",
      field: "email",
      message: "This email address doesn't look right. Check it and try again.",
    };
  }
  return {
    kind: "unknown",
    field: null,
    message: "We couldn't create your account. Try again in a minute.",
  };
}

/** Plain copy for a log-in (or Google) error, shown as the form message. */
export function loginErrorCopy(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (isOffline(error)) return OFFLINE_MESSAGE;
  if (code === "email_not_confirmed" || /not confirmed/i.test(message)) {
    return "Confirm your email first: tap the link we sent you. It signs you in.";
  }
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "That email and password don't match. Check both and try again.";
  }
  if (code.startsWith("over_") || error?.status === 429) {
    return "Too many tries. Wait a few minutes, then try again.";
  }
  return "We couldn't log you in. Try again in a minute.";
}
```

## 4. `sakada-web/css/signup.css`: three edits
a) The header comment at the top of the file. Replace:
```css
   Sign up (auth/register.html). Everything is scoped to .signup,
   so login and admin login keep the shared auth card.
```
with:
```css
   Sign up + log in (auth/register.html, auth/login.html).
   Everything is scoped to .signup, so admin login keeps the
   shared auth card.
```
b) Give the logo a 44px tap area. Replace:
```css
.signup-top .logo {
  font-size: 28px;
}
```
with:
```css
.signup-top .logo {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 28px;
}
```
c) Insert this block right **before** the line `/* ---- Success ---- */`:
```css
/* Log in page: the quiet admin line under "Create an account" */
.signup-admin {
  margin: 0;
  text-align: center;
  font-size: 14px;
  color: var(--text-muted);
}
.signup-admin a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  vertical-align: middle;
  color: var(--text-muted);
  text-underline-offset: 3px;
}
.signup-admin a:hover {
  color: var(--text-cream);
}

```

## 5. Replace `sakada-web/tests/signup-result.test.js` with:
```js
import { describe, it, expect } from "vitest";
import { isExistingAccount, signupErrorCopy, loginErrorCopy, OFFLINE_MESSAGE } from "../js/signup-result.js";

describe("isExistingAccount", () => {
  it("is true when Supabase returns a user with no identities", () => {
    expect(isExistingAccount({ user: { id: "u1", identities: [] } })).toBe(true);
  });
  it("is false for a brand-new user", () => {
    expect(isExistingAccount({ user: { id: "u1", identities: [{ id: "i1" }] } })).toBe(false);
  });
  it("is false when there is no user or no identities list", () => {
    expect(isExistingAccount(null)).toBe(false);
    expect(isExistingAccount({ user: null })).toBe(false);
    expect(isExistingAccount({ user: { id: "u1" } })).toBe(false);
  });
});

describe("signupErrorCopy", () => {
  it("never passes Supabase's own message through", () => {
    const copy = signupErrorCopy({ message: "Database error saving new user", status: 500 });
    expect(copy.kind).toBe("unknown");
    expect(copy.message).not.toMatch(/database/i);
  });
  it("maps a network failure to the offline message", () => {
    expect(signupErrorCopy({ name: "AuthRetryableFetchError", message: "Failed to fetch" }).message).toBe(OFFLINE_MESSAGE);
    expect(signupErrorCopy(new TypeError("Failed to fetch")).kind).toBe("offline");
  });
  it("maps an existing account to the email field", () => {
    expect(signupErrorCopy({ code: "user_already_exists", message: "User already registered" })).toMatchObject({ kind: "exists", field: "email" });
  });
  it("maps rate limits to plain words", () => {
    expect(signupErrorCopy({ code: "over_email_send_rate_limit", status: 429 }).message).toBe("Too many sign-ups right now. Try again in a few minutes.");
    expect(signupErrorCopy({ status: 429, message: "x" }).kind).toBe("rate");
  });
  it("puts a weak password on the password field", () => {
    expect(signupErrorCopy({ code: "weak_password" }).field).toBe("password");
  });
  it("puts an invalid email on the email field", () => {
    expect(signupErrorCopy({ code: "email_address_invalid", message: 'Email address "a@b.c" is invalid' }).field).toBe("email");
  });
});

describe("loginErrorCopy", () => {
  it("says the email and password don't match, without saying which", () => {
    expect(loginErrorCopy({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "That email and password don't match. Check both and try again.",
    );
  });
  it("asks an unconfirmed user to tap the email link", () => {
    expect(loginErrorCopy({ code: "email_not_confirmed", message: "Email not confirmed" })).toMatch(/^Confirm your email first/);
  });
  it("maps network failures and rate limits", () => {
    expect(loginErrorCopy(new TypeError("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
    expect(loginErrorCopy({ status: 429, message: "x" })).toMatch(/^Too many tries/);
  });
  it("never passes Supabase's own message through", () => {
    expect(loginErrorCopy({ message: "Database error querying schema", status: 500 })).toBe(
      "We couldn't log you in. Try again in a minute.",
    );
  });
});
```

## 6. `sakada-web/e2e/smoke.spec.mjs`
a) In the test `"login rejects a badly formed email"`, the button name changes from `"Log In"` to `"Log in"`:
```js
    await page.getByRole("button", { name: "Log in" }).click();
```
b) Append this block to the end of the file:
```js
test.describe("log in", () => {
  test("a wrong password gets plain words, not Supabase's message", async ({ page }) => {
    await page.route("**/auth/v1/token**", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }),
      }),
    );
    await page.goto("/auth/login.html");
    await page.fill("#email", "ana@gmail.com");
    await page.fill("#password", "wrongpass");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("#formMessage")).toHaveText("That email and password don't match. Check both and try again.");
    await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  test("show password toggles the field", async ({ page }) => {
    await page.goto("/auth/login.html");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
  });
});
```

## 7. Checks (from `sakada-web/`)
- `npm run lint` → no errors
- `npm test` → **118 passed** (was 114, plus 4 new)
- `npm run test:e2e` → **47 passed** (was 45, plus 2 new)
- `git status` should list only these 6 files as modified:
  - `auth/login.html`
  - `js/login.js`
  - `js/signup-result.js`
  - `css/signup.css`
  - `tests/signup-result.test.js`
  - `e2e/smoke.spec.mjs`

  (The sign-up files from the previous task are still uncommitted, so they'll show up too. That's fine.)

Don't commit. Claude will review.
