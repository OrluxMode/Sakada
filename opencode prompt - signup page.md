# OpenCode task: sign-up page redesign

Rebuild `sakada-web/auth/register.html` to match the approved Figma design. Figma file `8q1102hOL3ZvFsiePuJrQv`, page "signup":
- desktop `131:294`
- mobile `133:299`
- desktop with `?role=driver`: `145:299`
- states + build notes: `145:380`

**All code below is final.** Claude built it, ran it in a browser at 1440, 390 and 320px, and ran lint + unit + e2e on a copy of the site. Results: lint clean, **114/114 unit tests**, **45/45 e2e tests**. **Copy every block exactly.** Don't change other files, and don't commit.

What changes for users:
- **Layout:** a photo panel sits beside the form on desktop and becomes a thin photo band on top on mobile.
- **Role choice:** Farmer / Vendor / Driver become radio cards with a one-line description each. A note says the role can't be changed later.
- **Fields:** inputs are 48px tall with 16px text, there's a show/hide password button, and the password rule is shown up front.
- **Errors in plain words:** offline, rate limit, and an email that already has an account (with a "Log in instead" link).
- **Busy states:** the "Create account" and "Continue with Google" buttons show a spinner while they work.
- **Success panel:** it replaces the form, says what to do next for the chosen role, and has a "Start over" link.

Two bugs it fixes:
1. **Duplicate emails.** With email confirmation on, Supabase returns **no error** for an email that already has an account; it returns a user with an empty `identities` list. The old page then said "Account created" and no email ever arrived. The new code checks `identities.length === 0`.
2. **Wrong success message.** The old message said "Check your email to confirm, then log in". The confirmation link already signs the user in and opens their dashboard, so the new success panel says that instead.

## 1. Replace `sakada-web/auth/register.html` with:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign up — Sakada Logistics</title>
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
        <div class="signup-pitch" data-pitch="requester">
          <p class="signup-headline"><span>Your harvest.</span> <span>Their truck.</span> <span>One booking.</span></p>
          <p class="signup-lede">See the fare before you book: ₱150 base + ₱15 per km + ₱2 per kg, tolls included. Then follow every delivery from Pending to Delivered.</p>
        </div>
        <div class="signup-pitch" data-pitch="driver" hidden>
          <p class="signup-headline"><span>See the load.</span> <span>Know the fare.</span> <span>Then accept.</span></p>
          <p class="signup-lede">Every job shows the kg, the route and the fare before you take it. The receiver pays you that exact fare in cash at drop-off.</p>
        </div>
      </aside>

      <main class="signup-main" id="main">
        <div class="signup-panel" id="signupFormPanel">
          <h1>Create your account</h1>
          <p class="signup-sub">Book a truck for your harvest, or take delivery jobs as a driver.</p>

          <form id="registerForm" novalidate>
            <fieldset class="role-field" aria-describedby="roleNote">
              <legend>I am a…</legend>
              <p class="role-note" id="roleNote">Farmers and vendors get the same booking tools. Drivers get a jobs account. You can't switch later.</p>
              <div class="role-cards">
                <label class="role-card">
                  <input type="radio" name="role" value="farmer" checked />
                  <span class="role-card-title">Farmer</span>
                  <span class="role-card-desc">I grow and ship my harvest.</span>
                </label>
                <label class="role-card">
                  <input type="radio" name="role" value="vendor" />
                  <span class="role-card-title">Vendor</span>
                  <span class="role-card-desc">I sell produce and book deliveries.</span>
                </label>
                <label class="role-card">
                  <input type="radio" name="role" value="driver" />
                  <span class="role-card-title">Driver</span>
                  <span class="role-card-desc">I drive a truck and take delivery jobs.</span>
                </label>
              </div>
            </fieldset>

            <div class="field">
              <label for="fullName">Full name</label>
              <input id="fullName" type="text" required autocomplete="name" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" required autocomplete="email" inputmode="email" />
            </div>
            <div class="field">
              <label for="password">Password</label>
              <div class="password-wrap">
                <input id="password" type="password" required minlength="8" autocomplete="new-password" aria-describedby="passwordHint" />
                <button type="button" class="password-toggle" id="passwordToggle" aria-label="Show password" aria-pressed="false">
                  <svg class="icon-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2" /><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M2 2l20 20" /></svg>
                </button>
              </div>
              <p class="field-error" id="passwordError" hidden></p>
              <p class="signup-hint" id="passwordHint">At least 8 characters.</p>
            </div>

            <div id="formMessage" class="form-message" role="alert"></div>

            <button class="btn-primary" type="submit" id="submitBtn">
              <span class="btn-spinner" aria-hidden="true"></span>
              <span class="btn-label">Create account</span>
            </button>
            <p class="signup-confirm-note">We'll email you a link to confirm your account.</p>
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
            Already have an account? <a href="login.html">Log in</a>
          </p>
        </div>

        <section class="signup-panel signup-success" id="signupSuccess" tabindex="-1" aria-labelledby="successTitle" hidden>
          <svg class="signup-success-icon" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="#e0972f" fill-opacity=".12" stroke="#e0972f" stroke-opacity=".5" /><path d="M12 17h24v15H12z" stroke="#f0b25a" stroke-width="2.5" stroke-linejoin="round" /><path d="M12 18l12 8 12-8" stroke="#f0b25a" stroke-width="2.5" stroke-linejoin="round" /></svg>
          <h2 id="successTitle">Check your email</h2>
          <p class="signup-success-text">We sent a link to <strong id="successEmail"></strong>. Tap it to confirm. It signs you in and opens your dashboard.</p>
          <div class="signup-next">
            <p class="signup-next-label">Then</p>
            <p id="successNext"></p>
          </div>
          <p class="signup-spam">Didn't get it? Check your spam or promotions folder.</p>
          <p class="signup-success-links">
            <span>Wrong email? <button type="button" class="text-link" id="startOver">Start over</button></span>
            <span>Already confirmed? <a class="text-link" href="login.html">Log in</a></span>
          </p>
        </section>
      </main>
    </div>

    <script type="module" src="../js/register.js"></script>
  </body>
