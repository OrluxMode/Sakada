# OpenCode task: rebuild For Farmers, For Vendors, For Drivers + sync How It Works

Rebuild the three role pages from the approved Figma designs. They share one design system (most of it already exists from How It Works), so this prompt gives:
1. one shared CSS block,
2. the full `<main>` for each page,
3. a small How It Works sync,
4. a font cleanup,
5. two test fixes.

Don't commit.

## Reference (Figma file `8q1102hOL3ZvFsiePuJrQv`)
- For Farmers: page "for farmers", frames **"for farmers polish"** (desktop) and **"for farmers polish (mobile)"**.
- For Vendors: page "for vendors", frames "for vendors" and "for vendors (mobile)".
- For Drivers: page "for drivers", frames "for drivers" and "for drivers (mobile)".

## Product facts this copy relies on (don't change them)
- The fare is ₱150 + ₱15/km + ₱2/kg. Example: Nueva Ecija → Marikina palengke, 120 km, 800 kg = **₱3,550**. Expressway tolls are included.
- **The receiver pays, like cash on delivery.** The farmer ships, and the buyer (usually a vendor) pays the driver in cash at drop-off.
- Notifications are in-app only. Drivers get new-job notifications if they signed in within 7 days.
- After a driver accepts, an admin can cancel until pickup.

## Files you may touch
- `sakada-web/pages/for-farmers.html`, `for-vendors.html`, `for-drivers.html` (replace `<main>`; small `<head>` edit)
- `sakada-web/pages/how-it-works.html` (the fare card only)
- `sakada-web/css/pages.css` (append one block)
- `sakada-web/css/fonts.css` and `sakada-web/assets/fonts/` (remove the latin-ext fonts)
- `sakada-web/e2e/smoke.spec.mjs` (two selector fixes)
- `sakada-web/assets/sample-live-map.png` **already exists**. Use it as is.

Nothing else.

---

## 1. Shared CSS: append to the end of `css/pages.css`
These pages reuse the existing How It Works classes (`hiw-section`, `hiw-intro`, `hiw-stages`, `hiw-stage`, `hiw-dot`, `hiw-stage-name`, `hiw-stage-who`, `hiw-cancel`, `hiw-dot--cancelled`, `hiw-fare-card`, `hiw-fare-rows`, `hiw-fare-total`, `hiw-fare-example`, `hiw-link`, `hiw-nowrap`, `hiw-close`, `hiw-close-actions`) and the dashboard `.status-pill`. Add only:

