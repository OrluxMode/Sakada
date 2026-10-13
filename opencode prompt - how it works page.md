# OpenCode task: rebuild the How It Works page from the approved design

Rebuild `sakada-web/pages/how-it-works.html` to match the approved Figma design. It went through 4 rounds of design critique. Keep the site's dark/amber look, the existing nav and the existing footer. Only the `<head>` and the `<main>` content change.

## Reference
- Figma file `8q1102hOL3ZvFsiePuJrQv`, page "how it works":
  - desktop frame "How It Works (desktop)", node `35:301`
  - mobile frame "How It Works (mobile)", node `37:389`
- Sections in order: hero → "One status, seen by everyone" → "See the fare before you book" → two role columns → closing band → footer.
- The Figma uses Barlow Condensed **700** for small headings. The site only self-hosts **800** and **900**, so use **800** wherever this prompt says Barlow.

## Files you may touch
- `sakada-web/pages/how-it-works.html`
- `sakada-web/css/pages.css` (add a new block at the end; don't change existing rules, other pages use them)
- `sakada-web/css/nav.css` (add `.btn-outline` only)
- `sakada-web/css/base.css` (add tokens only)
- `sakada-web/css/fonts.css` (add 2 `@font-face` rules)
- `sakada-web/assets/fonts/` (2 new font files)

Nothing else. Don't commit.

---

## 1. Fonts: the ₱ sign
The self-hosted fonts are a Latin-only subset and **don't contain ₱ (U+20B1)**. This page uses ₱ a lot. Download the latin-ext subsets:
```bash
cd sakada-web/assets/fonts
curl -L -o barlow-condensed-800-latin-ext.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/barlow-condensed@latest/latin-ext-800-normal.woff2"
curl -L -o public-sans-latin-ext.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/public-sans:vf@latest/latin-ext-wght-normal.woff2"
```
Check that both files are bigger than 5 KB.

Append to `css/fonts.css`:
```css
/* latin-ext: only downloaded when the page uses these characters (e.g. ₱) */
@font-face {
  font-family: "Barlow Condensed";
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url("../assets/fonts/barlow-condensed-800-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("../assets/fonts/public-sans-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF,
    U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020,
    U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
```

## 2. `<head>` of how-it-works.html
Make it load fonts and CSS like `index.html` does: no Google Fonts and no `style.css`.
- **Replace** the CSP meta with:
  ```html
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://*.supabase.co; frame-src 'none';" />
  ```
- **Delete** the two `preconnect` links and the `fonts.googleapis.com` stylesheet link.
- **Replace** `<link rel="stylesheet" href="../css/style.css" />` with:
  ```html
  <link rel="stylesheet" href="../css/fonts.css" />
  <link rel="stylesheet" href="../css/base.css" />
  <link rel="stylesheet" href="../css/nav.css" />
  <link rel="stylesheet" href="../css/pages.css" />
  <link rel="preload" href="../assets/fonts/barlow-condensed-800.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="../assets/fonts/public-sans.woff2" as="font" type="font/woff2" crossorigin />
  ```
- Update the description meta to: `See how booking, fares, and live tracking work on Sakada, for farmers, vendors, and truck drivers.`
- Keep the title, favicon, nav, footer and `<script src="../js/main.js"></script>` exactly as they are.
- After the change, open the page and check that the nav and footer look the same as on `index.html` and `about.html`. If anything is unstyled because a rule lived in a file `style.css` imported (e.g. `forms.css`), add only that one `<link>`. Don't go back to `style.css`.

## 3. Tokens: `css/base.css`
Add inside `:root`, in the Color group, after `--ok-green`:
```css
  /* Delivery status colours (shared with the dashboard later) */
  --status-pending: #b8b4a6;
  --status-assigned: #e0972f;
  --status-picked-up: #4fa3b0;
  --status-in-transit: #5b9bd5;
  --status-delivered: #7ab05c;
  --status-cancelled: #e0542f;
  --rail: rgba(184, 180, 166, 0.7);
```

## 4. `.btn-outline`: `css/nav.css`
Add right after the `.btn-primary:hover, .btn-primary:focus-visible` rule:
```css
.btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: transparent;
  color: var(--text-cream);
  font-weight: 700;
  font-size: 17px;
  border: 1px solid var(--text-cream);
  border-radius: var(--radius-btn);
  padding: 15px 27px;
  text-decoration: none;
  width: fit-content;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
.btn-outline:hover,
.btn-outline:focus-visible {
  background: var(--text-cream);
  color: var(--bg-black);
}
```

## 5. The new `<main>` (replace everything between `<main id="main">` and `</main>`)
Use this markup exactly (indentation can follow the file's style). The down-arrow SVG is used in both chips.

```html
<main id="main">
  <section class="hiw-hero">
    <h1>You book it. A driver accepts it. You both see every step.</h1>
    <div class="hiw-hero-side">
      <p class="hiw-lede">
        Farmers and vendors book the delivery, a truck driver accepts it, and
        both of you see the same status, updated live, until the goods arrive.
      </p>
      <p class="hiw-jump-label" id="jump-label">Jump to your part:</p>
      <div class="hiw-jump" role="group" aria-labelledby="jump-label">
        <a class="chip" href="#senders"
          >I'm sending goods<svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 4v11M5 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg
        ></a>
        <a class="chip" href="#drivers"
          >I'm driving<svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 4v11M5 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg
        ></a>
      </div>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="status-heading">
    <h2 id="status-heading">One status, seen by everyone</h2>
    <p class="hiw-intro">
      The driver updates each stage from their phone. Every change shows up for
      you at the same moment, so there's no need to call and ask.
    </p>
    <ol class="hiw-stages">
      <li class="hiw-stage" data-status="pending">
        <span class="hiw-dot" aria-hidden="true"></span>
        <span class="hiw-stage-name">Pending</span>
        <span class="hiw-stage-who">You book it</span>
      </li>
      <li class="hiw-stage" data-status="driver_assigned">
        <span class="hiw-dot" aria-hidden="true"></span>
        <span class="hiw-stage-name">Driver Assigned</span>
        <span class="hiw-stage-who">A driver accepts</span>
      </li>
      <li class="hiw-stage" data-status="picked_up">
        <span class="hiw-dot" aria-hidden="true"></span>
        <span class="hiw-stage-name">Picked Up</span>
        <span class="hiw-stage-who">Your goods are on the truck</span>
      </li>
      <li class="hiw-stage" data-status="in_transit">
        <span class="hiw-dot" aria-hidden="true"></span>
        <span class="hiw-stage-name">In Transit</span>
        <span class="hiw-stage-who">On the road to the drop-off</span>
      </li>
      <li class="hiw-stage" data-status="delivered">
        <span class="hiw-dot" aria-hidden="true"></span>
        <span class="hiw-stage-name">Delivered</span>
        <span class="hiw-stage-who">Arrived at the drop-off</span>
      </li>
    </ol>
    <p class="hiw-cancel">
      <span class="hiw-dot hiw-dot--cancelled" aria-hidden="true"></span>
      Changed your mind? You can cancel any time while it's still Pending.
    </p>
  </section>

  <section class="hiw-section hiw-fare" id="fare" aria-labelledby="fare-heading">
    <div class="hiw-fare-text">
      <h2 id="fare-heading">See the fare before you book</h2>
      <p class="hiw-intro">
        Sakada works it out from the road distance and the weight, before you
        commit to anything. Here's a worked example.
      </p>
      <p class="hiw-formula">₱150 base + ₱15 per km + ₱2 per kg</p>
    </div>

    <div class="hiw-fare-card">
      <p class="hiw-fare-example">Example: 115 km, 500 kg</p>
      <dl class="hiw-fare-rows">
        <div><dt>Base fare</dt><dd>₱150</dd></div>
        <div><dt>115 km × ₱15</dt><dd>₱1,725</dd></div>
        <div><dt>500 kg × ₱2</dt><dd>₱1,000</dd></div>
        <div class="hiw-fare-total"><dt>Estimated fare</dt><dd>₱2,875</dd></div>
      </dl>
      <p>Your estimate uses the road distance from the map, not a straight line.</p>
      <p class="hiw-fare-rule">The fare you book is the fare you pay. No haggling at drop-off.</p>
      <p>
        For now, you pay the driver directly. In-app payment (GCash or cash on
        delivery) is coming soon.
      </p>
      <a class="btn-primary" href="../auth/register.html">Book a Delivery</a>
    </div>

    <div class="hiw-load">
      <h3>How much can I send?</h3>
      <p>
        There's no fixed limit. Drivers see the weight before they accept, so
        they only take loads their truck can carry. As a guide, a small truck
        carries about 1–2 tonnes and a six-wheeler about 4–7 tonnes.
      </p>
    </div>
  </section>

  <section class="hiw-section hiw-roles" aria-label="Steps by role">
    <div class="hiw-role" id="senders">
      <h2>If you're sending goods</h2>
      <p class="hiw-role-who">Farmers and vendors</p>
      <ol class="hiw-steps">
        <li>
          <span class="hiw-step-num" aria-hidden="true">01</span>
          <h3>Create the delivery</h3>
          <p>Make an account, then enter your pickup point, destination, what you're moving, and the pickup date.</p>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">02</span>
          <h3>Get an estimated fare</h3>
          <p>You see the fare before you commit to anything.</p>
          <a class="hiw-link" href="#fare">See the worked fare example</a>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">03</span>
          <h3>Confirm and wait for a driver</h3>
          <p>Your request goes live to available drivers. You'll get a notification in Sakada the moment one accepts. Until then your booking stays Pending, and you can cancel it any time.</p>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">04</span>
          <h3>Track the trip</h3>
          <p>Watch your delivery move through each stage — no need to call and ask.</p>
          <ul class="hiw-legend" aria-label="Stages you'll see">
            <li data-status="picked_up">Picked Up</li>
            <li data-status="in_transit">In Transit</li>
            <li data-status="delivered">Delivered</li>
          </ul>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">05</span>
          <h3>Rate your driver</h3>
          <p>Once it's delivered, rate your driver. It's saved to your delivery history.</p>
        </li>
      </ol>
      <a class="btn-outline" href="../auth/register.html">Book a Delivery</a>
    </div>

    <div class="hiw-role" id="drivers">
      <h2>If you're driving</h2>
      <p class="hiw-role-who">Truck drivers</p>
      <ol class="hiw-steps">
        <li>
          <span class="hiw-step-num" aria-hidden="true">01</span>
          <h3>Browse available deliveries</h3>
          <p>See pickup and drop-off points, what's being moved, and the estimated fare before you accept anything.</p>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">02</span>
          <h3>Accept a delivery</h3>
          <p>Once you accept, it's assigned to you and moves to your active deliveries list.</p>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">03</span>
          <h3>Update status as you go</h3>
          <p>Mark each stage from your phone. The farmer or vendor sees every update immediately.</p>
          <ul class="hiw-legend" aria-label="Stages you'll mark">
            <li data-status="picked_up">Picked Up</li>
            <li data-status="in_transit">In Transit</li>
            <li data-status="delivered">Delivered</li>
          </ul>
        </li>
        <li>
          <span class="hiw-step-num" aria-hidden="true">04</span>
          <h3>Get rated, build your history</h3>
          <p>Completed deliveries and ratings stay on your profile.</p>
        </li>
      </ol>
      <a class="btn-outline" href="../auth/register.html?role=driver">Sign up to drive</a>
    </div>
  </section>

  <section class="hiw-close" aria-labelledby="close-heading">
    <div>
      <h2 id="close-heading">Ready to move your goods?</h2>
      <p>Questions first? <a class="hiw-link" href="contact.html">Contact us</a></p>
    </div>
    <div class="hiw-close-actions">
      <a class="btn-primary" href="../auth/register.html">Book a Delivery</a>
      <a class="btn-outline" href="../auth/register.html?role=driver">Sign up to drive</a>
    </div>
  </section>
</main>
```

## 6. CSS: append to the end of `css/pages.css`
```css
/* ================================================
   How It Works page (pages/how-it-works.html)
   ================================================ */

/* Hero */
.hiw-hero {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(0, 1fr);
  gap: 96px;
  align-items: start;
  padding: 96px clamp(20px, 5vw, 64px) 80px;
  border-bottom: 1px solid var(--line);
}
.hiw-hero h1 {
  font-size: clamp(40px, 5.5vw, 64px);
}
.hiw-hero-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 10px;
}
.hiw-lede {
  margin: 0;
  font-size: 18px;
  line-height: 1.65;
  color: var(--text-muted);
}
.hiw-jump-label {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-muted);
}
.hiw-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Shared section */
.hiw-section {
  padding: 72px clamp(20px, 5vw, 64px);
  border-bottom: 1px solid var(--line);
}
.hiw-section h2 {
  font-size: clamp(32px, 3.4vw, 40px);
}
.hiw-intro {
  margin: 12px 0 0;
  max-width: 600px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-muted);
}

/* Status colours (scoped to this page's elements) */
.hiw-stages [data-status="pending"],
.hiw-legend [data-status="pending"] { --dot: var(--status-pending); }
.hiw-stages [data-status="driver_assigned"],
.hiw-legend [data-status="driver_assigned"] { --dot: var(--status-assigned); }
.hiw-stages [data-status="picked_up"],
.hiw-legend [data-status="picked_up"] { --dot: var(--status-picked-up); }
.hiw-stages [data-status="in_transit"],
.hiw-legend [data-status="in_transit"] { --dot: var(--status-in-transit); }
.hiw-stages [data-status="delivered"],
.hiw-legend [data-status="delivered"] { --dot: var(--status-delivered); }

/* Status track */
.hiw-stages {
  list-style: none;
  margin: 40px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
}
.hiw-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  padding-right: 20px;
}
.hiw-stage:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 18px;
  right: 0;
  height: 2px;
  background: var(--rail);
}
.hiw-stage:last-child {
  padding-right: 0;
}
.hiw-dot {
  position: relative;
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--dot);
  margin-bottom: 16px;
}
.hiw-stage[data-status="pending"] .hiw-dot {
  background: var(--bg-black);
  border: 2.5px solid var(--status-pending);
}
.hiw-stage-name {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 24px;
  color: var(--text-cream);
}
.hiw-stage-who {
  margin-top: 4px;
  font-size: 16px;
  color: var(--text-muted);
}
.hiw-cancel {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 40px 0 0;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-size: 16px;
  color: var(--text-muted);
}
.hiw-dot--cancelled {
  width: 14px;
  height: 14px;
  margin: 0;
  background: var(--bg-black);
  border: 2.5px solid var(--status-cancelled);
}

/* Fare */
.hiw-fare {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 520px;
  grid-template-areas:
    "text card"
    "load card";
  column-gap: 96px;
  row-gap: 16px;
  align-items: start;
}
.hiw-fare-text { grid-area: text; }
.hiw-fare-card { grid-area: card; }
.hiw-load {
  grid-area: load;
  max-width: 520px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}
.hiw-fare-text .hiw-intro {
  margin-top: 16px;
  max-width: 520px;
}
.hiw-formula {
  margin: 16px 0 0;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 30px;
  line-height: 1.1;
  color: var(--text-cream);
}
.hiw-load h3 {
  margin: 0 0 8px;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 22px;
}
.hiw-load p {
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-muted);
}
.hiw-fare-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  border: 1px solid rgba(184, 180, 166, 0.5);
  border-radius: var(--radius-md);
}
.hiw-fare-card p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-muted);
}
.hiw-fare-card .hiw-fare-example { font-weight: 500; }
.hiw-fare-card .hiw-fare-rule {
  font-weight: 600;
  color: var(--text-cream);
}
.hiw-fare-rows {
  display: grid;
  gap: 12px;
  margin: 0;
}
.hiw-fare-rows > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}
.hiw-fare-rows dt {
  font-size: 16px;
  color: var(--text-muted);
}
.hiw-fare-rows dd {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-cream);
  font-variant-numeric: tabular-nums;
}
.hiw-fare-rows .hiw-fare-total {
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.hiw-fare-total dt {
  font-weight: 700;
  color: var(--text-cream);
}
.hiw-fare-total dd {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 36px;
  line-height: 1;
  color: var(--accent-amber);
}
.hiw-fare-card .btn-primary { margin-top: 8px; }

/* Role steps */
.hiw-roles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 96px;
  align-items: start;
}
.hiw-role { scroll-margin-top: 24px; }
.hiw-role-who {
  margin: 12px 0 32px;
  font-size: 16px;
  color: var(--text-muted);
}
.hiw-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}
.hiw-steps > li {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 28px 0;
  border-bottom: 1px solid var(--line);
}
.hiw-step-num {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 32px;
  line-height: 1;
  color: var(--accent-amber);
}
.hiw-steps h3 {
  margin: 0;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 22px;
}
.hiw-steps p {
  margin: 0;
  max-width: 540px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-muted);
}
.hiw-role > .btn-outline { margin-top: 32px; }

/* Inline links: 44px tall hit area without changing the line */
.hiw-link {
  display: inline-block;
  width: fit-content;
  padding: 12px 0;
  margin: -12px 0;
  color: var(--accent-amber);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.hiw-link:hover,
.hiw-link:focus-visible { color: var(--text-cream); }

/* Stage legend inside steps */
.hiw-legend {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.hiw-legend li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-cream);
}
.hiw-legend li::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--dot);
}

/* Closing band */
.hiw-close {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 64px clamp(20px, 5vw, 64px);
  background: var(--panel-dark);
  border-bottom: 1px solid var(--line);
}
.hiw-close h2 {
  margin: 0;
  font-size: clamp(28px, 3vw, 36px);
}
.hiw-close p {
  margin: 10px 0 0;
  font-size: 16px;
  color: var(--text-muted);
}
.hiw-close-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* Tablet and phone */
@media (max-width: 900px) {
  .hiw-hero {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 56px clamp(20px, 5vw, 64px) 48px;
  }
  .hiw-hero-side { padding-top: 0; }
  .hiw-lede { font-size: 16px; }
  .hiw-jump { flex-direction: column; }
  .hiw-jump .chip { width: 100%; justify-content: space-between; }

  .hiw-stages { grid-template-columns: 1fr; }
  .hiw-stage {
    display: grid;
    grid-template-columns: 18px 1fr;
    column-gap: 16px;
    padding: 0 0 24px;
  }
  .hiw-stage:last-child { padding-bottom: 0; }
  .hiw-stage:not(:last-child)::before {
    top: 21px;
    bottom: 0;
    left: 8px;
    right: auto;
    width: 2px;
    height: auto;
  }
  .hiw-stage .hiw-dot {
    grid-row: 1 / 3;
    margin: 3px 0 0;
  }
  .hiw-stage-name,
  .hiw-stage-who { grid-column: 2; }
  .hiw-stage-who { margin-top: 2px; }
  .hiw-cancel { align-items: flex-start; }
  .hiw-cancel .hiw-dot--cancelled { margin-top: 4px; }

  .hiw-fare {
    grid-template-columns: 1fr;
    grid-template-areas:
      "text"
      "card"
      "load";
    row-gap: 32px;
  }
  .hiw-load { max-width: none; }
  .hiw-formula { font-size: 24px; }
  .hiw-fare-card { padding: 20px; }

  .hiw-roles {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .hiw-role + .hiw-role {
    margin-top: 56px;
    padding-top: 56px;
    border-top: 1px solid var(--line);
  }
  .hiw-steps p { max-width: none; }

  .hiw-close {
    flex-direction: column;
    align-items: stretch;
  }
  .hiw-close-actions { flex-direction: column; }

  .hiw-fare-card .btn-primary,
  .hiw-role > .btn-outline,
  .hiw-close-actions .btn-primary,
  .hiw-close-actions .btn-outline {
    width: 100%;
    justify-content: center;
  }
}
```

## Checks before you finish
1. `grep -n "googleapis\|style.css" sakada-web/pages/how-it-works.html` returns nothing.
2. `ls -l sakada-web/assets/fonts/*latin-ext*` shows 2 files, each over 5 KB.
3. `cd sakada-web && npx vitest run` passes (55).
4. Open `http://localhost:4321/pages/how-it-works.html` (`npx serve . -l 4321` from `sakada-web/`) at 1440 and 390 wide:
   - no console or CSP errors
   - the ₱ signs render in the same font as the numbers
   - the nav and footer look like the other pages
   - the jump chips scroll to the two role sections
5. Don't change any other page.