</html>
```

## 2. New file `sakada-web/css/signup.css`
```css
/* ================================================
   Sign up (auth/register.html). Everything is scoped to .signup,
   so login and admin login keep the shared auth card.
   Desktop: photo panel left, form right on the 32px grid.
   ≤ 900px: a thin photo band on top, then the form.
   ================================================ */
.signup {
  --signup-line: rgb(var(--cream-rgb) / 0.45);
  --grid-line: rgb(var(--cream-rgb) / 0.05);
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 5fr);
  min-height: 100vh;
}
.signup button {
  font-family: inherit;
}

/* ---- Photo panel ---- */
.signup-aside {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 36px 64px 64px;
  border-right: 1px solid var(--line);
  background-image:
    linear-gradient(90deg, rgb(var(--ink-rgb) / 0.55) 0%, rgb(var(--ink-rgb) / 0.15) 80%, rgb(var(--ink-rgb) / 0.7) 100%),
    linear-gradient(180deg, rgb(var(--ink-rgb) / 0.35) 0%, rgb(var(--ink-rgb) / 0.2) 45%, rgb(var(--ink-rgb) / 0.96) 100%),
    image-set(url("../assets/hero.webp") type("image/webp"), url("../assets/hero.jpg") type("image/jpeg"));
  background-size: auto, auto, cover;
  background-position: 0 0, 0 0, 30% 45%;
  background-repeat: no-repeat;
}
.signup-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.signup-top .logo {
  font-size: 28px;
}
.signup-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-cream);
  text-decoration: none;
}
.signup-back:hover .signup-back-long,
.signup-back:hover .signup-back-short {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.signup-back-short {
  display: none;
}
.signup-pitch[hidden] {
  display: none;
}
.signup-headline {
  margin: 0 0 20px;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: clamp(56px, 5.6vw, 80px);
  line-height: 0.95;
  letter-spacing: -0.01em;
  color: var(--text-cream);
}
.signup-headline span {
  display: block;
}
.signup-lede {
  max-width: 30em;
  margin: 0;
  font-size: 18px;
  line-height: 1.55;
  color: #d9d5c8;
}

/* ---- Form side ---- */
.signup-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 56px 40px;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
}
.signup-panel {
  width: 100%;
  max-width: 480px;
}
.signup-panel[hidden] {
  display: none;
}
.signup h1 {
  font-size: 44px;
  line-height: 1;
  margin: 0 0 8px;
}
.signup-sub {
  margin: 0 0 28px;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-muted);
}