```css
/* ================================================
   Role pages: For Farmers / For Vendors / For Drivers
   ================================================ */
.rp-hero {
  display: grid;
  grid-template-columns: minmax(0, 640px) minmax(0, 1fr);
  grid-template-areas:
    "h1 lede"
    "acts example";
  column-gap: 96px;
  row-gap: 24px;
  align-items: start;
  padding: 76px clamp(20px, 5vw, 64px);
  border-bottom: 1px solid var(--line);
}
.rp-hero h1 { grid-area: h1; font-size: clamp(40px, 5.5vw, 64px); }
.rp-lede { grid-area: lede; margin: 0; font-size: 18px; line-height: 1.65; color: var(--text-muted); }
.rp-example { grid-area: example; }
.rp-acts { grid-area: acts; display: flex; flex-direction: column; gap: 16px; }
.rp-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 28px; }
.rp-note { margin: 0; font-size: 16px; line-height: 1.6; color: var(--text-muted); }

.rp-example {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  background: var(--panel-dark);
  border: 1px solid rgba(184, 180, 166, 0.35);
  border-radius: var(--radius-md);
}
.rp-example-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.rp-example-label { font-size: 16px; font-weight: 600; color: var(--text-cream); }
.rp-example-price {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 28px;
  color: var(--accent-amber);
}
.rp-example p { margin: 0; font-size: 16px; color: var(--text-muted); }

/* Fare / pay section */
.rp-fare {
  display: grid;
  grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
  column-gap: 96px;
  align-items: start;
}
.rp-fare-text { display: flex; flex-direction: column; gap: 32px; }
.rp-fare-text .hiw-intro { margin-top: 12px; max-width: 520px; }
.rp-points { display: flex; flex-direction: column; gap: 20px; }
.rp-points h3,
.rp-sample h3,
.rp-qa h3 {
  margin: 0 0 6px;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 700;
  font-size: 24px;
}
.rp-points p,
.rp-sample > p,
.rp-qa p { margin: 0; font-size: 16px; line-height: 1.6; color: var(--text-muted); }
.rp-formula {
  margin: 0;
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 700;
  font-size: 26px;
  color: var(--text-cream);
}
.hiw-fare-card .hiw-fare-example { font-weight: 600; }
.hiw-fare-total dt span {
  display: block;
  font-weight: 400;
  color: var(--text-muted);
}

/* Sample dashboard cards */
.rp-samples {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 40px 32px;
  margin-top: 32px;
  align-items: start;
}
.rp-sample { display: flex; flex-direction: column; gap: 16px; }
.rp-sample--big { grid-column: 1; grid-row: 1 / span 2; }
.rp-samples > .rp-sample:not(.rp-sample--big) { grid-column: 2; }
.sample-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  background: var(--panel-dark);
  border: 1px solid rgba(184, 180, 166, 0.5);
  border-radius: var(--radius-md);
}
.sample-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.sample-id { display: inline-flex; align-items: center; gap: 10px; }
.sample-code {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  font-size: 17px;
  color: var(--accent-amber);
}
.sample-tag { font-size: 13px; font-weight: 500; color: var(--text-muted); }
.sample-route { margin: 0; font-size: 14px; color: var(--text-cream); }
.sample-meta,
.sample-line { margin: 0; font-size: 14px; color: var(--text-muted); }
.sample-line strong { color: var(--text-cream); font-weight: 600; }
.sample-stars { color: var(--accent-amber); }
.sample-action { font-size: 14px; font-weight: 600; color: var(--text-muted); text-decoration: underline; }
.sample-share { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--text-cream); }
.sample-share::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-amber); }
.sample-map {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 600 / 320;
  border: 1px solid rgba(184, 180, 166, 0.55);
  border-radius: 6px;
  object-fit: cover;
}
.sample-caption { margin: 0; font-size: 13px; color: var(--text-muted); }
.rp-after-cta { margin-top: 32px; }

/* Q&A */
.rp-qa {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
  margin-top: 32px;
  border-top: 1px solid var(--line);
}
.rp-qa-item { padding: 28px 0; border-bottom: 1px solid var(--line); }
.rp-qa p { max-width: 540px; }

@media (max-width: 900px) {
  .rp-hero {
    grid-template-columns: 1fr;
    grid-template-areas: "h1" "lede" "example" "acts";
    row-gap: 20px;
    padding: 72px clamp(20px, 5vw, 64px);
  }
  .rp-lede { font-size: 16px; }
  .rp-actions { flex-direction: column; align-items: stretch; }
  .rp-actions .btn-primary { width: 100%; justify-content: center; }
  .rp-fare { grid-template-columns: 1fr; row-gap: 32px; }
  .rp-samples { grid-template-columns: 1fr; }
  .rp-sample--big,
  .rp-samples > .rp-sample:not(.rp-sample--big) { grid-column: 1; grid-row: auto; }
  .rp-qa { grid-template-columns: 1fr; }
  .rp-after-cta,
  .hiw-fare-card .btn-primary { width: 100%; justify-content: center; }
}
```

## 2. `<head>` of the three pages
No font or CSS changes are needed; they already load `fonts.css` + `style.css`. **Delete** each page's eyebrow markup (`<span class="eyebrow-role">…</span>`) as part of replacing `<main>`. Keep everything outside `<main>` (nav, footer, scripts) exactly as it is.

Every sample card is decorative. Its meaning is in the heading and caption above it, so each `.sample-card` gets `aria-hidden="true"`.

