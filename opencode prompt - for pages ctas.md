# OpenCode task: fix the bottom buttons on For Farmers / For Vendors / For Drivers

Each of the three "For" pages ends with a `.cta-band` holding one button. There are two problems:
1. **Existing bug:** all three go to `../auth/login.html`, even for new visitors. "Register as a Driver" sends people to log in instead of signing up.
2. When logged in, the buttons should behave like the How It Works buttons, using the `data-auth-cta` attribute that `js/landing-auth.js` already handles.

## Files you may touch
- `sakada-web/pages/for-farmers.html`
- `sakada-web/pages/for-vendors.html`
- `sakada-web/pages/for-drivers.html`

Nothing else (no JS or CSS changes needed). Don't commit.

## Changes (one line each)

**`pages/for-farmers.html`:** in the `.cta-band`, change
```html
<a class="btn-primary" href="../auth/login.html">Book a Delivery</a>
```
to
```html
<a class="btn-primary" href="../auth/register.html?role=farmer" data-auth-cta="book">Book a Delivery</a>
```

**`pages/for-vendors.html`:** in the `.cta-band`, change
```html
<a class="btn-primary" href="../auth/login.html">Book a Delivery</a>
```
to
```html
<a class="btn-primary" href="../auth/register.html?role=vendor" data-auth-cta="book">Book a Delivery</a>
```

**`pages/for-drivers.html`:** in the `.cta-band`, change
```html
<a class="btn-primary" href="../auth/login.html"
  >Register as a Driver</a
>
```
to
```html
<a class="btn-primary" href="../auth/register.html?role=driver" data-auth-cta="drive">Register as a Driver</a>
```

## What users see afterwards
- **Logged out:** each button opens sign-up with the right role already picked.
- **Logged-in farmer/vendor:** "Book a Delivery" opens their dashboard booking form. On For Drivers, the button is hidden.
- **Logged-in driver:** on For Drivers the button becomes **Find Deliveries** and goes to the driver dashboard. On For Farmers and For Vendors it is hidden.

## Checks
1. `grep -n 'cta-band' -A2 sakada-web/pages/for-*.html` shows the 3 new links.
2. `grep -c 'auth/login.html' sakada-web/pages/for-*.html` shows **3 per page** (it's 4 today). The 3 left are the nav ones: the desktop Log In, the mobile-menu Log In, and the hidden My Dashboard placeholder.
3. `cd sakada-web && npx vitest run` still passes (66).