/* ---- Role radio cards ---- */
.role-field {
  margin: 0 0 24px;
  padding: 0;
  border: 0;
  min-width: 0;
}
.role-field legend {
  padding: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-cream);
}
.role-note {
  margin: 4px 0 10px;
  font-size: 16px;
  line-height: 1.5;
  color: #d9d5c8;
}
.role-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.role-card {
  display: grid;
  grid-template-columns: 18px 1fr;
  align-items: center;
  column-gap: 10px;
  row-gap: 8px;
  align-content: start;
  padding: 14px;
  background: var(--bg-black);
  border: 1px solid var(--signup-line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.role-card:hover {
  border-color: rgb(var(--cream-rgb) / 0.7);
}
.role-card input {
  appearance: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1.5px solid rgb(var(--cream-rgb) / 0.6);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.role-card input:checked {
  border: 5px solid var(--accent-amber);
  background: var(--bg-black);
}
.role-card input:focus-visible {
  outline: none;
}
.role-card:has(input:focus-visible) {
  outline: 2px solid var(--accent-amber);
  outline-offset: 3px;
}
.role-card:has(input:checked) {
  border-color: var(--accent-amber);
  box-shadow: inset 0 0 0 0.5px var(--accent-amber);
  background: rgb(224 151 47 / 0.1);
}
.role-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-cream);
}
.role-card:has(input:checked) .role-card-title {
  color: #f0b25a;
}
.role-card-desc {
  grid-column: 1 / -1;
  font-size: 15px;
  line-height: 1.4;
  color: var(--text-muted);
}

/* ---- Fields: 48px, 16px text (no iOS zoom), 3:1+ edges ---- */
.signup .field label {
  font-size: 15px;
  color: var(--text-cream);
}
.signup .field input {
  min-height: 48px;
  padding: 0 14px;
  font-size: 16px;
  background: var(--bg-black);
  border-color: var(--signup-line);
  border-radius: var(--radius-btn);
}
.signup .field input:hover {
  border-color: rgb(var(--cream-rgb) / 0.7);
}
.signup .field input:focus-visible {
  border-color: var(--accent-amber);
  box-shadow: 0 0 0 3px rgb(224 151 47 / 0.25);
}
.signup .field input[aria-invalid="true"] {
  border-color: #e0542f;
  box-shadow: 0 0 0 1px #e0542f;
}
.password-wrap {
  position: relative;
}
.password-wrap input {
  width: 100%;
  padding-right: 50px;
}
.password-toggle {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-btn);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.password-toggle:hover {
  color: var(--text-cream);
}
.password-toggle .icon-eye-off,
.password-toggle[aria-pressed="true"] .icon-eye {
  display: none;
}
.password-toggle[aria-pressed="true"] .icon-eye-off {
  display: block;
}
.signup-hint {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}
.field-error-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin: -12px 0;
  vertical-align: middle;
  color: var(--accent-amber);
  font-weight: 600;
  text-underline-offset: 3px;
}
.field-error-link:hover {
  color: var(--text-cream);
}