## 3. `pages/for-farmers.html`: replace `<main id="main">…</main>` with
```html
<main id="main">
  <section class="rp-hero">
    <h1>Send your harvest without chasing down a ride.</h1>
    <p class="rp-lede">Post what you're moving, where it's going, and when. A driver accepts, you watch the trip live, and you know it arrived, without phoning around for a truck.</p>
    <div class="rp-example">
      <div class="rp-example-top"><span class="rp-example-label">Example fare</span><span class="rp-example-price">₱3,550</span></div>
      <p>Nueva Ecija → Marikina palengke</p>
      <p>120 km · 800 kg · tolls included</p>
    </div>
    <div class="rp-acts">
      <div class="rp-actions">
        <a class="btn-primary" href="../auth/register.html?role=farmer" data-auth-cta="book">Book a Delivery</a>
        <a class="hiw-link" href="how-it-works.html">See how it works</a>
      </div>
      <p class="rp-note" data-auth="guest">Available nationwide. New here? You'll make an account first.</p>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="fare-heading">
    <div class="rp-fare">
      <div class="rp-fare-text">
        <div>
          <h2 id="fare-heading">Know the fare before you book</h2>
          <p class="hiw-intro">Sakada works it out from the road distance and the weight. Here's an example run from a farm in Nueva Ecija to the Marikina palengke.</p>
        </div>
        <div class="rp-points">
          <div><h3>No haggling at <span class="hiw-nowrap">drop-off</span></h3><p>The fare is locked in when you book. It already includes expressway tolls, and the driver is paid exactly that amount.</p></div>
          <div><h3>Measured along the road</h3><p>The distance comes from the map's driving route, not a straight line, so the fare matches the trip the truck makes.</p></div>
        </div>
      </div>
      <div class="hiw-fare-card">
        <p class="rp-formula">₱150 base + ₱15 per km + ₱2 per kg</p>
        <p class="hiw-fare-example">Example: Nueva Ecija → Marikina palengke, 120 km, 800 kg</p>
        <dl class="hiw-fare-rows">
          <div><dt>Base fare</dt><dd>₱150</dd></div>
          <div><dt>120 km × ₱15</dt><dd>₱1,800</dd></div>
          <div><dt>800 kg × ₱2</dt><dd>₱1,600</dd></div>
          <div><dt>Expressway tolls</dt><dd>Included</dd></div>
          <div class="hiw-fare-total"><dt>Fare for this trip<span>Locked in when you book</span></dt><dd>₱3,550</dd></div>
        </dl>
        <p>Like cash on delivery: you ship, and your buyer pays the driver in cash at <span class="hiw-nowrap">drop-off.</span> Paying through Sakada (GCash or COD) is coming soon.</p>
        <a class="btn-primary" href="../auth/register.html?role=farmer" data-auth-cta="book">Book a Delivery</a>
      </div>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="after-heading">
    <h2 id="after-heading">What you'll see after you book</h2>
    <p class="hiw-intro">Your booking moves through five stages, with an in-app notification at each one (no SMS). The cards below are samples of your dashboard. For every step, see <a class="hiw-link" href="how-it-works.html">How It Works.</a></p>
    <ol class="hiw-stages">
      <li class="hiw-stage" data-status="pending"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Pending</span><span class="hiw-stage-who">You book it</span></li>
      <li class="hiw-stage" data-status="driver_assigned"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Driver Assigned</span><span class="hiw-stage-who">A driver accepts</span></li>
      <li class="hiw-stage" data-status="picked_up"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Picked Up</span><span class="hiw-stage-who">Your goods are on the truck</span></li>
      <li class="hiw-stage" data-status="in_transit"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">In Transit</span><span class="hiw-stage-who">On the road to the drop-off</span></li>
      <li class="hiw-stage" data-status="delivered"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Delivered</span><span class="hiw-stage-who">Arrived at the drop-off</span></li>
    </ol>
    <p class="hiw-cancel"><span class="hiw-dot hiw-dot--cancelled" aria-hidden="true"></span>You can cancel a booking yourself while it's still Pending.</p>

    <div class="rp-samples">
      <div class="rp-sample">
        <div><h3>Know who's coming</h3><p>You see the driver's name, plus their vehicle and plate number if they've added them.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00142</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="driver_assigned">Driver Assigned</span></div>
          <p class="sample-line">Driver: <strong>Juan Dela Cruz</strong> · Isuzu Elf · NBC 1234</p>
          <p class="sample-route">Nueva Ecija → Marikina palengke</p>
          <p class="sample-meta">Onions · 800 kg · ₱3,550</p>
        </div>
      </div>
      <div class="rp-sample rp-sample--big">
        <div><h3>Follow it on the road</h3><p>While your goods are picked up and in transit, a live map shows where the truck is.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00142</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="in_transit">In Transit</span></div>
          <img class="sample-map" src="../assets/sample-live-map.png" width="600" height="320" alt="" loading="lazy" />
          <p class="sample-caption">Live location — updates automatically</p>
        </div>
      </div>
      <div class="rp-sample">
        <div><h3>Rate it, then book it again</h3><p>After delivery, rate your driver. One tap copies the route, goods, and weight into a new booking.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00131</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="delivered">Delivered</span></div>
          <p class="sample-line">You rated this delivery: <span class="sample-stars">★★★★★</span></p>
          <span class="sample-action">Book again</span>
        </div>
      </div>
    </div>
    <a class="btn-primary rp-after-cta" href="../auth/register.html?role=farmer" data-auth-cta="book">Book a Delivery</a>
  </section>

  <section class="hiw-section" aria-labelledby="faq-heading">
    <h2 id="faq-heading">Before you hand over your harvest</h2>
    <p class="hiw-intro">Straight answers to what farmers ask first. Something else? <a class="hiw-link" href="contact.html">Contact us.</a></p>
    <div class="rp-qa">
      <div class="rp-qa-item"><h3>Who pays the driver?</h3><p>Your buyer does, in cash, when the goods arrive. Like cash on delivery: you ship, they pay the fare for this trip, the same amount shown when you booked. If the driver asks for more, show the fare in your booking and contact us.</p></div>
      <div class="rp-qa-item"><h3>What if something goes wrong after a driver accepts?</h3><p>Contact us with your booking code. Until your goods are picked up, we can cancel the booking for you.</p></div>
      <div class="rp-qa-item"><h3>What if no driver accepts?</h3><p>Your booking stays Pending until one does. You get an in-app notification when it's accepted, and you can cancel it yourself any time before.</p></div>
      <div class="rp-qa-item"><h3>How heavy can my load be?</h3><p>There's no fixed limit. Drivers see the weight before they accept, so they only take loads their truck can carry.</p></div>
    </div>
  </section>

  <section class="hiw-close" aria-labelledby="close-heading">
    <div>
      <h2 id="close-heading">Book your first delivery</h2>
      <p>The fare up front, a driver you know by name, and your harvest on the map until it arrives.</p>
    </div>
    <div class="hiw-close-actions">
      <a class="btn-primary" href="../auth/register.html?role=farmer" data-auth-cta="book">Book a Delivery</a>
      <a class="hiw-link" href="../auth/login.html" data-auth="guest">Already booked before? Log In</a>
    </div>
  </section>
</main>
```

## 4. `pages/for-vendors.html`: replace `<main>` with the same structure and these differences
Copy the For Farmers `<main>` above and change only the following:
- **Every `role=farmer`** in hrefs becomes `role=vendor`.
- **H1:** `Get your goods delivered, without the back-and-forth calls.`
- **Lede:** `Book the pickup from your farmer or supplier, see who's bringing it, and track it until it reaches your stall or storefront, without phoning around for a truck.`
- **Example box lines:** `Nueva Ecija farm → your Marikina palengke stall` / `120 km · 800 kg · tolls included`.
- **Fare intro:** `Sakada works it out from the road distance and the weight. Here's an example: onions from a farm in Nueva Ecija to your stall at the Marikina palengke.`
- **Fare card payment paragraph:** `You pay the driver in cash when the goods reach you, the fare for this trip. Paying through Sakada (GCash or COD) is coming soon.`
- **Stage glosses** (`hiw-stage-who`), in order: `You book it` / `A driver accepts` / `Goods leave your supplier` / `On the road to you` / `Arrived at your stall`.
- **Sample captions:**
  - Driver card: `Know who's bringing it` / `You see the driver's name, plus their vehicle and plate number if they've added them.`
  - Map card: `Follow it to your stall` / `While your goods are picked up and in transit, a live map shows where the truck is, so you know when to expect it.`
  - Rate card: `Rate it, then restock` / `After delivery, rate your driver. One tap copies the route, goods, and weight, so your next restock is just a new date.`