/* ---- Buttons ---- */
.signup .form-message {
  margin: 8px 0 16px;
  font-size: 15px;
  line-height: 1.45;
}
.signup .btn-primary {
  width: 100%;
  min-height: 52px;
  justify-content: center;
  padding: 0 20px;
  margin-top: 8px;
}
.signup .google-btn {
  min-height: 48px;
  padding: 0 20px;
  font-size: 16px;
  background: var(--panel-dark);
  border-color: var(--signup-line);
}
.signup .google-btn:hover {
  border-color: rgb(var(--cream-rgb) / 0.7);
}
.btn-spinner {
  display: none;
  width: 18px;
  height: 18px;
  border: 2.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: signup-spin 0.8s linear infinite;
}
.is-busy .btn-spinner {
  display: inline-block;
}
.is-busy .google-g {
  display: none;
}
.signup .btn-primary.is-busy {
  opacity: 0.7;
  cursor: progress;
  transform: none;
}
.signup .google-btn.is-busy {
  color: var(--text-muted);
  cursor: progress;
}
.signup .google-btn .btn-spinner {
  color: var(--accent-amber);
}
@keyframes signup-spin {
  to {
    transform: rotate(360deg);
  }
}
.signup-confirm-note {
  margin: 10px 0 0;
  text-align: center;
  font-size: 14px;
  color: var(--text-muted);
}
.signup .auth-divider {
  font-size: 14px;
  margin: 18px 0;
}
.signup .auth-footer-link {
  margin-top: 8px;
  font-size: 15px;
}
.signup .auth-footer-link a,
.text-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  vertical-align: middle;
  border: 0;
  background: none;
  color: var(--accent-amber);
  font-size: 15px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.signup .auth-footer-link a:hover,
.text-link:hover {
  color: var(--text-cream);
}

/* ---- Success ---- */
.signup-success:focus {
  outline: none;
}
.signup-success h2 {
  margin: 16px 0 10px;
  font-size: 40px;
  line-height: 1;
}
.signup-success-text {
  margin: 0 0 20px;
  font-size: 16px;
  line-height: 1.5;
  color: #d9d5c8;
}
.signup-success-text strong {
  color: var(--text-cream);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.signup-next {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--panel-dark);
}
.signup-next p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
}
.signup-next .signup-next-label {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}
.signup-spam {
  margin: 16px 0 0;
  font-size: 15px;
  color: var(--text-muted);
}
.signup-success-links {
  display: flex;
  flex-wrap: wrap;
  column-gap: 24px;
  margin: 0;
  font-size: 15px;
  color: var(--text-muted);
}