- **FAQ heading:** `Before you book your next delivery`. **Intro:** `Straight answers to what vendors ask first. Something else?` + the Contact link.
- **FAQ items, in order:**
  1. `Can I book a pickup from my supplier?` / `Yes. Set the pickup at your farmer or supplier and the drop-off at your stall or store. You book it and pay the driver; your supplier just hands over the goods.`
  2. `When and how do I pay?` / `In cash to the driver when the goods reach you: the fare for this trip, the same amount you saw when you booked. If the driver asks for more, show them the fare in your booking and contact us.`
  3. `What if no driver accepts?`, with the same answer as For Farmers.
  4. `What if something goes wrong after a driver accepts?` / `Contact us with your booking code. Until the goods are picked up, we can cancel the booking for you. Every past delivery stays in your history with its fare.`
- **Close:** `Book your next delivery` / `The fare up front, a driver you know by name, and your stock on the map until it arrives.`

## 5. `pages/for-drivers.html`: replace `<main>` with
```html
<main id="main">
  <section class="rp-hero">
    <h1>Find loads. Accept jobs. Get paid for the trip you're already making.</h1>
    <p class="rp-lede">Farmers and vendors post real deliveries. You see the route, the load, and the fare before you accept, then update each stage from your phone.</p>
    <div class="rp-example">
      <div class="rp-example-top"><span class="rp-example-label">Example job</span><span class="rp-example-price">₱3,550</span></div>
      <p>Nueva Ecija → Marikina palengke</p>
      <p>120 km · 800 kg · paid in cash at <span class="hiw-nowrap">drop-off</span></p>
    </div>
    <div class="rp-acts">
      <div class="rp-actions">
        <a class="btn-primary" href="../auth/register.html?role=driver" data-auth-cta="drive">Sign up to drive</a>
        <a class="hiw-link" href="how-it-works.html">See how it works</a>
      </div>
      <p class="rp-note" data-auth="guest">Jobs come from anywhere in the country. Add your vehicle after you sign up so customers know which truck to look for.</p>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="pay-heading">
    <div class="rp-fare">
      <div class="rp-fare-text">
        <div>
          <h2 id="pay-heading">Know what a job pays before you accept</h2>
          <p class="hiw-intro">Every job shows its fare up front, worked out from the road distance and the weight. Here's an example run from a farm in Nueva Ecija to the Marikina palengke.</p>
        </div>
        <div class="rp-points">
          <div><h3>Cash at drop-off, nothing to haggle</h3><p>The customer receiving the goods pays you the booked fare when they arrive. Expressway tolls are already included.</p></div>
          <div><h3>See the load first</h3><p>Pickup, drop-off, goods, and weight are on every job, so you only take what your truck can carry.</p></div>
        </div>
      </div>
      <div class="hiw-fare-card">
        <p class="rp-formula">₱150 base + ₱15 per km + ₱2 per kg</p>
        <p class="hiw-fare-example">Example: Nueva Ecija → Marikina palengke, 120 km, 800 kg</p>
        <dl class="hiw-fare-rows">
          <div><dt>Base fare</dt><dd>₱150</dd></div>
          <div><dt>120 km × ₱15</dt><dd>₱1,800</dd></div>
          <div><dt>800 kg × ₱2</dt><dd>₱1,600</dd></div>
          <div><dt>Expressway tolls</dt><dd>Included</dd></div>
          <div class="hiw-fare-total"><dt>Fare for this job<span>Paid to you in cash at drop-off</span></dt><dd>₱3,550</dd></div>
        </dl>
        <a class="btn-primary" href="../auth/register.html?role=driver" data-auth-cta="drive">Sign up to drive</a>
      </div>
    </div>
  </section>

  <section class="hiw-section" aria-labelledby="flow-heading">
    <h2 id="flow-heading">How a job works on your dashboard</h2>
    <p class="hiw-intro">New jobs arrive as an in-app notification (no SMS) if you've signed in within the last 7 days. The cards below are samples of your dashboard. For every step, see <a class="hiw-link" href="how-it-works.html">How It Works.</a></p>
    <ol class="hiw-stages">
      <li class="hiw-stage" data-status="pending"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Pending</span><span class="hiw-stage-who">A farmer or vendor books</span></li>
      <li class="hiw-stage" data-status="driver_assigned"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Driver Assigned</span><span class="hiw-stage-who">You accept the job</span></li>
      <li class="hiw-stage" data-status="picked_up"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Picked Up</span><span class="hiw-stage-who">You mark the goods loaded</span></li>
      <li class="hiw-stage" data-status="in_transit"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">In Transit</span><span class="hiw-stage-who">You mark it on the road</span></li>
      <li class="hiw-stage" data-status="delivered"><span class="hiw-dot" aria-hidden="true"></span><span class="hiw-stage-name">Delivered</span><span class="hiw-stage-who">You mark it arrived</span></li>
    </ol>
    <p class="hiw-cancel"><span class="hiw-dot hiw-dot--cancelled" aria-hidden="true"></span>A booking can only be cancelled before pickup. After that, the job is yours to finish.</p>

    <div class="rp-samples">
      <div class="rp-sample">
        <div><h3>See the job first</h3><p>Route, goods, weight, and the fare, before you tap Accept. If another driver takes it first, it simply leaves your list.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00142</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="pending">Pending</span></div>
          <p class="sample-route">Nueva Ecija → Marikina palengke</p>
          <p class="sample-meta">Onions · 800 kg · Est. ₱3,550</p>
          <span class="sample-action">Accept Delivery</span>
        </div>
      </div>
      <div class="rp-sample rp-sample--big">
        <div><h3>One tap per stage</h3><p>Mark Picked Up, In Transit, and Delivered as you go. While you're on the road, your location is shared so the customer can follow the truck.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00142</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="in_transit">In Transit</span></div>
          <p class="sample-route">Nueva Ecija → Marikina palengke</p>
          <span class="sample-share">Sharing your location…</span>
          <span class="sample-action">Mark Delivered</span>
          <img class="sample-map" src="../assets/sample-live-map.png" width="600" height="320" alt="" loading="lazy" />
          <p class="sample-caption">What your customer sees: Live location — updates automatically</p>
        </div>
      </div>
      <div class="rp-sample">
        <div><h3>Build your history</h3><p>After each job, you and the customer rate each other. Completed jobs and ratings stay in your history.</p></div>
        <div class="sample-card" aria-hidden="true">
          <div class="sample-top"><span class="sample-id"><span class="sample-code">SK-00131</span><span class="sample-tag">Sample</span></span><span class="status-pill" data-status="delivered">Delivered</span></div>
          <p class="sample-route">Nueva Ecija → Marikina palengke</p>
          <p class="sample-line">You rated the requester: <span class="sample-stars">★★★★★</span></p>
        </div>
      </div>
    </div>
    <a class="btn-primary rp-after-cta" href="../auth/register.html?role=driver" data-auth-cta="drive">Sign up to drive</a>
  </section>

  <section class="hiw-section" aria-labelledby="faq-heading">
    <h2 id="faq-heading">Before you take your first job</h2>
    <p class="hiw-intro">Straight answers to what drivers ask first. Something else? <a class="hiw-link" href="contact.html">Contact us.</a></p>
    <div class="rp-qa">
      <div class="rp-qa-item"><h3>How do I get paid?</h3><p>In cash, by the customer receiving the goods at drop-off: the fare shown on the job, tolls included. If anyone disputes it, the booked fare is in the booking, and you can contact us.</p></div>
      <div class="rp-qa-item"><h3>Can I choose which jobs I take?</h3><p>Yes. Browse the available deliveries and accept only the ones that fit your route and your truck.</p></div>
      <div class="rp-qa-item"><h3>What do customers see about me?</h3><p>Your name once you accept, plus your vehicle type and plate number if you add them on your dashboard.</p></div>
      <div class="rp-qa-item"><h3>What if another driver accepts first?</h3><p>The job leaves the list. If you both tapped Accept at the same moment, you'll see that it was taken and can pick another.</p></div>
    </div>
  </section>

  <section class="hiw-close" aria-labelledby="close-heading">
    <div>
      <h2 id="close-heading">Start taking jobs</h2>
      <p>Real loads, the fare up front, and cash in hand at drop-off.</p>
    </div>
    <div class="hiw-close-actions">
      <a class="btn-primary" href="../auth/register.html?role=driver" data-auth-cta="drive">Sign up to drive</a>
      <a class="hiw-link" href="../auth/login.html" data-auth="guest">Already a driver? Log In</a>
    </div>
  </section>
</main>
```

## 6. How It Works: sync the fare card (`pages/how-it-works.html`)
Use one example and one set of words across the site. Inside `<div class="hiw-fare-card">`, replace everything from `<p class="hiw-fare-example">` up to (not including) the `Book a Delivery` link with:
```html
<p class="hiw-fare-example">Example: Nueva Ecija → Marikina palengke, 120 km, 800 kg</p>
<dl class="hiw-fare-rows">
  <div><dt>Base fare</dt><dd>₱150</dd></div>
  <div><dt>120 km × ₱15</dt><dd>₱1,800</dd></div>
  <div><dt>800 kg × ₱2</dt><dd>₱1,600</dd></div>
  <div><dt>Expressway tolls</dt><dd>Included</dd></div>
  <div class="hiw-fare-total"><dt>Fare for this trip<span>Locked in when you book</span></dt><dd>₱3,550</dd></div>
</dl>
<p>Your fare uses the road distance from the map, not a straight line.</p>
<p class="hiw-fare-rule">The fare you book is the fare you pay. No haggling at <span class="hiw-nowrap">drop-off.</span></p>
<p>Like cash on delivery: whoever receives the goods pays the driver in cash at <span class="hiw-nowrap">drop-off.</span> Paying through Sakada (GCash or COD) is coming soon.</p>
```
Also in the fare intro paragraph above the card, change `Here's a worked example.` to `Here's an example run from a farm in Nueva Ecija to the Marikina palengke.`