/* ---- ≤ 900px: thin photo band, then the form ---- */
@media (max-width: 900px) {
  .signup {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  .signup-aside {
    position: static;
    height: auto;
    min-height: 124px;
    padding: 12px 20px 18px;
    gap: 16px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    background-image:
      linear-gradient(180deg, rgb(var(--ink-rgb) / 0.5) 0%, rgb(var(--ink-rgb) / 0.35) 50%, rgb(var(--ink-rgb) / 1) 100%),
      image-set(url("../assets/hero-mobile.webp") type("image/webp"), url("../assets/hero-mobile.jpg") type("image/jpeg"));
    background-size: auto, cover;
    background-position: 0 0, center 40%;
  }
  .signup-top .logo {
    font-size: 24px;
  }
  .signup-back-long,
  .signup-lede {
    display: none;
  }
  .signup-back-short {
    display: inline;
  }
  .signup-headline {
    margin: 0;
    font-family: "Public Sans", sans-serif;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }
  .signup-headline span {
    display: inline;
  }
  .signup-main {
    display: block;
    padding: 24px 20px 32px;
  }
  .signup h1 {
    font-size: 36px;
  }
  .signup-sub {
    margin-bottom: 24px;
  }
  .role-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .role-card {
    grid-template-columns: 18px 1fr;
    row-gap: 2px;
  }
  .role-card input {
    grid-row: span 2;
    align-self: start;
    margin-top: 2px;
  }
  .role-card-desc {
    grid-column: 2;
  }
}
```

## 3. `sakada-web/css/style.css`: add one import right after `@import "auth.css";`
```css
@import "signup.css";
```

## 4. `sakada-web/css/auth.css`: delete the old role tabs
Delete the whole block that starts with the comment line `/* Scoped to .auth-card — these were global ...` and ends with the `.auth-card .role-tabs button.active { … }` rule. That is the comment plus 3 rules. Nothing uses `.role-tabs` any more; the contact page uses `.role-tab`, which is a different class. Keep everything from `.auth-card .btn-primary {` onward.

## 5. New file `sakada-web/js/signup-result.js`
```js
// Turns a Supabase sign-up result into what the sign-up page shows.
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
export function signupErrorCopy(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const status = error?.status;

  if (
    error?.name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|load failed/i.test(message)
  ) {
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
```

## 6. Replace `sakada-web/js/register.js` with:
```js
import { registerWithEmail, loginWithGoogle } from "./auth.js";
import { checkName, checkEmail, emailChecker, checkNewPassword } from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";
import { isExistingAccount, signupErrorCopy } from "./signup-result.js";

const ROLES = ["farmer", "vendor", "driver"];
const NEXT_STEP = {
  requester: "Book your first truck from your dashboard. You see the fare before you confirm.",
  driver: "Add your vehicle in your dashboard so senders know which truck to look for.",
};

// ---- Role (native radios; ?role= presets it) ----
const roleInputs = [...document.querySelectorAll('input[name="role"]')];
const presetRole = new URLSearchParams(window.location.search).get("role");
if (ROLES.includes(presetRole)) {
  roleInputs.find((input) => input.value === presetRole).checked = true;
}
const selectedRole = () => roleInputs.find((input) => input.checked)?.value || "farmer";

// The left panel speaks to drivers when Driver is picked.
const pitches = document.querySelectorAll("[data-pitch]");
function showPitch() {
  const which = selectedRole() === "driver" ? "driver" : "requester";
  pitches.forEach((el) => (el.hidden = el.dataset.pitch !== which));
}
roleInputs.forEach((input) => input.addEventListener("change", showPitch));
showPitch();

// ---- Form message (offline, rate limit, unknown) ----
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

// ---- Show / hide password ----
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
passwordToggle.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(show));
  passwordToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

// ---- Validation ----
const form = document.getElementById("registerForm");
const submitBtn = document.getElementById("submitBtn");
const nameInput = document.getElementById("fullName");
const emailInput = document.getElementById("email");
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
form.addEventListener("input", clearMessage);

function showExistingAccount() {
  showFieldError(emailInput, "This email already has an account.");
  const link = document.createElement("a");
  link.href = "login.html";
  link.className = "field-error-link";
  link.textContent = "Log in instead";
  document.getElementById("emailError").append(" ", link);
  // A server-side error: any edit to the email clears it.
  emailInput.addEventListener("input", () => showFieldError(emailInput, ""), { once: true });
  emailInput.focus();
}

function showError(error) {
  const copy = signupErrorCopy(error);
  if (copy.kind === "exists") return showExistingAccount();
  if (copy.field) {
    const input = copy.field === "email" ? emailInput : passwordInput;
    showFieldError(input, copy.message);
    input.focus();
    return;
  }
  showMessage(copy.message);
}

// ---- Success: the panel replaces the form (values are kept for Start over) ----
const formPanel = document.getElementById("signupFormPanel");
const successPanel = document.getElementById("signupSuccess");
function showSuccess(email) {
  document.getElementById("successEmail").textContent = email;
  document.getElementById("successNext").textContent =
    NEXT_STEP[selectedRole() === "driver" ? "driver" : "requester"];
  passwordInput.value = "";
  formPanel.hidden = true;
  successPanel.hidden = false;
  successPanel.focus();
}
document.getElementById("startOver").addEventListener("click", () => {
  successPanel.hidden = true;
  formPanel.hidden = false;
  emailInput.focus();
  emailInput.select();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();
  if (!validateFields(RULES)) return;
  setBusy(submitBtn, true, "Creating account…");

  const email = emailInput.value.trim();
  let result;
  try {
    result = await registerWithEmail({
      email,
      password: passwordInput.value,
      fullName: nameInput.value.trim(),
      role: selectedRole(),
    });
  } catch (err) {
    result = { error: err };
  }
  setBusy(submitBtn, false, "Create account");

  if (result.error) return showError(result.error);
  if (isExistingAccount(result.data)) return showExistingAccount();
  showSuccess(email);
});

// ---- Google ----
const googleBtn = document.getElementById("googleBtn");
googleBtn.addEventListener("click", async () => {
  clearMessage();
  setBusy(googleBtn, true, "Opening Google…");
  let error;
  try {
    ({ error } = await loginWithGoogle(selectedRole()));
  } catch (err) {
    error = err;
  }
  if (error) {
    setBusy(googleBtn, false, "Continue with Google");
    showMessage(signupErrorCopy(error).message);
  }
});
// Coming back with the Back button restores the page from cache: un-stick the button.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) setBusy(googleBtn, false, "Continue with Google");
});
```

## 7. `sakada-web/js/login.js`: plain words for an unconfirmed email
In the email `submit` handler, inside `if (error) {`, replace:
```js
    submitBtn.textContent = "Log In";
    showMessage(error.message, "error");
```
with:
```js
    submitBtn.textContent = "Log In";
    showMessage(
      error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)
        ? "Confirm your email first: tap the link we sent you. It signs you in."
        : error.message,
      "error",
    );
```
(Only this spot. Leave the Google handler alone.)

## 8. New file `sakada-web/tests/signup-result.test.js`
```js
import { describe, it, expect } from "vitest";
import { isExistingAccount, signupErrorCopy, OFFLINE_MESSAGE } from "../js/signup-result.js";

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
```

## 9. `sakada-web/e2e/smoke.spec.mjs`
a) In the test `"register blocks gmail.co and one tap fixes it"`, the button name changes from `"Create Account"` to `"Create account"`:
```js
    await page.getByRole("button", { name: "Create account" }).click();
```
b) Append this block to the end of the file:
```js
test.describe("sign up", () => {
  const signupUser = (identities) => ({
    id: "u1",
    aud: "authenticated",
    role: "",
    email: "ana@gmail.com",
    identities,
    user_metadata: {},
    app_metadata: {},
    created_at: "2026-10-14T00:00:00Z",
  });
  async function fillSignup(page) {
    await page.fill("#fullName", "Ana Reyes");
    await page.fill("#email", "ana@gmail.com");
    await page.fill("#password", "password123");
  }

  test("?role=driver preselects Driver and shows the driver pitch", async ({ page }) => {
    // The local `serve` drops the query when it redirects *.html to a clean
    // URL, so open the clean URL (Vercel serves the .html file as-is).
    await page.goto("/auth/register?role=driver");
    await expect(page.getByRole("radio", { name: /Driver/ })).toBeChecked();
    await expect(page.locator('[data-pitch="driver"]')).toBeVisible();
    await page.getByRole("radio", { name: /Farmer/ }).check();
    await expect(page.locator('[data-pitch="requester"]')).toBeVisible();
  });

  test("an existing email gets Log in instead, not a fake success", async ({ page }) => {
    await page.route("**/auth/v1/signup**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(signupUser([])) }),
    );
    await page.goto("/auth/register.html");
    await fillSignup(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#emailError")).toContainText("This email already has an account.");
    await expect(page.locator("#emailError a")).toHaveAttribute("href", "login.html");
    await expect(page.locator("#signupSuccess")).toBeHidden();
  });

  test("success replaces the form and Start over brings it back", async ({ page }) => {
    await page.route("**/auth/v1/signup**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(signupUser([{ id: "i1", provider: "email" }])),
      }),
    );
    await page.goto("/auth/register?role=driver"); // clean URL: see the test above
    await fillSignup(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#signupSuccess")).toBeVisible();
    await expect(page.locator("#successEmail")).toHaveText("ana@gmail.com");
    await expect(page.locator("#successNext")).toContainText("Add your vehicle");
    await expect(page.locator("#registerForm")).toBeHidden();
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.locator("#registerForm")).toBeVisible();
    await expect(page.locator("#email")).toHaveValue("ana@gmail.com");
  });

  test("a rate-limit error is shown in plain words", async ({ page }) => {
    await page.route("**/auth/v1/signup**", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" }),
      }),
    );
    await page.goto("/auth/register.html");
    await fillSignup(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("#formMessage")).toHaveText("Too many sign-ups right now. Try again in a few minutes.");
  });

  test("show password toggles the field", async ({ page }) => {
    await page.goto("/auth/register.html");
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});
```

## 10. Checks (from `sakada-web/`)
- `npm run lint` → no errors
- `npm test` → **114 passed** (was 105, plus 9 new)
- `npm run test:e2e` → **45 passed** (was 40, plus 5 new)
- `git status` should show exactly:
  - modified: `auth/register.html`, `css/style.css`, `css/auth.css`, `js/register.js`, `js/login.js`, `e2e/smoke.spec.mjs`
  - new: `css/signup.css`, `js/signup-result.js`, `tests/signup-result.test.js`

Don't commit. Claude will review.