## 7. Font cleanup
Testing in Chrome showed that the latin-ext font files **don't contain ₱**. The browser still downloads them on every page that uses ₱, and then draws the ₱ in the system font anyway. Remove them:
- In `css/fonts.css`, delete the two `@font-face` blocks under the comment `/* latin-ext: only downloaded when the page uses these characters (e.g. ₱) */`, along with that comment.
- Delete `assets/fonts/barlow-condensed-800-latin-ext.woff2` and `assets/fonts/public-sans-latin-ext.woff2`.
- ₱ then falls back to the system sans-serif, exactly as it does today. Don't add anything else.

## 8. Smoke-test fixes (`e2e/smoke.spec.mjs`)
For Drivers now has several `[data-auth-cta="drive"]` buttons, and Playwright's strict mode fails on multiple matches. Change:
- `page.locator('[data-auth-cta="drive"]')` in the test **"For Drivers button opens driver sign-up"** to `page.locator('[data-auth-cta="drive"]').first()`.
- In **"driver sees Find Deliveries on For Drivers"**, change `const btn = page.locator('[data-auth-cta="drive"]');` to `const btn = page.locator('[data-auth-cta="drive"]').first();`.

## Checks before you finish
1. `cd sakada-web && npm run lint && npx vitest run && npm run test:e2e` all pass (66 unit, 26 e2e).
2. `grep -rn "eyebrow-role\|near you" pages/for-*.html` returns nothing.
3. `grep -rn "latin-ext" css/ assets/fonts/` returns nothing.
4. Open each page at 1440 and 390:
   - nothing overflows
   - the map image shows
   - the live-map card is the big left card on desktop and second on mobile
   - logged out, all buttons go to sign-up with the right role
