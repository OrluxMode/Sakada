# OpenCode task: new farmer and vendor dashboard (Phase 1)

Rebuild the farmer and vendor dashboards to match the approved Figma v4 frames. It is one page with four views: **Home · Book · History · Profile**.
- **Phones:** one view at a time, with a tab bar at the bottom.
- **Desktop (≥1024px):** a top bar with Home / History / Profile, and the Book panel always showing on the right.

What's new on the page:
- deliveries are grouped: **On the road**, **Driver assigned**, **Waiting for a driver**, **Rate your driver** (with "Not now")
- a 5-step stage bar on every card
- booking shows the fare first, with the places we matched; nothing is booked until Confirm
- booking errors are in plain words, shown under the field they're about
- cancelling goes through a confirm sheet instead of the browser's pop-up
- History has All / Delivered / Cancelled filters and rating inline
- a notifications sheet: tapping one opens that delivery
- a "Use a recent route" button
- "Send Sakada a message" fills in the booking code on the contact page
- the old `#deliveryForm` link from the landing page opens the Book view

The data calls, the fare formula and the database don't change. **No SQL to run.**

**All code below is final.** Claude built it on a copy of the site and ran it in a browser at 1440 and 390px (0 console errors, no sideways scrolling). Results: lint clean, **133/133 unit tests**, **57/57 e2e tests**. **Copy every block exactly.** Don't change other files, and don't commit.

## 1. Replace `sakada-web/dashboard/farmer/index.html` with:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Farmer Dashboard — Sakada Logistics</title>
    <meta name="robots" content="noindex" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://api.mapbox.com data:; connect-src 'self' https://*.supabase.co https://api.mapbox.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com wss://*.supabase.co; frame-src 'none';" />
    <link rel="stylesheet" href="../../css/fonts.css" />
    <link rel="stylesheet" href="../../css/style.css" />
    <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js" integrity="sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N" crossorigin="anonymous"></script>
  </head>
  <body class="rq" data-role="farmer" data-view="home">
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="offline-banner" id="offlineBanner">
      <span class="offline-banner__icon">⚠</span>
      You're offline. You can look around, but booking and cancelling wait until you're back online.
    </div>
    <div class="page-loader" id="pageLoader">
      <div class="page-loader__spinner"></div>
    </div>

    <!-- Desktop top bar (hidden on phones; phones use the bottom tabs) -->
    <header class="rq-topbar">
      <a class="logo" href="../../index.html">SAKA<span class="mark">DA</span></a>
      <nav class="rq-topnav" aria-label="Dashboard">
        <a href="#home" data-tab="home">Home</a>
        <a href="#history" data-tab="history">History</a>
        <a href="#profile" data-tab="profile">Profile</a>
      </nav>
      <button class="rq-bell" type="button" data-open-notifs aria-label="Notifications">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
        <span class="rq-badge" data-unread hidden></span>
      </button>
      <a class="rq-account" href="#profile">
        <span class="rq-avatar rq-avatar--sm" data-initials></span>
        <span data-user-name>Loading…</span>
      </a>
    </header>

    <div class="rq-layout">
      <main class="rq-main" id="main" tabindex="-1">
        <!-- HOME -->
        <section class="rq-view" id="view-home" aria-labelledby="homeTitle">
          <div class="rq-hello">
            <span class="rq-avatar" data-initials aria-hidden="true"></span>
            <div class="rq-hello-text">
              <h1 id="homeTitle" class="rq-display">Hello</h1>
              <p class="rq-summary" id="homeSummary"></p>
            </div>
            <button class="rq-bell rq-bell--phone" type="button" data-open-notifs aria-label="Notifications">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
              <span class="rq-badge" data-unread hidden></span>
            </button>
          </div>

          <div class="rq-banner rq-banner--ok" id="bookedBanner" role="status" hidden>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            <p><strong>Booked.</strong> You'll see it here and under the bell when a driver accepts.</p>
          </div>

          <div id="homeLists" aria-live="polite">
            <div class="rq-skeletons"></div>
          </div>

          <a class="rq-help" href="../../pages/contact.html">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <span><span class="rq-muted">Something wrong with a delivery?</span> <strong>Send Sakada a message</strong></span>
          </a>
        </section>

        <!-- HISTORY -->
        <section class="rq-view" id="view-history" aria-labelledby="historyTitle">
          <h1 id="historyTitle" class="rq-display">History</h1>
          <div class="rq-filters" role="group" aria-label="Show">
            <button type="button" class="rq-filter" data-filter="all" aria-pressed="true">All</button>
            <button type="button" class="rq-filter" data-filter="delivered" aria-pressed="false">Delivered</button>
            <button type="button" class="rq-filter" data-filter="cancelled" aria-pressed="false">Cancelled</button>
          </div>
          <div id="historyList" aria-live="polite"></div>
        </section>

        <!-- PROFILE -->
        <section class="rq-view" id="view-profile" aria-labelledby="profileTitle">
          <div class="rq-profile-head">
            <span class="rq-avatar rq-avatar--lg" data-initials aria-hidden="true"></span>
            <div>
              <h1 id="profileTitle" class="rq-display" data-user-name>Profile</h1>
              <p class="rq-muted"><span>Farmer</span><span id="profileEmail"></span></p>
            </div>
          </div>
          <div class="rq-list">
            <button type="button" class="rq-row" data-open-notifs>
              <span>Notifications</span><span class="rq-row-meta" data-unread-text></span>
            </button>
            <a class="rq-row" href="../../pages/contact.html"><span>Send Sakada a message</span></a>
            <a class="rq-row" href="../../pages/how-it-works.html"><span>How it works</span></a>
          </div>
          <div class="rq-note">
            <p><strong>Your role: Farmer</strong></p>
            <p class="rq-muted">Roles can't be changed. Farmers and vendors get the same booking tools.</p>
          </div>
          <button class="rq-btn rq-btn--ghost" id="signOutBtn" type="button">Log out</button>
        </section>
      </main>

      <!-- BOOK (its own tab on phones, a side panel on desktop) -->
      <aside class="rq-book rq-view" id="view-book" aria-labelledby="bookTitle">
        <h1 id="bookTitle" class="rq-display">Book a truck</h1>
        <p class="rq-muted">Get the fare first. Nothing is booked until you confirm.</p>

        <button type="button" class="rq-row rq-recent" id="recentRoute" hidden>
          <span><strong>Use a recent route</strong><br /><span class="rq-muted" id="recentRouteText"></span></span>
        </button>

        <form id="deliveryForm" class="rq-form" novalidate>
          <fieldset>
            <legend>Route</legend>
            <div class="field">
              <label for="pickupAddress">Pickup address</label>
              <input id="pickupAddress" type="text" placeholder="Barangay, town, province" autocomplete="off" required />
            </div>
            <div class="field">
              <label for="dropoffAddress">Drop-off address</label>
              <input id="dropoffAddress" type="text" placeholder="Market or warehouse, city" autocomplete="off" required />
            </div>
          </fieldset>
          <fieldset>
            <legend>Load</legend>
            <div class="field">
              <label for="goodsDescription">What are you shipping?</label>
              <input id="goodsDescription" type="text" placeholder="e.g. Tomatoes, 40 crates" required />
            </div>
            <div class="field">
              <label for="quantityKg">Total weight (kg)</label>
              <input id="quantityKg" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 800" aria-describedby="kgHint" required />
              <p class="rq-hint" id="kgHint">A rough total is fine. Drivers see it before they accept.</p>
            </div>
          </fieldset>
          <fieldset>
            <legend>When</legend>
            <div class="field">
              <label for="scheduledPickup">Pickup date</label>
              <input id="scheduledPickup" type="date" required />
            </div>
            <div class="field">
              <label for="notes">Notes for the driver <span class="rq-muted">(optional)</span></label>
              <textarea id="notes" rows="3" maxlength="500" placeholder="Who receives and pays at drop-off, gate code, where to load"></textarea>
            </div>
          </fieldset>

          <div id="formMessage" class="rq-banner rq-banner--bad" role="alert" hidden></div>

          <div class="rq-quote" id="quote" hidden>
            <p class="rq-quote-label">Your fare</p>
            <p class="rq-quote-amount" id="quoteAmount"></p>
            <p id="quoteBreakdown"></p>
            <p class="rq-muted">Whoever receives the goods pays the driver this in cash at drop-off.</p>
            <div class="rq-matched">
              <p class="rq-muted"><strong>We matched</strong></p>
              <p id="matchedPickup"></p>
              <p id="matchedDropoff"></p>
              <button type="button" class="rq-link" id="notRight">Not right? Add the barangay and town</button>
            </div>
          </div>
          <div class="rq-quote rq-quote--stale" id="quoteStale" hidden>
            <p class="rq-quote-label">Your fare</p>
            <p>Details changed. Get the fare again before you book.</p>
          </div>

          <div class="rq-book-actions">
            <button class="rq-btn" type="submit" id="estimateBtn">Get the fare</button>
            <button class="rq-btn" type="button" id="confirmBtn" hidden>Confirm booking</button>
          </div>
          <p class="rq-hint rq-formula">₱150 base + ₱15 per km + ₱2 per kg. Tolls included.</p>
        </form>
      </aside>
    </div>

    <!-- Phone tab bar -->
    <nav class="rq-tabs" aria-label="Dashboard">
      <a href="#home" data-tab="home"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>Home</a>
      <a href="#book" data-tab="book"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>Book</a>
      <a href="#history" data-tab="history"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>History</a>
      <a href="#profile" data-tab="profile"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a>
    </nav>

    <!-- Notifications sheet -->
    <dialog class="rq-sheet" id="notifSheet" aria-labelledby="notifTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <div class="rq-sheet-head">
        <h2 id="notifTitle" class="rq-display">Notifications</h2>
        <span class="rq-row-meta" data-unread-text></span>
      </div>
      <ul class="rq-notifs" id="notifList"></ul>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet>Close</button>
    </dialog>

    <!-- Cancel confirm -->
    <dialog class="rq-sheet" id="cancelSheet" aria-labelledby="cancelTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <h2 id="cancelTitle" class="rq-display">Cancel this request?</h2>
      <p class="rq-muted" id="cancelWhat"></p>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet autofocus>Keep request</button>
      <button class="rq-btn rq-btn--danger" type="button" id="cancelConfirm">Cancel request</button>
    </dialog>

    <script type="module" src="../../js/requester-dashboard.js"></script>
  </body>
</html>
```

## 2. Replace `sakada-web/dashboard/vendor/index.html` with:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Vendor Dashboard — Sakada Logistics</title>
    <meta name="robots" content="noindex" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://api.mapbox.com data:; connect-src 'self' https://*.supabase.co https://api.mapbox.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com wss://*.supabase.co; frame-src 'none';" />
    <link rel="stylesheet" href="../../css/fonts.css" />
    <link rel="stylesheet" href="../../css/style.css" />
    <link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.15/purify.min.js" integrity="sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N" crossorigin="anonymous"></script>
  </head>
  <body class="rq" data-role="vendor" data-view="home">
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="offline-banner" id="offlineBanner">
      <span class="offline-banner__icon">⚠</span>
      You're offline. You can look around, but booking and cancelling wait until you're back online.
    </div>
    <div class="page-loader" id="pageLoader">
      <div class="page-loader__spinner"></div>
    </div>

    <!-- Desktop top bar (hidden on phones; phones use the bottom tabs) -->
    <header class="rq-topbar">
      <a class="logo" href="../../index.html">SAKA<span class="mark">DA</span></a>
      <nav class="rq-topnav" aria-label="Dashboard">
        <a href="#home" data-tab="home">Home</a>
        <a href="#history" data-tab="history">History</a>
        <a href="#profile" data-tab="profile">Profile</a>
      </nav>
      <button class="rq-bell" type="button" data-open-notifs aria-label="Notifications">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
        <span class="rq-badge" data-unread hidden></span>
      </button>
      <a class="rq-account" href="#profile">
        <span class="rq-avatar rq-avatar--sm" data-initials></span>
        <span data-user-name>Loading…</span>
      </a>
    </header>

    <div class="rq-layout">
      <main class="rq-main" id="main" tabindex="-1">
        <!-- HOME -->
        <section class="rq-view" id="view-home" aria-labelledby="homeTitle">
          <div class="rq-hello">
            <span class="rq-avatar" data-initials aria-hidden="true"></span>
            <div class="rq-hello-text">
              <h1 id="homeTitle" class="rq-display">Hello</h1>
              <p class="rq-summary" id="homeSummary"></p>
            </div>
            <button class="rq-bell rq-bell--phone" type="button" data-open-notifs aria-label="Notifications">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>
              <span class="rq-badge" data-unread hidden></span>
            </button>
          </div>

          <div class="rq-banner rq-banner--ok" id="bookedBanner" role="status" hidden>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            <p><strong>Booked.</strong> You'll see it here and under the bell when a driver accepts.</p>
          </div>

          <div id="homeLists" aria-live="polite">
            <div class="rq-skeletons"></div>
          </div>

          <a class="rq-help" href="../../pages/contact.html">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            <span><span class="rq-muted">Something wrong with a delivery?</span> <strong>Send Sakada a message</strong></span>
          </a>
        </section>

        <!-- HISTORY -->
        <section class="rq-view" id="view-history" aria-labelledby="historyTitle">
          <h1 id="historyTitle" class="rq-display">History</h1>
          <div class="rq-filters" role="group" aria-label="Show">
            <button type="button" class="rq-filter" data-filter="all" aria-pressed="true">All</button>
            <button type="button" class="rq-filter" data-filter="delivered" aria-pressed="false">Delivered</button>
            <button type="button" class="rq-filter" data-filter="cancelled" aria-pressed="false">Cancelled</button>
          </div>
          <div id="historyList" aria-live="polite"></div>
        </section>

        <!-- PROFILE -->
        <section class="rq-view" id="view-profile" aria-labelledby="profileTitle">
          <div class="rq-profile-head">
            <span class="rq-avatar rq-avatar--lg" data-initials aria-hidden="true"></span>
            <div>
              <h1 id="profileTitle" class="rq-display" data-user-name>Profile</h1>
              <p class="rq-muted"><span>Vendor</span><span id="profileEmail"></span></p>
            </div>
          </div>
          <div class="rq-list">
            <button type="button" class="rq-row" data-open-notifs>
              <span>Notifications</span><span class="rq-row-meta" data-unread-text></span>
            </button>
            <a class="rq-row" href="../../pages/contact.html"><span>Send Sakada a message</span></a>
            <a class="rq-row" href="../../pages/how-it-works.html"><span>How it works</span></a>
          </div>
          <div class="rq-note">
            <p><strong>Your role: Vendor</strong></p>
            <p class="rq-muted">Roles can't be changed. Farmers and vendors get the same booking tools.</p>
          </div>
          <button class="rq-btn rq-btn--ghost" id="signOutBtn" type="button">Log out</button>
        </section>
      </main>

      <!-- BOOK (its own tab on phones, a side panel on desktop) -->
      <aside class="rq-book rq-view" id="view-book" aria-labelledby="bookTitle">
        <h1 id="bookTitle" class="rq-display">Book a truck</h1>
        <p class="rq-muted">Get the fare first. Nothing is booked until you confirm.</p>

        <button type="button" class="rq-row rq-recent" id="recentRoute" hidden>
          <span><strong>Use a recent route</strong><br /><span class="rq-muted" id="recentRouteText"></span></span>
        </button>

        <form id="deliveryForm" class="rq-form" novalidate>
          <fieldset>
            <legend>Route</legend>
            <div class="field">
              <label for="pickupAddress">Pickup address</label>
              <input id="pickupAddress" type="text" placeholder="Barangay, town, province" autocomplete="off" required />
            </div>
            <div class="field">
              <label for="dropoffAddress">Drop-off address</label>
              <input id="dropoffAddress" type="text" placeholder="Market or warehouse, city" autocomplete="off" required />
            </div>
          </fieldset>
          <fieldset>
            <legend>Load</legend>
            <div class="field">
              <label for="goodsDescription">What are you shipping?</label>
              <input id="goodsDescription" type="text" placeholder="e.g. Tomatoes, 40 crates" required />
            </div>
            <div class="field">
              <label for="quantityKg">Total weight (kg)</label>
              <input id="quantityKg" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 800" aria-describedby="kgHint" required />
              <p class="rq-hint" id="kgHint">A rough total is fine. Drivers see it before they accept.</p>
            </div>
          </fieldset>
          <fieldset>
            <legend>When</legend>
            <div class="field">
              <label for="scheduledPickup">Pickup date</label>
              <input id="scheduledPickup" type="date" required />
            </div>
            <div class="field">
              <label for="notes">Notes for the driver <span class="rq-muted">(optional)</span></label>
              <textarea id="notes" rows="3" maxlength="500" placeholder="Who receives and pays at drop-off, gate code, where to load"></textarea>
            </div>
          </fieldset>

          <div id="formMessage" class="rq-banner rq-banner--bad" role="alert" hidden></div>

          <div class="rq-quote" id="quote" hidden>
            <p class="rq-quote-label">Your fare</p>
            <p class="rq-quote-amount" id="quoteAmount"></p>
            <p id="quoteBreakdown"></p>
            <p class="rq-muted">Whoever receives the goods pays the driver this in cash at drop-off.</p>
            <div class="rq-matched">
              <p class="rq-muted"><strong>We matched</strong></p>
              <p id="matchedPickup"></p>
              <p id="matchedDropoff"></p>
              <button type="button" class="rq-link" id="notRight">Not right? Add the barangay and town</button>
            </div>
          </div>
          <div class="rq-quote rq-quote--stale" id="quoteStale" hidden>
            <p class="rq-quote-label">Your fare</p>
            <p>Details changed. Get the fare again before you book.</p>
          </div>

          <div class="rq-book-actions">
            <button class="rq-btn" type="submit" id="estimateBtn">Get the fare</button>
            <button class="rq-btn" type="button" id="confirmBtn" hidden>Confirm booking</button>
          </div>
          <p class="rq-hint rq-formula">₱150 base + ₱15 per km + ₱2 per kg. Tolls included.</p>
        </form>
      </aside>
    </div>

    <!-- Phone tab bar -->
    <nav class="rq-tabs" aria-label="Dashboard">
      <a href="#home" data-tab="home"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>Home</a>
      <a href="#book" data-tab="book"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>Book</a>
      <a href="#history" data-tab="history"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>History</a>
      <a href="#profile" data-tab="profile"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Profile</a>
    </nav>

    <!-- Notifications sheet -->
    <dialog class="rq-sheet" id="notifSheet" aria-labelledby="notifTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <div class="rq-sheet-head">
        <h2 id="notifTitle" class="rq-display">Notifications</h2>
        <span class="rq-row-meta" data-unread-text></span>
      </div>
      <ul class="rq-notifs" id="notifList"></ul>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet>Close</button>
    </dialog>

    <!-- Cancel confirm -->
    <dialog class="rq-sheet" id="cancelSheet" aria-labelledby="cancelTitle">
      <div class="rq-sheet-grab" aria-hidden="true"></div>
      <h2 id="cancelTitle" class="rq-display">Cancel this request?</h2>
      <p class="rq-muted" id="cancelWhat"></p>
      <button class="rq-btn rq-btn--ghost" type="button" data-close-sheet autofocus>Keep request</button>
      <button class="rq-btn rq-btn--danger" type="button" id="cancelConfirm">Cancel request</button>
    </dialog>

    <script type="module" src="../../js/requester-dashboard.js"></script>
  </body>
</html>
```

## 3. Create `sakada-web/css/requester.css` with:
```css
/* ================================================
   Farmer / vendor dashboard (v4 design, Figma "dashboards" v4).
   Everything is scoped to body.rq so the driver and admin
   dashboards keep their own styles.
   Phones: one view at a time + bottom tab bar.
   ≥1024px: top bar, main column + a sticky "Book a truck" panel.
   ================================================ */
.rq {
  --rq-edge: #6b6a62;            /* ≥3:1 edges for tappable rows and bars */
  --rq-card-line: rgb(var(--cream-rgb) / 0.16);
  --rq-field-line: rgb(var(--cream-rgb) / 0.45);
  --rq-meta: #c9c5b7;
  --rq-tab-h: 84px;
  background-color: var(--bg-black);
  background-image:
    linear-gradient(rgb(var(--cream-rgb) / 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--cream-rgb) / 0.05) 1px, transparent 1px);
  background-size: 32px 32px;
  padding-bottom: calc(var(--rq-tab-h) + 24px + env(safe-area-inset-bottom));
}
.rq button { font-family: inherit; }
.rq .rq-sr {
  position: absolute; width: 1px; height: 1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap;
}
.rq .rq-muted { color: var(--rq-meta); }
.rq p { margin: 0; }
.rq .rq-display {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 800;
  line-height: 1.05;
  font-size: 32px;
  margin: 0;
}

/* ---------- Views ---------- */
.rq-layout { padding: 16px 20px 0; max-width: 1312px; margin: 0 auto; }
.rq .rq-view { display: none; }
.rq[data-view="home"] #view-home,
.rq[data-view="book"] #view-book,
.rq[data-view="history"] #view-history,
.rq[data-view="profile"] #view-profile { display: block; }
.rq-main:focus { outline: none; }

/* ---------- Header (phones) ---------- */
.rq-topbar { display: none; }
.rq-hello { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
.rq-hello-text { flex: 1; min-width: 0; }
.rq-summary { color: var(--rq-meta); font-size: 15px; line-height: 1.4; }
.rq-avatar {
  display: inline-grid; place-items: center; flex: none;
  width: 48px; height: 48px; border-radius: 50%;
  background: rgb(224 151 47 / 0.16); border: 1px solid var(--accent-amber);
  color: #f0b25a; font-weight: 700; font-size: 17px;
}
.rq-avatar--sm { width: 40px; height: 40px; font-size: 15px; }
.rq-avatar--lg { width: 64px; height: 64px; font-size: 22px; }
.rq-bell {
  position: relative; display: grid; place-items: center; flex: none;
  width: 48px; height: 48px; border-radius: 50%;
  background: none; border: 1px solid var(--rq-field-line); color: var(--text-cream); cursor: pointer;
}
.rq-badge {
  position: absolute; top: -6px; right: -4px; min-width: 20px; height: 20px; padding: 0 6px;
  border-radius: 999px; background: var(--accent-amber); color: var(--text-on-amber);
  font-size: 13px; font-weight: 700; line-height: 20px; text-align: center;
}

/* ---------- Bottom tabs (phones) ---------- */
.rq-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  display: grid; grid-template-columns: repeat(4, 1fr);
  padding: 0 8px env(safe-area-inset-bottom);
  background: #15160f; border-top: 1px solid var(--rq-edge);
}
.rq-tabs a {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-height: 62px; padding-top: 10px;
  color: var(--rq-meta); font-size: 14px; font-weight: 500; text-decoration: none;
}
.rq-tabs a[aria-current="page"] { color: #f0b25a; font-weight: 700; }
.rq-tabs a[aria-current="page"]::before {
  content: ""; position: absolute; top: 0; width: 32px; height: 3px; border-radius: 2px; background: var(--accent-amber);
}
.rq-tabs a[aria-current="page"] svg { color: var(--accent-amber); }

/* ---------- Buttons, links, banners ---------- */
.rq .rq-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; min-height: 48px; padding: 0 16px; border-radius: 8px;
  background: var(--accent-amber); border: 0; color: var(--text-on-amber);
  font-size: 16px; font-weight: 700; text-decoration: none; cursor: pointer;
}
.rq .rq-btn:hover { background: var(--accent-amber-dim); }
.rq .rq-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.rq .rq-btn--ghost { background: none; border: 1px solid var(--rq-field-line); color: var(--text-cream); }
.rq .rq-btn--ghost:hover { background: rgb(var(--cream-rgb) / 0.06); }
.rq .rq-btn--danger { background: var(--status-cancelled); color: var(--text-on-amber); }
.rq .rq-btn--danger-line { background: none; border: 1px solid var(--status-cancelled); color: #f2a98a; }
.rq .rq-btn--danger-line:hover { background: rgb(224 84 47 / 0.12); }
.rq .rq-btn--text { background: none; color: var(--rq-meta); width: auto; }
.rq .rq-btn--text:hover { background: none; color: var(--text-cream); }
.rq .rq-link {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0; background: none; border: 0;
  color: #f0b25a; font-size: 15px; font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
}
.rq-banner {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 14px; border-radius: 10px; border: 1px solid; font-size: 15px; line-height: 1.45;
}
.rq-banner[hidden] { display: none; }
.rq-banner--ok { border-color: var(--status-delivered); background: rgb(122 176 92 / 0.1); color: var(--text-cream); margin-bottom: 20px; }
.rq-banner--ok svg { color: var(--status-delivered); flex: none; }
.rq-banner--bad { border-color: var(--status-cancelled); background: rgb(224 84 47 / 0.1); color: #f2a98a; }
.rq-banner--warn { border-color: var(--accent-amber); background: rgb(224 151 47 / 0.1); color: var(--text-cream); }
.rq-banner a { color: #f0b25a; }

/* ---------- Sections and cards ---------- */
.rq-section { margin-bottom: 28px; }
.rq-section > .rq-muted { margin: -6px 0 10px; font-size: 15px; }
.rq-section-title {
  font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 26px; line-height: 1.1; margin: 0 0 10px;
}
.rq-card {
  display: flex; flex-direction: column; gap: 16px;
  padding: 18px; margin-bottom: 12px; border-radius: 14px;
  background: var(--panel-dark); border: 1px solid var(--rq-card-line);
}
.rq-card:focus { outline: 2px solid var(--accent-amber); outline-offset: 3px; }
.rq-card--new { border-color: var(--accent-amber); box-shadow: inset 0 0 0 0.5px var(--accent-amber); }
.rq-card--rate { border-color: var(--status-delivered); }
.rq-card-title { font-size: 17px; font-weight: 600; line-height: 1.4; margin: 0; }
.rq-card .rq-muted { font-size: 15px; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
.rq-card-actions { display: flex; gap: 10px; }
.rq-card-actions .rq-btn--text { flex: none; min-width: 96px; }

.rq-route { display: grid; grid-template-columns: 14px 1fr; gap: 12px; }
.rq-route p { font-size: 16px; line-height: 1.4; }
.rq-route p + p { margin-top: 12px; }
.rq-route .rq-muted { font-size: 14px; display: inline; }
.rq-route-dots {
  position: relative; margin: 8px 0 26px;
  border-left: 2px dashed rgb(184 180 166 / 0.6); left: 6px; width: 0;
}
.rq-route-dots::before, .rq-route-dots::after {
  content: ""; position: absolute; left: -7px; width: 8px; height: 8px; border-radius: 50%; background: var(--panel-dark);
  border: 2.5px solid var(--status-delivered);
}
.rq-route-dots::before { top: -8px; }
.rq-route-dots::after { bottom: -26px; border-color: var(--accent-amber); }

.rq-stepper { display: flex; flex-direction: column; gap: 8px; }
.rq-stepper-bars { display: flex; gap: 4px; align-items: center; height: 12px; }
.rq-step { flex: 1; height: 6px; border-radius: 3px; box-sizing: border-box; }
.rq-step--done { background: rgb(224 151 47 / 0.5); }
.rq-step--current { height: 12px; border-radius: 4px; background: var(--accent-amber); }
.rq-step--next { border: 1px solid rgb(var(--cream-rgb) / 0.5); }
.rq-step--waiting { background: rgb(224 151 47 / 0.18); border: 1.5px solid var(--accent-amber); }
.rq-stepper-labels { display: none; }
.rq-stepper-line { font-size: 16px; color: var(--rq-meta); }
.rq-stepper-line strong { color: #f0b25a; font-weight: 600; }

.rq-driver, .rq-note-row {
  display: flex; gap: 10px; align-items: center;
  padding: 12px; border-radius: 10px; background: var(--bg-black); font-size: 15px; line-height: 1.4;
}
.rq-driver svg { color: #f0b25a; flex: none; }
.rq-note-row { color: var(--rq-meta); }
.rq-map { border-radius: 10px; overflow: hidden; background: #1b1f24; aspect-ratio: 600 / 320; max-height: 180px; }
.rq-map img { display: block; width: 100%; height: 100%; object-fit: cover; }

.rq-fare {
  display: flex; gap: 12px; align-items: center;
  padding-top: 14px; border-top: 1px solid rgb(var(--cream-rgb) / 0.12);
}
.rq-fare-amount {
  flex: none; font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 30px; line-height: 1;
}
.rq-fare .rq-muted { font-size: 15px; line-height: 1.45; display: block; }

/* Rating */
.rq-rate { display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 10px; background: var(--bg-black); }
.rq-stars { display: flex; gap: 2px; }
.rq-stars button {
  display: grid; place-items: center; width: 48px; height: 48px; padding: 0;
  background: none; border: 0; border-radius: 8px; cursor: pointer;
}
.rq-stars svg { fill: none; stroke: var(--text-muted); stroke-width: 1.6; stroke-linejoin: round; }
.rq-stars button.is-on svg { fill: var(--accent-amber); stroke: var(--accent-amber); }
.rq-rate textarea {
  min-height: 64px; padding: 10px 12px; border-radius: 6px; resize: vertical;
  background: var(--panel-dark); border: 1px solid var(--rq-field-line); color: var(--text-cream); font: inherit; font-size: 16px;
}

.rq-empty { gap: 12px; }
.rq-steps { margin: 0; padding-left: 22px; color: var(--rq-meta); display: grid; gap: 8px; font-size: 16px; line-height: 1.5; }

/* Help row and lists */
.rq-help, .rq .rq-row {
  display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px; width: 100%;
  border-radius: 12px; background: var(--panel-dark); border: 1px solid var(--rq-edge);
  color: var(--text-cream); text-decoration: none; text-align: left; font-size: 16px; cursor: pointer;
}
.rq-help svg { color: #f0b25a; flex: none; }
.rq-help .rq-muted { font-size: 15px; }
.rq-row-meta { margin-left: auto; color: #f0b25a; font-size: 14px; font-weight: 600; }
.rq-list { display: grid; gap: 0; border-radius: 14px; overflow: hidden; border: 1px solid var(--rq-card-line); margin: 24px 0 16px; }
.rq-list .rq-row { border: 0; border-radius: 0; border-top: 1px solid rgb(var(--cream-rgb) / 0.12); }
.rq-list .rq-row:first-child { border-top: 0; }
.rq-note { padding: 14px 16px; border-radius: 12px; border: 1px solid var(--rq-card-line); margin-bottom: 24px; font-size: 15px; line-height: 1.5; }
.rq-profile-head { display: flex; gap: 14px; align-items: center; }

/* History filters */
.rq-filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.rq-filter {
  min-height: 44px; padding: 0 14px; border-radius: 999px;
  background: none; border: 1px solid var(--rq-field-line); color: var(--text-cream); font-size: 15px; cursor: pointer;
}
.rq-filter[aria-pressed="true"] { background: var(--text-cream); color: var(--bg-black); font-weight: 700; border-color: var(--text-cream); }

/* ---------- Book ---------- */
.rq-book > .rq-muted { margin: 6px 0 16px; font-size: 16px; }
.rq-recent { margin-bottom: 8px; }
.rq-form fieldset { border: 0; padding: 0; margin: 24px 0 0; display: grid; gap: 16px; min-width: 0; }
.rq-form legend { font-size: 18px; font-weight: 600; margin-bottom: 16px; padding: 0; }
.rq .field label { font-size: 16px; color: var(--text-cream); }
.rq .field input,
.rq .field textarea {
  min-height: 48px; font-size: 16px; background: var(--bg-black); border-color: var(--rq-field-line); border-radius: 6px;
}
.rq .field input[aria-invalid="true"] { border-color: #e0542f; box-shadow: 0 0 0 1px #e0542f; }
.rq .field { margin-bottom: 0; }
.rq-hint { font-size: 15px; color: var(--rq-meta); line-height: 1.45; margin: 0; }
.rq-form > .rq-banner { margin-top: 20px; }
.rq-quote {
  display: grid; gap: 10px; margin-top: 24px; padding: 18px; border-radius: 14px;
  background: rgb(224 151 47 / 0.08); border: 1px solid var(--accent-amber); font-size: 16px; line-height: 1.5;
}
.rq-quote[hidden] { display: none; }
.rq-quote-label { color: #f0b25a; font-weight: 600; }
.rq-quote-amount { font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: 40px; line-height: 1; }
.rq-quote--stale { background: none; border: 1px dashed var(--rq-field-line); }
.rq-quote--stale .rq-quote-label { color: var(--rq-meta); }
.rq-matched { display: grid; gap: 6px; padding-top: 12px; border-top: 1px solid rgb(224 151 47 / 0.4); font-size: 15px; }
.rq-book-actions { margin-top: 24px; }
.rq-book-actions .rq-btn { min-height: 52px; font-size: 17px; }
.rq-formula { margin-top: 10px; }
.rq-has-quote .rq-formula { display: none; }

/* Phones: the fare's confirm button sits in a bar above the tabs */
@media (max-width: 1023px) {
  .rq-has-quote[data-view="book"] .rq-book-actions {
    position: fixed; left: 0; right: 0; z-index: 39;
    bottom: calc(var(--rq-tab-h) + env(safe-area-inset-bottom));
    margin: 0; padding: 12px 20px; background: #15160f; border-top: 1px solid var(--rq-edge);
  }
  .rq-has-quote .rq-quote { scroll-margin-bottom: calc(var(--rq-tab-h) + 100px + env(safe-area-inset-bottom)); }
  .rq-has-quote[data-view="book"] { padding-bottom: calc(var(--rq-tab-h) + 100px + env(safe-area-inset-bottom)); }
}

/* ---------- Sheets ---------- */
.rq-sheet {
  width: 100%; max-width: 560px; max-height: 85vh; margin: auto auto 0; padding: 10px 20px 24px;
  border: 1px solid var(--rq-edge); border-bottom: 0; border-radius: 20px 20px 0 0;
  background: #16170f; color: var(--text-cream);
}
.rq-sheet[open] { display: flex; flex-direction: column; gap: 14px; }
.rq-sheet::backdrop { background: rgb(0 0 0 / 0.6); }
.rq-sheet-grab { width: 40px; height: 4px; border-radius: 2px; background: rgb(var(--cream-rgb) / 0.4); margin: 0 auto 6px; }
.rq-sheet-head { display: flex; justify-content: space-between; align-items: center; }
.rq-sheet .rq-display { font-size: 28px; }
.rq-notifs { list-style: none; margin: 0; padding: 0; overflow: auto; border-radius: 14px; border: 1px solid var(--rq-card-line); }
.rq-notifs li + li { border-top: 1px solid rgb(var(--cream-rgb) / 0.12); }
.rq-notif {
  display: flex; gap: 12px; align-items: flex-start; width: 100%; padding: 14px 16px;
  background: var(--panel-dark); border: 0; color: var(--text-cream); text-align: left; font-size: 16px; line-height: 1.4; cursor: pointer;
}
.rq-notif.is-unread { font-weight: 600; }
.rq-notif .rq-muted { font-size: 14px; font-weight: 400; }
.rq-notif-dot { flex: none; width: 10px; height: 10px; margin-top: 6px; border-radius: 50%; border: 1px solid var(--text-muted); }
.rq-notif.is-unread .rq-notif-dot { background: var(--accent-amber); border-color: var(--accent-amber); }
.rq-notifs .rq-empty { padding: 16px; display: grid; gap: 6px; }

/* ---------- Desktop ---------- */
@media (min-width: 1024px) {
  .rq { padding-bottom: 64px; }
  .rq-tabs, .rq-bell--phone, .rq-hello .rq-avatar { display: none; }
  .rq-topbar {
    display: flex; align-items: center; gap: 40px; height: 72px; padding: 0 64px;
    background: #15160f; border-bottom: 1px solid var(--rq-edge);
  }
  .rq-topbar .logo { font-size: 26px; }
  .rq-topnav { display: flex; gap: 8px; flex: 1; }
  .rq-topnav a {
    display: inline-flex; align-items: center; min-height: 48px; padding: 0 14px; border-radius: 8px;
    color: var(--text-muted); text-decoration: none; font-size: 16px; font-weight: 500;
  }
  .rq-topnav a[aria-current="page"] { color: #f0b25a; font-weight: 600; background: rgb(var(--cream-rgb) / 0.08); }
  .rq-account { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; color: var(--text-cream); text-decoration: none; font-size: 15px; }
  .rq-layout {
    display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 40px; align-items: start;
    padding: 36px 64px 0;
  }
  .rq .rq-display { font-size: 44px; }
  .rq-summary { font-size: 17px; }
  /* Book is always visible on desktop; #book just focuses it */
  .rq #view-book {
    display: block; position: sticky; top: 24px;
    padding: 24px; border-radius: 14px; background: var(--panel-dark); border: 1px solid var(--rq-card-line);
  }
  .rq #view-book .rq-display { font-size: 30px; }
  .rq[data-view="book"] #view-home { display: block; }
  .rq-stepper-labels { display: flex; gap: 4px; }
  .rq-step-label { flex: 1; font-size: 15px; color: var(--rq-meta); }
  .rq-step-label.is-current { color: #f0b25a; font-weight: 700; }
  .rq-stepper-line { display: none; }
  .rq-sheet { margin: auto; border-radius: 20px; border-bottom: 1px solid var(--rq-edge); }
}
```

## 4. `sakada-web/css/style.css`: add one line
Right after the line `@import "dashboard.css";`, add:
```css
@import "requester.css";
```

## 5. Replace `sakada-web/js/requester-dashboard.js` with:
```js
import { sanitizeText } from "./sanitize.js";
import { supabase } from "./supabase-client.js";
import { requireRole, signOut, updateLastLogin } from "./auth.js";
import {
  geocodeAddress,
  getDrivingDistanceKm,
  estimateCost,
  staticMapUrl,
} from "./mapbox-client.js";
import {
  cancelMyDelivery,
  createDelivery,
  getMyDeliveries,
  getMyDeliveryDrivers,
  subscribeToDeliveryUpdates,
} from "./deliveries.js";
import { submitRating, getMyRatingsForDeliveries } from "./ratings.js";
import {
  getMyNotifications,
  markNotificationRead,
  subscribeToNotifications,
} from "./notifications.js";
import {
  HISTORY_STATUSES,
  statusLabel,
  timeAgo,
  isQuoteStale,
  rebookValues,
  renderStageStepper,
  initialsFor,
  groupActive,
  homeSummary,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  bookingErrorCopy,
  contactUrl,
} from "./dashboard-shared.js";
import { toastSuccess, toastError } from "./toast.js";
import { initOfflineDetection, getIsOffline } from "./offline.js";
import {
  checkAddress,
  checkGoods,
  checkKg,
  checkPickupDate,
  checkNotes,
  localDateString,
} from "./validators.js";
import { validateFields, clearWhenFixed, showFieldError } from "./field-errors.js";

// One script serves both requester dashboards; the page says which role it's for.
const ROLE = document.body.dataset.role;
if (ROLE !== "farmer" && ROLE !== "vendor") {
  throw new Error(`requester-dashboard.js: unexpected data-role "${ROLE}"`);
}
const CONTACT = "../../pages/contact.html";
const DISMISSED_KEY = "sakada.ratingDismissed";

const profile = await requireRole(ROLE, "../../auth/login.html", "../../index.html");
if (!profile) throw new Error("redirecting");

document.getElementById("pageLoader")?.classList.add("page-loader--hidden");
initOfflineDetection();
updateLastLogin();

const $ = (id) => document.getElementById(id);
const firstName = profile.full_name.split(" ")[0];
document.querySelectorAll("[data-user-name]").forEach((el) => (el.textContent = profile.full_name));
document.querySelectorAll("[data-initials]").forEach((el) => (el.textContent = initialsFor(profile.full_name)));
$("homeTitle").textContent = `Hello, ${firstName}`;
supabase.auth.getUser().then(({ data }) => {
  if (data?.user?.email) $("profileEmail").textContent = ` · ${data.user.email}`;
});
$("signOutBtn").addEventListener("click", () => signOut("../../index.html"));

// ---------- Tabs (hash sections in one page, so realtime stays connected) ----------
const VIEWS = ["home", "book", "history", "profile"];
function showView(view, { focus = false } = {}) {
  if (view === "deliveryForm") view = "book"; // the landing page's "Book a Delivery" link
  if (!VIEWS.includes(view)) view = "home";
  document.body.dataset.view = view;
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (focus) {
    const heading = $(`view-${view}`)?.querySelector("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}
window.addEventListener("hashchange", () => showView(location.hash.slice(1), { focus: true }));
/** Switch view from code that then moves focus itself (pushState fires no hashchange). */
function goTo(view) {
  if (location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
  showView(view);
  window.scrollTo({ top: 0 });
}
showView(location.hash.slice(1));

// ---------- Sheets ----------
function openSheet(dialog) {
  dialog._returnFocus = document.activeElement;
  dialog.showModal();
}
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => dialog._returnFocus?.focus?.());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close(); // tap on the scrim
  });
  dialog.querySelectorAll("[data-close-sheet]").forEach((b) => b.addEventListener("click", () => dialog.close()));
});

// ---------- Booking form ----------
const form = $("deliveryForm");
const estimateBtn = $("estimateBtn");
const confirmBtn = $("confirmBtn");
const quoteEl = $("quote");
const quoteStaleEl = $("quoteStale");
const messageEl = $("formMessage");
const inputs = {
  pickupAddress: $("pickupAddress"),
  dropoffAddress: $("dropoffAddress"),
  goodsDescription: $("goodsDescription"),
  quantityKg: $("quantityKg"),
  scheduledPickup: $("scheduledPickup"),
  notes: $("notes"),
};
inputs.scheduledPickup.min = localDateString(); // no pickups in the past

const BOOKING_RULES = [
  [inputs.pickupAddress, (v) => checkAddress(v, "pickup")],
  [inputs.dropoffAddress, (v) => checkAddress(v, "drop-off")],
  [inputs.goodsDescription, checkGoods],
  [inputs.quantityKg, checkKg],
  [inputs.scheduledPickup, (v) => checkPickupDate(v)],
  [inputs.notes, checkNotes],
];
clearWhenFixed(BOOKING_RULES);

let pendingQuote = null;

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}
function clearMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy ? `<span class="spinner" aria-hidden="true"></span>${label}` : label;
}
function resetQuote({ stale = false } = {}) {
  pendingQuote = null;
  quoteEl.hidden = true;
  quoteStaleEl.hidden = !stale;
  confirmBtn.hidden = true;
  estimateBtn.hidden = false;
  estimateBtn.textContent = stale ? "Get the fare again" : "Get the fare";
  document.body.classList.remove("rq-has-quote");
}

["pickupAddress", "dropoffAddress", "quantityKg"].forEach((id) => {
  inputs[id].addEventListener("input", () => {
    if (pendingQuote) resetQuote({ stale: true });
  });
});
form.addEventListener("input", clearMessage);

function showBookingError(error) {
  const copy = bookingErrorCopy(error);
  if (copy.field === "pickup") {
    showFieldError(inputs.pickupAddress, copy.message);
    inputs.pickupAddress.focus();
  } else if (copy.field === "dropoff") {
    showFieldError(inputs.dropoffAddress, copy.message);
    inputs.dropoffAddress.focus();
  } else {
    showMessage(copy.message);
  }
  if (copy.kind === "mismatch") resetQuote({ stale: true });
}

async function geocodeLabelled(address, which) {
  try {
    return await geocodeAddress(address);
  } catch (err) {
    err.which = which;
    throw err;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (getIsOffline()) {
    showMessage("No connection. Check your signal and try again. Your details are still here.");
    return;
  }
  if (!validateFields(BOOKING_RULES)) return;
  clearMessage();
  setBusy(estimateBtn, true, "Getting the fare…");
  try {
    const pickupAddress = inputs.pickupAddress.value.trim();
    const dropoffAddress = inputs.dropoffAddress.value.trim();
    const quantityKg = parseFloat(inputs.quantityKg.value);
    const [pickup, dropoff] = await Promise.all([
      geocodeLabelled(pickupAddress, "pickup"),
      geocodeLabelled(dropoffAddress, "dropoff"),
    ]);
    const distanceKm = await getDrivingDistanceKm(pickup, dropoff);
    const cost = estimateCost(distanceKm, quantityKg);
    pendingQuote = { pickupAddress, dropoffAddress, pickup, dropoff, distanceKm, quantityKg, cost };

    $("quoteAmount").textContent = formatPeso(cost);
    $("quoteBreakdown").textContent = fareBreakdown(distanceKm, quantityKg);
    $("matchedPickup").textContent = `Pickup: ${pickup.placeName}`;
    $("matchedDropoff").textContent = `Drop-off: ${dropoff.placeName}`;
    quoteStaleEl.hidden = true;
    quoteEl.hidden = false;
    estimateBtn.hidden = true;
    confirmBtn.hidden = false;
    confirmBtn.textContent = `Confirm booking · ${formatPeso(cost)}`;
    document.body.classList.add("rq-has-quote");
    quoteEl.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  } catch (err) {
    showBookingError(err);
  } finally {
    estimateBtn.disabled = false;
    estimateBtn.removeAttribute("aria-busy");
    if (!pendingQuote) estimateBtn.textContent = quoteStaleEl.hidden ? "Get the fare" : "Get the fare again";
  }
});

$("notRight").addEventListener("click", () => {
  inputs.pickupAddress.focus();
  inputs.pickupAddress.select();
});

confirmBtn.addEventListener("click", async () => {
  if (!pendingQuote) return;
  if (!validateFields(BOOKING_RULES)) return;
  if (isQuoteStale(pendingQuote, {
    pickupAddress: inputs.pickupAddress.value,
    dropoffAddress: inputs.dropoffAddress.value,
    quantityKg: inputs.quantityKg.value,
  })) {
    resetQuote({ stale: true });
    return;
  }
  if (getIsOffline()) {
    showMessage("No connection. Check your signal and try again. Your details are still here.");
    return;
  }
  const label = confirmBtn.textContent;
  setBusy(confirmBtn, true, "Booking…");
  let result;
  try {
    result = await createDelivery({
      requester_id: profile.id,
      pickup_address: pendingQuote.pickupAddress,
      pickup_lat: pendingQuote.pickup.lat,
      pickup_lng: pendingQuote.pickup.lng,
      dropoff_address: pendingQuote.dropoffAddress,
      dropoff_lat: pendingQuote.dropoff.lat,
      dropoff_lng: pendingQuote.dropoff.lng,
      goods_description: inputs.goodsDescription.value.trim(),
      quantity_kg: pendingQuote.quantityKg,
      scheduled_pickup_at: inputs.scheduledPickup.value
        ? new Date(inputs.scheduledPickup.value).toISOString()
        : null,
      notes: inputs.notes.value.trim() || null,
      estimated_cost: pendingQuote.cost,
      distance_km: pendingQuote.distanceKm,
    });
  } catch (err) {
    result = { error: err };
  }
  confirmBtn.disabled = false;
  confirmBtn.removeAttribute("aria-busy");
  confirmBtn.textContent = label;

  if (result.error) {
    showBookingError(result.error);
    return;
  }
  form.reset();
  resetQuote();
  highlightId = result.data?.id || null;
  $("bookedBanner").hidden = false;
  goTo("home");
  await loadDeliveries();
});

// ---------- Rendering ----------
let deliveries = [];
let driversById = new Map();
let ratingsMap = new Map();
let highlightId = null;
let historyFilter = "all";
const activeSubscriptions = new Map();

const dismissed = new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));
const dismiss = (id) => {
  dismissed.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
};

const esc = (v) => sanitizeText(v == null ? "" : String(v));
const day = (iso) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
const time = (iso) =>
  new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

function titleLine(d) {
  return `${esc(d.goods_description)} · ${Number(d.quantity_kg).toLocaleString("en-PH")} kg`;
}
function metaLine(d) {
  const bits = [esc(d.delivery_code)];
  if (d.status === "pending") {
    if (d.scheduled_pickup_at) bits.push(`Pickup ${day(d.scheduled_pickup_at)}`);
    bits.push(`Requested ${time(d.created_at)}`);
  } else if (HISTORY_STATUSES.includes(d.status)) {
    bits.push(day(d.updated_at));
  } else if (d.scheduled_pickup_at) {
    bits.push(`Pickup ${day(d.scheduled_pickup_at)}`);
  }
  return bits.join(" · ");
}
function routeBlock(d) {
  return `
    <div class="rq-route">
      <span class="rq-route-dots" aria-hidden="true"></span>
      <div>
        <p><span class="rq-muted">From</span><br />${esc(d.pickup_address)}</p>
        <p><span class="rq-muted">To</span><br />${esc(d.dropoff_address)}</p>
      </div>
    </div>`;
}
function driverBlock(d) {
  const row = driversById.get(d.id);
  if (!row?.driver_name) return "";
  const vehicle = [row.vehicle_type, row.vehicle_plate && `Plate ${row.vehicle_plate}`].filter(Boolean).map(esc).join(" · ");
  return `
    <div class="rq-driver">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
      <div><strong>${esc(row.driver_name)}</strong><br /><span class="rq-muted">${vehicle || "Vehicle not added yet"}</span></div>
    </div>`;
}
function mapBlock(d) {
  if (d.status === "driver_assigned") {
    const name = driversById.get(d.id)?.driver_name?.split(" ")[0] || "the driver";
    return `<p class="rq-note-row">The map appears once ${esc(name)} picks up your goods.</p>`;
  }
  if (d.status !== "picked_up" && d.status !== "in_transit") return "";
  if (!d.current_lat || !d.current_lng) {
    return `<p class="rq-note-row">Location not shared yet. You'll see the truck once the driver starts sharing.</p>`;
  }
  return `
    <div class="rq-map"><img id="map-${esc(d.id)}" src="${staticMapUrl(d.current_lat, d.current_lng)}" alt="Map showing where the truck is now" width="600" height="320" loading="lazy" /></div>
    <p class="rq-muted" id="map-caption-${esc(d.id)}">Truck location · updated ${time(d.updated_at)}</p>`;
}
function fareBlock(d) {
  return `
    <div class="rq-fare">
      <span class="rq-fare-amount">${formatPeso(d.estimated_cost)}</span>
      <span class="rq-muted">Whoever receives the goods pays the driver this in cash at drop-off. Tolls included.</span>
    </div>`;
}
function starPicker(d) {
  return `
    <div class="rq-rate" data-rate-for="${esc(d.id)}">
      <p><strong>How was ${esc(driversById.get(d.id)?.driver_name?.split(" ")[0] || "your driver")}?</strong></p>
      <div class="rq-stars" role="radiogroup" aria-label="Rating">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}" data-star="${n}"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg></button>`).join("")}
      </div>
      <label class="rq-sr" for="comment-${esc(d.id)}">Comment (optional)</label>
      <textarea id="comment-${esc(d.id)}" rows="2" maxlength="500" placeholder="Add a comment (optional)"></textarea>
      <button type="button" class="rq-btn rq-btn--ghost" data-send-rating disabled>Send rating</button>
    </div>`;
}

function activeCard(d) {
  const cancel = d.status === "pending"
    ? `<button type="button" class="rq-btn rq-btn--danger-line" data-cancel-id="${esc(d.id)}">Cancel request</button>`
    : "";
  const late = pickupPassed(d)
    ? `<div class="rq-banner rq-banner--warn" role="status"><p><strong>Pickup date has passed.</strong> No driver has accepted yet. Cancel and book a new date, or keep waiting.</p></div>`
    : "";
  const waitingLine = d.status === "pending"
    ? `<p>Drivers can see your request now. You can cancel until one accepts.</p>`
    : "";
  return `
    <article class="rq-card${d.id === highlightId ? " rq-card--new" : ""}" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted">${metaLine(d)}</p>
      ${routeBlock(d)}
      ${renderStageStepper(d.status)}
      ${driverBlock(d)}
      ${mapBlock(d)}
      ${waitingLine}
      ${late}
      ${fareBlock(d)}
      ${cancel}
    </article>`;
}

function rateCard(d) {
  return `
    <article class="rq-card rq-card--rate" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="delivered">Delivered</span> ${esc(d.delivery_code)} · ${day(d.updated_at)}</p>
      ${starPicker(d)}
      <div class="rq-card-actions">
        <button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">Book again</button>
        <button type="button" class="rq-btn rq-btn--text" data-dismiss-id="${esc(d.id)}">Not now</button>
      </div>
    </article>`;
}

function section(title, sub, cards) {
  if (!cards.length) return "";
  return `
    <section class="rq-section">
      <h2 class="rq-section-title">${title}</h2>
      ${sub ? `<p class="rq-muted">${sub}</p>` : ""}
      ${cards.join("")}
    </section>`;
}

function firstVisit() {
  return `
    <div class="rq-card rq-empty">
      <h2 class="rq-display">No deliveries yet</h2>
      <p>Book your first truck. You see the fare before you confirm: ₱150 base + ₱15 per km + ₱2 per kg, tolls included.</p>
      <ol class="rq-steps">
        <li>A driver accepts your booking</li>
        <li>They pick up your goods</li>
        <li>You follow it to drop-off, where whoever receives the goods pays the driver in cash</li>
      </ol>
      <a class="rq-btn" href="#book">Book a truck</a>
    </div>`;
}

function renderHome() {
  const active = deliveries.filter((d) => !HISTORY_STATUSES.includes(d.status));
  const { onRoad, assigned, waiting } = groupActive(active);
  const toRate = deliveries.filter(
    (d) => d.status === "delivered" && d.driver_id && !ratingsMap.get(d.id) && !dismissed.has(d.id),
  );
  $("homeSummary").textContent = homeSummary({
    onRoad: onRoad.length,
    assigned: assigned.length,
    waiting: waiting.length,
    toRate: toRate.length,
  });
  $("homeLists").innerHTML = deliveries.length
    ? section("On the road", "", onRoad.map(activeCard)) +
      section("Driver assigned", "Goods not picked up yet", assigned.map(activeCard)) +
      section("Waiting for a driver", "", waiting.map(activeCard)) +
      section("Rate your driver", "", toRate.map(rateCard)) ||
      `<div class="rq-card rq-empty"><p><strong>Nothing in progress.</strong></p><p class="rq-muted">Your past deliveries are in History.</p><a class="rq-btn" href="#book">Book a truck</a></div>`
    : firstVisit();
}

function historyCard(d) {
  const rated = ratingsMap.get(d.id);
  const driver = driversById.get(d.id)?.driver_name?.split(" ")[0];
  const rateBtn =
    d.status === "delivered" && d.driver_id && !rated
      ? `<button type="button" class="rq-btn rq-btn--ghost" data-open-rate="${esc(d.id)}">Rate ${esc(driver || "driver")}</button>`
      : "";
  return `
    <article class="rq-card" data-delivery-id="${esc(d.id)}" tabindex="-1">
      <h3 class="rq-card-title">${titleLine(d)}</h3>
      <p class="rq-muted"><span class="status-pill" data-status="${esc(d.status)}">${statusLabel(d.status)}</span> ${metaLine(d)}</p>
      <p>${esc(d.pickup_address)} → ${esc(d.dropoff_address)}</p>
      ${d.status === "delivered" ? `<div class="rq-fare"><span class="rq-fare-amount">${formatPeso(d.estimated_cost)}</span>${rated ? `<span class="rq-muted">You rated ${esc(driver || "the driver")} ${rated.rating} of 5</span>` : ""}</div>` : ""}
      <div class="rq-rate-slot"></div>
      <div class="rq-card-actions">
        ${rateBtn}
        <button type="button" class="rq-btn rq-btn--ghost" data-rebook-id="${esc(d.id)}">Book again</button>
      </div>
    </article>`;
}

function renderHistory() {
  const history = deliveries.filter((d) => HISTORY_STATUSES.includes(d.status));
  const counts = {
    all: history.length,
    delivered: history.filter((d) => d.status === "delivered").length,
    cancelled: history.filter((d) => d.status === "cancelled").length,
  };
  document.querySelectorAll("[data-filter]").forEach((b) => {
    const f = b.dataset.filter;
    b.textContent = `${f[0].toUpperCase()}${f.slice(1)} (${counts[f]})`;
    b.setAttribute("aria-pressed", String(f === historyFilter));
  });
  const shown = historyFilter === "all" ? history : history.filter((d) => d.status === historyFilter);
  $("historyList").innerHTML = shown.length
    ? shown.map(historyCard).join("")
    : history.length
      ? `<div class="rq-card rq-empty"><p><strong>No ${historyFilter} deliveries</strong></p><button type="button" class="rq-btn rq-btn--ghost" data-filter-reset>Show all</button></div>`
      : `<div class="rq-card rq-empty"><p><strong>No past deliveries yet</strong></p><p class="rq-muted">Delivered and cancelled bookings show up here.</p></div>`;
}

function renderRecentRoute() {
  const last = deliveries[0];
  const btn = $("recentRoute");
  if (!last) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.dataset.rebookId = last.id;
  $("recentRouteText").textContent = `${last.pickup_address.split(",")[0]} → ${last.dropoff_address.split(",")[0]} · ${last.goods_description}`;
}

function renderAll() {
  renderHome();
  renderHistory();
  renderRecentRoute();
  renderUnread();
}

function skeletons() {
  return Array.from({ length: 2 }, () => `
    <div class="skeleton skeleton--card">
      <div class="skeleton__line skeleton__line--title"></div>
      <div class="skeleton__line skeleton__line--text"></div>
      <div class="skeleton__line skeleton__line--text" style="width:60%"></div>
    </div>`).join("");
}

async function loadDeliveries() {
  if (!deliveries.length) $("homeLists").innerHTML = skeletons();
  const { data, error } = await getMyDeliveries(profile.id);
  if (error) {
    $("homeLists").innerHTML = `
      <div class="rq-card rq-empty">
        <p><strong>We couldn't load your deliveries.</strong></p>
        <p class="rq-muted">Check your signal, then try again.</p>
        <button type="button" class="rq-btn rq-btn--ghost" data-reload>Try again</button>
      </div>`;
    return;
  }
  deliveries = data || [];
  const [{ data: drivers }, ratings] = await Promise.all([
    getMyDeliveryDrivers(),
    getMyRatingsForDeliveries(
      deliveries.filter((d) => d.status === "delivered").map((d) => d.id),
      profile.id,
    ),
  ]);
  driversById = new Map((drivers || []).map((r) => [r.delivery_id, r]));
  ratingsMap = ratings;
  renderAll();
  subscribeTracking();
  if (highlightId) {
    document.querySelector(`[data-delivery-id="${CSS.escape(highlightId)}"]`)?.focus();
    highlightId = null;
  }
}

function subscribeTracking() {
  activeSubscriptions.forEach((channel) => channel.unsubscribe());
  activeSubscriptions.clear();
  deliveries
    .filter((d) => d.status === "picked_up" || d.status === "in_transit")
    .forEach((d) => {
      const channel = subscribeToDeliveryUpdates(d.id, (updated) => {
        const img = document.getElementById(`map-${d.id}`);
        if (img && updated.current_lat && updated.current_lng) {
          img.src = staticMapUrl(updated.current_lat, updated.current_lng);
        }
        const caption = document.getElementById(`map-caption-${d.id}`);
        if (caption) caption.textContent = `Truck location · updated ${time(updated.updated_at || new Date())}`;
        if (updated.status && updated.status !== d.status) loadDeliveries();
      });
      activeSubscriptions.set(d.id, channel);
    });
}

// ---------- Card actions (one listener for every list) ----------
let cancelTarget = null;
document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;

  if (t.matches("[data-reload]")) return loadDeliveries();

  if (t.dataset.cancelId) {
    cancelTarget = deliveries.find((d) => d.id === t.dataset.cancelId);
    if (!cancelTarget) return;
    $("cancelWhat").textContent = `${cancelTarget.delivery_code} · ${cancelTarget.goods_description}, ${cancelTarget.pickup_address.split(",")[0]} → ${cancelTarget.dropoff_address.split(",")[0]}. No driver has accepted yet.`;
    openSheet($("cancelSheet"));
    return;
  }

  if (t.dataset.rebookId) {
    const d = deliveries.find((x) => x.id === t.dataset.rebookId);
    if (!d) return;
    for (const [id, value] of Object.entries(rebookValues(d))) {
      inputs[id].value = value;
      inputs[id].dispatchEvent(new Event("input", { bubbles: true }));
    }
    inputs.scheduledPickup.value = "";
    resetQuote();
    goTo("book");
    inputs.scheduledPickup.focus({ preventScroll: true });
    return;
  }

  if (t.dataset.dismissId) {
    dismiss(t.dataset.dismissId);
    renderHome();
    return;
  }

  if (t.dataset.openRate) {
    const card = t.closest("[data-delivery-id]");
    const slot = card.querySelector(".rq-rate-slot");
    const d = deliveries.find((x) => x.id === t.dataset.openRate);
    slot.innerHTML = starPicker(d);
    t.hidden = true;
    slot.querySelector("[data-star]").focus();
    return;
  }

  if (t.dataset.star) {
    const box = t.closest("[data-rate-for]");
    const value = Number(t.dataset.star);
    box.dataset.value = value;
    box.querySelectorAll("[data-star]").forEach((s) => {
      const n = Number(s.dataset.star);
      s.setAttribute("aria-checked", String(n === value));
      s.classList.toggle("is-on", n <= value);
    });
    box.querySelector("[data-send-rating]").disabled = false;
    return;
  }

  if (t.matches("[data-send-rating]")) {
    const box = t.closest("[data-rate-for]");
    const id = box.dataset.rateFor;
    const d = deliveries.find((x) => x.id === id);
    t.disabled = true;
    t.textContent = "Sending…";
    const { error } = await submitRating(id, profile.id, d.driver_id, Number(box.dataset.value), box.querySelector("textarea").value.trim());
    if (error) {
      t.disabled = false;
      t.textContent = "Send rating";
      toastError("Your rating didn't save. Check your signal and send it again.");
      return;
    }
    toastSuccess("Thanks. Your rating was saved.");
    loadDeliveries();
    return;
  }

  if (t.dataset.filter) {
    historyFilter = t.dataset.filter;
    renderHistory();
    return;
  }
  if (t.matches("[data-filter-reset]")) {
    historyFilter = "all";
    renderHistory();
  }
});

$("cancelConfirm").addEventListener("click", async () => {
  const d = cancelTarget;
  const btn = $("cancelConfirm");
  if (!d) return;
  if (getIsOffline()) {
    toastError("No connection. Check your signal and try again.");
    return;
  }
  setBusy(btn, true, "Cancelling…");
  const { error } = await cancelMyDelivery(d.id, profile.id);
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  btn.textContent = "Cancel request";
  $("cancelSheet").close();
  if (error) {
    // No row matched: a driver accepted it in the meantime.
    if (error.code === "PGRST116" || /no rows|not found|multiple \(or no\)/i.test(error.message || "")) {
      await loadDeliveries();
      const card = document.querySelector(`[data-delivery-id="${CSS.escape(d.id)}"]`);
      card?.insertAdjacentHTML(
        "afterbegin",
        `<div class="rq-banner rq-banner--warn" role="alert"><p><strong>A driver accepted first.</strong> Your cancel didn't go through. Only Sakada can cancel now. <a href="${contactUrl(CONTACT, d.delivery_code)}">Message Sakada about ${esc(d.delivery_code)}</a></p></div>`,
      );
      card?.focus();
    } else {
      toastError("We couldn't cancel this. Check your signal and try again.");
    }
    return;
  }
  toastSuccess("Request cancelled");
  loadDeliveries();
});

// ---------- Notifications ----------
let notifications = [];
function renderUnread() {
  const unread = notifications.filter((n) => !n.is_read).length;
  document.querySelectorAll("[data-unread]").forEach((b) => {
    b.hidden = unread === 0;
    b.textContent = unread > 9 ? "9+" : String(unread);
  });
  document.querySelectorAll("[data-open-notifs]").forEach((b) =>
    b.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications"),
  );
  document.querySelectorAll("[data-unread-text]").forEach((el) => (el.textContent = unread ? `${unread} unread` : ""));
}
function renderNotifs() {
  const list = $("notifList");
  list.innerHTML = notifications.length
    ? notifications
        .map(
          (n) => `
        <li><button type="button" class="rq-notif${n.is_read ? "" : " is-unread"}" data-notif-id="${esc(n.id)}" data-delivery="${esc(n.delivery_id || "")}">
          <span class="rq-notif-dot" aria-hidden="true"></span>
          <span><span class="rq-sr">${n.is_read ? "" : "Unread. "}</span>${esc(n.message)}<br /><span class="rq-muted">${timeAgo(n.created_at)}</span></span>
        </button></li>`,
        )
        .join("")
    : `<li class="rq-empty"><p><strong>No notifications yet</strong></p><p class="rq-muted">Updates show here when a driver accepts, picks up and delivers.</p></li>`;
  renderUnread();
}
async function loadNotifications() {
  const { data, error } = await getMyNotifications(profile.id);
  if (!error && data) {
    notifications = data;
    renderNotifs();
  }
}
document.querySelectorAll("[data-open-notifs]").forEach((b) =>
  b.addEventListener("click", () => openSheet($("notifSheet"))),
);
$("notifList").addEventListener("click", async (e) => {
  const item = e.target.closest("[data-notif-id]");
  if (!item) return;
  if (item.classList.contains("is-unread")) {
    markNotificationRead(item.dataset.notifId).then(loadNotifications);
  }
  $("notifSheet").close();
  const d = deliveries.find((x) => x.id === item.dataset.delivery);
  if (!d) return;
  goTo(HISTORY_STATUSES.includes(d.status) ? "history" : "home");
  requestAnimationFrame(() => {
    const card = document.querySelector(`[data-delivery-id="${CSS.escape(d.id)}"]`);
    card?.scrollIntoView({ block: "center" });
    card?.focus({ preventScroll: true });
  });
});

loadDeliveries();
loadNotifications();
subscribeToNotifications(profile.id, () => {
  loadNotifications();
  loadDeliveries();
});
```

## 6. Replace `sakada-web/js/dashboard-shared.js` with:
```js
import { sanitizeText } from "./sanitize.js";
import { toastError } from "./toast.js";
import {
  getMyNotifications,
  markNotificationRead,
  subscribeToNotifications,
} from "./notifications.js";

export const HISTORY_STATUSES = ["delivered", "cancelled"];

export function statusLabel(status) {
  return (
    {
      pending: "Pending",
      driver_assigned: "Driver Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      delivered: "Delivered",
      cancelled: "Cancelled",
    }[status] || status
  );
}

export function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Keep delivery codes like "SK-00142" on one line. Runs on text that
// sanitizeText already escaped, and only matches letters, digits and "-",
// so it can't inject markup.
const keepCodesTogether = (safeText) =>
  safeText.replace(/\bSK-\d+\b/g, (code) => `<span class="notif-code">${code}</span>`);

export function renderNotifications(list, notifBadge, notifPanel, onRead) {
  const unreadCount = list.filter((n) => !n.is_read).length;
  notifBadge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  notifBadge.classList.toggle("visible", unreadCount > 0);

  const head = `<div class="notif-head">Notifications</div>`;

  if (list.length === 0) {
    notifPanel.innerHTML = `${head}<div class="notif-empty"><strong>No notifications yet.</strong><span>Updates on your deliveries show up here.</span></div>`;
    return;
  }

  notifPanel.innerHTML = head + list
    .map(
      (n) => `
    <div class="notif-item ${n.is_read ? "" : "unread"}" data-notif-id="${sanitizeText(n.id)}" data-read="${n.is_read}">
      ${keepCodesTogether(sanitizeText(n.message))}
      <span class="notif-time">${timeAgo(n.created_at)}</span>
    </div>
  `,
    )
    .join("");

  notifPanel.querySelectorAll("[data-notif-id]").forEach((item) => {
    item.addEventListener("click", async () => {
      if (item.dataset.read === "true") return;
      await markNotificationRead(item.dataset.notifId);
      if (onRead) onRead();
    });
  });
}

export function renderRatingBlock(d, existingRating, ratedLabel, viewerId) {
  if (d.status !== "delivered") return "";

  const otherUserId =
    d.driver_id === viewerId ? d.requester_id : d.driver_id;

  if (existingRating) {
    return `
      <div class="rating-box">
        <div class="rating-given">
          ${ratedLabel}: <span class="stars-display">${"★".repeat(existingRating.rating)}${"☆".repeat(5 - existingRating.rating)}</span>
          ${existingRating.comment ? `<br>"${sanitizeText(existingRating.comment)}"` : ""}
        </div>
      </div>
    `;
  }

  return `
    <div class="rating-box">
      <div class="star-picker" data-delivery-id="${sanitizeText(d.id)}">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}">★</button>`).join("")}
      </div>
      <textarea class="rating-comment" data-comment-for="${sanitizeText(d.id)}" rows="2" maxlength="500" placeholder="How was this delivery? (optional)"></textarea>
      <button class="btn-small" data-submit-rating="${sanitizeText(d.id)}" data-other-user-id="${sanitizeText(otherUserId)}" disabled>Submit Rating</button>
    </div>
  `;
}

export function wireRatingControls(container, profile, submitRatingFn, onSuccess) {
  container.querySelectorAll(".star-picker").forEach((picker) => {
    const stars = picker.querySelectorAll("button");
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        const value = parseInt(star.dataset.star, 10);
        picker.dataset.selected = value;
        stars.forEach((s) =>
          s.classList.toggle(
            "selected",
            parseInt(s.dataset.star, 10) <= value,
          ),
        );
        const submitBtn = container.querySelector(
          `[data-submit-rating="${picker.dataset.deliveryId}"]`,
        );
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  });

  container.querySelectorAll("[data-submit-rating]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const deliveryId = btn.dataset.submitRating;
      const otherUserId = btn.dataset.otherUserId;
      const picker = container.querySelector(
        `.star-picker[data-delivery-id="${deliveryId}"]`,
      );
      const comment = container
        .querySelector(`[data-comment-for="${deliveryId}"]`)
        .value.trim();
      const rating = parseInt(picker?.dataset.selected || "0", 10);
      if (!rating) return;

      btn.disabled = true;
      btn.textContent = "Submitting...";

      const { error } = await submitRatingFn(
        deliveryId,
        profile.id,
        otherUserId,
        rating,
        comment,
      );

      if (error) {
        btn.disabled = false;
        btn.textContent = "Submit Rating";
        toastError("Couldn't save your rating: " + error.message);
        return;
      }

      onSuccess();
    });
  });
}

export function setupNotifications(profile, notifBell, notifPanel, notifBadge) {
  async function loadNotifications() {
    const { data, error } = await getMyNotifications(profile.id);
    if (!error && data) renderNotifications(data, notifBadge, notifPanel, loadNotifications);
  }

  const setOpen = (open) => {
    notifPanel.classList.toggle("open", open);
    notifBell.setAttribute("aria-expanded", String(open));
  };

  notifBell.addEventListener("click", () => {
    setOpen(!notifPanel.classList.contains("open"));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".notif-wrap")) setOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && notifPanel.classList.contains("open")) {
      setOpen(false);
      notifBell.focus();
    }
  });

  loadNotifications();
  subscribeToNotifications(profile.id, () => loadNotifications());

  return loadNotifications;
}

/**
 * True when the form no longer matches the quote the user saw, so the
 * quote must not be booked. Addresses compare trimmed; load compares
 * as a number.
 */
export function isQuoteStale(quote, form) {
  if (!quote) return true;
  return (
    quote.pickupAddress !== form.pickupAddress.trim() ||
    quote.dropoffAddress !== form.dropoffAddress.trim() ||
    quote.quantityKg !== parseFloat(form.quantityKg)
  );
}

/**
 * "Driver: Juan Dela Cruz · Isuzu Elf · NBC 1234" for a requester's delivery
 * card. `row` comes from getMyDeliveryDrivers(); returns "" when no driver
 * is assigned yet. Everything is sanitized.
 */
export function renderDriverLine(row) {
  if (!row || !row.driver_name) return "";
  const parts = [sanitizeText(row.vehicle_type), sanitizeText(row.vehicle_plate)].filter(Boolean);
  const vehicle = parts.length ? ` · ${parts.join(" · ")}` : " · Vehicle not added yet";
  return `<div class="delivery-driver">Driver: <strong>${sanitizeText(row.driver_name)}</strong>${vehicle}</div>`;
}

/** Form values for "Book again": same route, goods and weight; new date. */
export function rebookValues(d) {
  return {
    pickupAddress: d.pickup_address || "",
    dropoffAddress: d.dropoff_address || "",
    goodsDescription: d.goods_description || "",
    quantityKg: d.quantity_kg != null ? String(d.quantity_kg) : "",
  };
}

// ---------- Requester dashboard (v4 design) ----------

/** The five delivery stages in order. Cancelled sits outside the line. */
export const STAGES = ["pending", "driver_assigned", "picked_up", "in_transit", "delivered"];
const STAGE_LABELS = ["Waiting", "Driver assigned", "Picked up", "In transit", "Delivered"];

/**
 * The 5-step progress line. Done steps are dim amber, the current step is a
 * taller solid bar, upcoming steps are outlines, so it doesn't rely on colour
 * alone. Screen readers get one label ("Step 4 of 5, In transit"); the bars
 * are hidden from them.
 */
export function renderStageStepper(status) {
  const current = STAGES.indexOf(status);
  if (current < 0) return "";
  const bars = STAGES.map((s, i) => {
    const state = i < current ? "done" : i === current ? "current" : "next";
    return `<span class="rq-step rq-step--${state}${status === "pending" && i === 0 ? " rq-step--waiting" : ""}"></span>`;
  }).join("");
  const labels = STAGE_LABELS.map(
    (l, i) => `<span class="rq-step-label${i === current ? " is-current" : ""}">${l}</span>`,
  ).join("");
  const next = STAGE_LABELS[current + 1];
  const now = status === "pending" ? "Waiting for a driver" : STAGE_LABELS[current];
  return `
    <div class="rq-stepper" role="img" aria-label="Step ${current + 1} of 5, ${now}">
      <div class="rq-stepper-bars" aria-hidden="true">${bars}</div>
      <div class="rq-stepper-labels" aria-hidden="true">${labels}</div>
      <p class="rq-stepper-line" aria-hidden="true"><strong>${now}</strong>${next ? ` · Next: ${next}` : ""}</p>
    </div>`;
}

/** "Ana Reyes" -> "AR"; one name -> one letter; empty -> "?". */
export function initialsFor(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Splits active deliveries into the three Home sections. */
export function groupActive(deliveries) {
  const list = deliveries || [];
  return {
    onRoad: list.filter((d) => d.status === "picked_up" || d.status === "in_transit"),
    assigned: list.filter((d) => d.status === "driver_assigned"),
    waiting: list.filter((d) => d.status === "pending"),
  };
}

/** "1 on the road · 1 driver assigned · 1 waiting · 1 to rate" (zeros left out). */
export function homeSummary({ onRoad = 0, assigned = 0, waiting = 0, toRate = 0 }) {
  return [
    onRoad && `${onRoad} on the road`,
    assigned && `${assigned} driver assigned`,
    waiting && `${waiting} waiting`,
    toRate && `${toRate} to rate`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 3550 -> "₱3,550". */
export function formatPeso(amount) {
  return `₱${Math.round(Number(amount) || 0).toLocaleString("en-PH")}`;
}

/** The fare formula with this booking's numbers, as shown on the quote. */
export function fareBreakdown(distanceKm, quantityKg) {
  return `₱150 base + ${Number(distanceKm).toFixed(1)} km × ₱15 + ${quantityKg} kg × ₱2, rounded. Tolls included.`;
}

/** True when a delivery is still waiting but its pickup date is before today. */
export function pickupPassed(d, today = new Date()) {
  if (!d || d.status !== "pending" || !d.scheduled_pickup_at) return false;
  const pickup = new Date(d.scheduled_pickup_at);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return day(pickup) < day(today);
}

/**
 * Plain words for anything that can go wrong while getting a fare or
 * booking. `field` says which input to put it on ("pickup" / "dropoff"),
 * or null for the message above the button. Never shows error.message.
 */
export function bookingErrorCopy(error) {
  const message = String(error?.message || "");
  if (error?.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed|reach the map/i.test(message)) {
    return { kind: "offline", field: null, message: "No connection. Check your signal and try again. Your details are still here." };
  }
  const notFound = message.match(/Couldn't find "(.*)"/);
  if (notFound) {
    return { kind: "not-found", field: error?.which || "pickup", message: "We couldn't find this address. Add the town and province." };
  }
  if (/no driving route|calculate a route/i.test(message)) {
    return { kind: "no-route", field: "dropoff", message: "No road route from your pickup. Check both addresses." };
  }
  if (/too many requests/i.test(message) || error?.status === 429) {
    return { kind: "rate", field: null, message: "Too many bookings in a minute. Wait a minute, then confirm again. Your details are still here." };
  }
  if (/route distance does not match/i.test(message)) {
    return { kind: "mismatch", field: null, message: "We couldn't confirm the route. Get the fare again, then confirm." };
  }
  return { kind: "unknown", field: null, message: "We couldn't book this. Your details are still here. Try again." };
}

/** Link to the contact form with the booking code filled in. */
export function contactUrl(base, code) {
  return code ? `${base}?code=${encodeURIComponent(code)}` : base;
}
```

## 7. `sakada-web/js/contact.js`: add at the very end of the file
```js

// Opened from a dashboard card ("Send Sakada a message" with ?code=SK-00003):
// pick the booking topic and fill in the code.
const presetCode = new URLSearchParams(window.location.search).get("code");
if (presetCode && /^SK-\d{1,8}$/i.test(presetCode)) {
  purpose.value = "booking";
  codeInput.value = presetCode.toUpperCase();
  syncTopic();
}
```

## 8. Replace `sakada-web/tests/dashboard-shared.test.js` with:
```js
import { describe, it, expect, vi } from "vitest";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

// Mock the notifications module (it imports from https URLs)
vi.mock("../js/notifications.js", () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

// Inject into global so sanitize.js can use it (same as sanitize.test.js)
globalThis.DOMPurify = DOMPurify(new JSDOM("").window);

import {
  statusLabel,
  timeAgo,
  HISTORY_STATUSES,
  renderRatingBlock,
  isQuoteStale,
  renderDriverLine,
  rebookValues,
} from "../js/dashboard-shared.js";

describe("HISTORY_STATUSES", () => {
  it("contains delivered and cancelled", () => {
    expect(HISTORY_STATUSES).toContain("delivered");
    expect(HISTORY_STATUSES).toContain("cancelled");
  });

  it("does not contain active statuses", () => {
    expect(HISTORY_STATUSES).not.toContain("pending");
    expect(HISTORY_STATUSES).not.toContain("driver_assigned");
    expect(HISTORY_STATUSES).not.toContain("picked_up");
    expect(HISTORY_STATUSES).not.toContain("in_transit");
  });
});

describe("statusLabel", () => {
  it("returns human-readable labels for all known statuses", () => {
    expect(statusLabel("pending")).toBe("Pending");
    expect(statusLabel("driver_assigned")).toBe("Driver Assigned");
    expect(statusLabel("picked_up")).toBe("Picked Up");
    expect(statusLabel("in_transit")).toBe("In Transit");
    expect(statusLabel("delivered")).toBe("Delivered");
    expect(statusLabel("cancelled")).toBe("Cancelled");
  });

  it("returns the raw status for unknown values", () => {
    expect(statusLabel("unknown_status")).toBe("unknown_status");
    expect(statusLabel("")).toBe("");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const d = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("2d ago");
  });

  it("handles exactly 1 minute", () => {
    const d = new Date(Date.now() - 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1m ago");
  });

  it("handles exactly 1 hour", () => {
    const d = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1h ago");
  });

  it("handles exactly 1 day", () => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1d ago");
  });
});

describe("renderRatingBlock", () => {
  const delivered = {
    id: "delivery-1",
    status: "delivered",
    driver_id: "driver-123",
    requester_id: "requester-456",
  };

  it("rates the requester when the viewer is the driver", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated the requester",
      "driver-123",
    );
    expect(html).toContain('data-other-user-id="requester-456"');
  });

  it("rates the driver when the viewer is the requester", () => {
    const html = renderRatingBlock(
      delivered,
      null,
      "You rated this delivery",
      "requester-456",
    );
    expect(html).toContain('data-other-user-id="driver-123"');
  });
});

describe("isQuoteStale", () => {
  const quote = {
    pickupAddress: "La Trinidad, Benguet",
    dropoffAddress: "Baguio City",
    quantityKg: 400,
  };

  it("returns false when the form matches the quote (addresses trimmed)", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "  La Trinidad, Benguet  ",
        dropoffAddress: " Baguio City ",
        quantityKg: "400",
      }),
    ).toBe(false);
  });

  it("returns true when the pickup changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "Bugallon, Pangasinan",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the drop-off changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Dagupan City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });

  it("returns true when the load changed", () => {
    expect(
      isQuoteStale(quote, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "500",
      }),
    ).toBe(true);
  });

  it("returns true when there is no quote", () => {
    expect(
      isQuoteStale(null, {
        pickupAddress: "La Trinidad, Benguet",
        dropoffAddress: "Baguio City",
        quantityKg: "400",
      }),
    ).toBe(true);
  });
});

describe("renderDriverLine", () => {
  it("returns an empty string without a driver or a name", () => {
    expect(renderDriverLine(undefined)).toBe("");
    expect(renderDriverLine({ driver_name: null })).toBe("");
  });

  it("shows name, vehicle type and plate", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: "Isuzu Elf",
      vehicle_plate: "NBC 1234",
    });
    expect(html).toContain("Juan Dela Cruz");
    expect(html).toContain("Isuzu Elf · NBC 1234");
    expect(html).toContain('class="delivery-driver"');
  });

  it("says the vehicle isn't added yet when both fields are missing", () => {
    const html = renderDriverLine({
      driver_name: "Juan Dela Cruz",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).toContain("Vehicle not added yet");
  });

  it("sanitizes the driver name", () => {
    const html = renderDriverLine({
      driver_name: "<img src=x onerror=alert(1)>Ana",
      vehicle_type: null,
      vehicle_plate: null,
    });
    expect(html).not.toContain("<img");
  });
});

describe("rebookValues", () => {
  it("copies route, goods and weight, stringifying the weight", () => {
    expect(
      rebookValues({
        pickup_address: "A",
        dropoff_address: "B",
        goods_description: "Eggplant",
        quantity_kg: 500,
      }),
    ).toEqual({
      pickupAddress: "A",
      dropoffAddress: "B",
      goodsDescription: "Eggplant",
      quantityKg: "500",
    });
  });

  it("turns missing fields into empty strings", () => {
    expect(rebookValues({})).toEqual({
      pickupAddress: "",
      dropoffAddress: "",
      goodsDescription: "",
      quantityKg: "",
    });
  });
});

import {
  renderStageStepper,
  initialsFor,
  groupActive,
  homeSummary,
  formatPeso,
  fareBreakdown,
  pickupPassed,
  bookingErrorCopy,
  contactUrl,
} from "../js/dashboard-shared.js";

describe("renderStageStepper", () => {
  it("labels the current step for screen readers", () => {
    const html = renderStageStepper("in_transit");
    expect(html).toContain('aria-label="Step 4 of 5, In transit"');
    expect(html.match(/rq-step--done/g)).toHaveLength(3);
    expect(html.match(/rq-step--current/g)).toHaveLength(1);
    expect(html).toContain("Next: Delivered");
  });
  it("shows Pending as waiting, not as progress", () => {
    const html = renderStageStepper("pending");
    expect(html).toContain("Step 1 of 5, Waiting for a driver");
    expect(html).toContain("rq-step--waiting");
  });
  it("draws nothing for cancelled", () => {
    expect(renderStageStepper("cancelled")).toBe("");
  });
});

describe("initialsFor", () => {
  it("uses first and last name", () => expect(initialsFor("Ana Maria Reyes")).toBe("AR"));
  it("handles one name and blanks", () => {
    expect(initialsFor("carlo")).toBe("C");
    expect(initialsFor("  ")).toBe("?");
  });
});

describe("groupActive and homeSummary", () => {
  const list = [
    { status: "pending" },
    { status: "driver_assigned" },
    { status: "picked_up" },
    { status: "in_transit" },
  ];
  it("splits active deliveries into Home sections", () => {
    const g = groupActive(list);
    expect(g.onRoad).toHaveLength(2);
    expect(g.assigned).toHaveLength(1);
    expect(g.waiting).toHaveLength(1);
  });
  it("leaves zeros out of the summary", () => {
    expect(homeSummary({ onRoad: 1, waiting: 2 })).toBe("1 on the road · 2 waiting");
    expect(homeSummary({})).toBe("");
  });
});

describe("formatPeso and fareBreakdown", () => {
  it("formats pesos", () => expect(formatPeso(3550)).toBe("₱3,550"));
  it("shows the real distance", () =>
    expect(fareBreakdown(118.43, 800)).toBe("₱150 base + 118.4 km × ₱15 + 800 kg × ₱2, rounded. Tolls included."));
});

describe("pickupPassed", () => {
  const today = new Date(2026, 9, 17);
  it("is true for a waiting delivery whose date is before today", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-16T00:00:00" }, today)).toBe(true);
  });
  it("is false for today, for other statuses, and with no date", () => {
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: "2026-10-17T08:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "driver_assigned", scheduled_pickup_at: "2026-10-10T00:00:00" }, today)).toBe(false);
    expect(pickupPassed({ status: "pending", scheduled_pickup_at: null }, today)).toBe(false);
  });
});

describe("bookingErrorCopy", () => {
  it("maps each known error to plain words", () => {
    expect(bookingErrorCopy({ message: 'Couldn\'t find "San Roque". Try adding a city or province.', which: "pickup" })).toMatchObject({ kind: "not-found", field: "pickup" });
    expect(bookingErrorCopy({ message: "No driving route found between those two points." })).toMatchObject({ kind: "no-route", field: "dropoff" });
    expect(bookingErrorCopy({ message: "Too many requests. Please wait a minute and try again." }).kind).toBe("rate");
    expect(bookingErrorCopy({ message: "The route distance does not match the pickup and drop-off locations." }).kind).toBe("mismatch");
    expect(bookingErrorCopy(new TypeError("Failed to fetch")).kind).toBe("offline");
  });
  it("never passes the raw message through", () => {
    expect(bookingErrorCopy({ message: "duplicate key value violates unique constraint" }).message).not.toMatch(/duplicate/);
  });
});

describe("contactUrl", () => {
  it("adds the booking code", () =>
    expect(contactUrl("../../pages/contact.html", "SK-00003")).toBe("../../pages/contact.html?code=SK-00003"));
  it("leaves the link alone without a code", () =>
    expect(contactUrl("../../pages/contact.html", "")).toBe("../../pages/contact.html"));
});
```

## 9. Replace `sakada-web/e2e/support/mock-supabase.mjs` with:
```js
// A fake Supabase for e2e tests, so the dashboards can load without a real
// account. It signs a fixture user in (the session supabase-js reads from
// localStorage) and answers auth, PostgREST and RPC calls from in-memory
// tables. Writes (PATCH/POST) change those tables, so a test can click
// Cancel or Accept and see the result. Realtime is silenced.
//
// Supports only the PostgREST bits the app uses: eq., neq., is.null and
// in.(...) filters, plus .single() / .maybeSingle().

const PROJECT_REF = "aeeniueayubeugvooyqj"; // must match js/config.js
const NOW = "2026-10-14T09:00:00.000Z";

export const IDS = {
  farmer: "00000000-0000-4000-8000-00000000f001",
  vendor: "00000000-0000-4000-8000-00000000f002",
  driver: "00000000-0000-4000-8000-00000000d001",
  admin: "00000000-0000-4000-8000-00000000a001",
};

const NAMES = {
  farmer: "Ana Reyes",
  vendor: "Ben Cruz",
  driver: "Carlo Santos",
  admin: "Dina Admin",
};

function delivery(n, status, extra = {}) {
  return {
    id: `00000000-0000-4000-8000-0000000de${String(n).padStart(3, "0")}`,
    delivery_code: `SK-${String(n).padStart(5, "0")}`,
    requester_id: IDS.farmer,
    driver_id: status === "pending" ? null : IDS.driver,
    pickup_address: "Cabanatuan City, Nueva Ecija",
    pickup_lat: 15.4865,
    pickup_lng: 120.9667,
    dropoff_address: "Marikina Public Market, Marikina",
    dropoff_lat: 14.6507,
    dropoff_lng: 121.1029,
    goods_description: "Eggplant, 32 crates",
    quantity_kg: 800,
    scheduled_pickup_at: "2026-10-15T00:00:00.000Z",
    notes: null,
    estimated_cost: 3550,
    distance_km: 120,
    status,
    current_lat: status === "in_transit" || status === "picked_up" ? 15.1 : null,
    current_lng: status === "in_transit" || status === "picked_up" ? 121.0 : null,
    created_at: `2026-10-${String(10 + (n % 5)).padStart(2, "0")}T0${n % 9}:00:00.000Z`,
    updated_at: NOW,
    ...extra,
  };
}

/** Fresh tables for one test. Pass overrides to change any table. */
export function fixtures(overrides = {}) {
  const profiles = Object.entries(IDS).map(([role, id]) => ({
    id,
    role,
    full_name: NAMES[role],
    phone: null,
    avatar_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: NOW,
  }));
  const deliveries = [
    delivery(1, "pending"),
    delivery(2, "driver_assigned"),
    delivery(3, "in_transit"),
    delivery(4, "delivered"),
    delivery(5, "cancelled", { driver_id: null }),
    delivery(6, "pending", { requester_id: IDS.vendor, goods_description: "Tomatoes, 40 crates", quantity_kg: 600, estimated_cost: 2550 }),
  ];
  return {
    profiles,
    deliveries,
    driver_profiles: [{ id: IDS.driver, vehicle_type: "6-wheeler truck", vehicle_plate: "NBC 1234", is_available: true }],
    notifications: [
      {
        id: "00000000-0000-4000-8000-0000000c0001",
        user_id: IDS.farmer,
        delivery_id: deliveries[2].id,
        message: "Your delivery SK-00003 is now In Transit.",
        is_read: false,
        created_at: NOW,
      },
    ],
    ratings: [],
    contact_submissions: [],
    ...overrides,
  };
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    const value = row[key];
    if (raw.startsWith("eq.")) {
      if (String(value) !== raw.slice(3)) return false;
    } else if (raw.startsWith("neq.")) {
      if (String(value) === raw.slice(4)) return false;
    } else if (raw === "is.null") {
      if (value !== null && value !== undefined) return false;
    } else if (raw.startsWith("in.(")) {
      const list = raw.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      if (!list.includes(String(value))) return false;
    }
  }
  return true;
}

function rpcResult(name, db, userId) {
  if (name === "get_my_delivery_drivers") {
    return db.deliveries
      .filter((d) => d.requester_id === userId && d.driver_id)
      .map((d) => ({
        delivery_id: d.id,
        driver_name: NAMES.driver,
        vehicle_type: db.driver_profiles[0]?.vehicle_type ?? null,
        vehicle_plate: db.driver_profiles[0]?.vehicle_plate ?? null,
      }));
  }
  return null; // update_my_last_login and anything else: no content
}

/**
 * Sign `role` in and fake Supabase for this page. Returns the live tables
 * (`db`) so a test can inspect them after a write.
 */
export async function mockSupabase(page, role, overrides = {}) {
  const db = fixtures(overrides);
  const userId = IDS[role];
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: `${role}@example.com`,
    app_metadata: { provider: "email" },
    user_metadata: { full_name: NAMES[role], role },
    identities: [],
    created_at: "2026-09-01T00:00:00.000Z",
  };
  const session = {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  await page.addInitScript(
    ([key, value, r]) => {
      localStorage.setItem(key, value);
      localStorage.setItem("sakada.role", r);
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session), role],
  );

  await page.routeWebSocket(/\/realtime\/v1\//, () => {}); // never connects, never errors
  // Mapbox: geocoding echoes the query as a Philippine place, directions
  // returns 118.4 km, and static map images are a 1x1 PNG.
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/geocoding/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop().replace(/\.json$/, ""));
      if (/nowhere/i.test(query)) return route.fulfill({ json: { features: [] } });
      return route.fulfill({ json: { features: [{ center: [121.0, 14.6], place_name: `${query}, Philippines` }] } });
    }
    if (url.pathname.startsWith("/directions/")) {
      return route.fulfill({ json: { routes: [{ distance: 118400 }] } });
    }
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });
  await page.route(`https://${PROJECT_REF}.supabase.co/auth/v1/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ json: session });
  });
  await page.route(`https://${PROJECT_REF}.supabase.co/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const params = [...url.searchParams.entries()];
    const wantsOne = (req.headers()["accept"] || "").includes("vnd.pgrst.object");

    if (path.startsWith("rpc/")) {
      const result = rpcResult(path.slice(4), db, userId);
      return result === null ? route.fulfill({ status: 204, body: "" }) : route.fulfill({ json: result });
    }

    const table = db[path];
    if (!table) return route.fulfill({ status: 404, json: { message: `no table ${path}` } });

    let rows;
    if (req.method() === "GET" || req.method() === "HEAD") {
      rows = table.filter((r) => matches(r, params));
    } else if (req.method() === "PATCH") {
      const patch = req.postDataJSON();
      rows = table.filter((r) => matches(r, params));
      rows.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
    } else if (req.method() === "POST") {
      const body = req.postDataJSON();
      rows = (Array.isArray(body) ? body : [body]).map((r, i) => ({
        id: `00000000-0000-4000-8000-0000000e${String(table.length + i).padStart(4, "0")}`,
        created_at: new Date().toISOString(),
        // the database defaults a new delivery gets
        ...(path === "deliveries"
          ? { delivery_code: `SK-${String(table.length + i + 1).padStart(5, "0")}`, status: "pending", driver_id: null, updated_at: NOW }
          : {}),
        ...r,
      }));
      table.push(...rows);
    } else {
      rows = [];
    }

    const headers = { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
    if (wantsOne) {
      if (rows.length !== 1) {
        return route.fulfill({ status: 406, headers, json: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
      }
      return route.fulfill({ headers, json: rows[0] });
    }
    return route.fulfill({ headers, json: rows });
  });

  return db;
}
```

## 10. Replace `sakada-web/e2e/dashboards.spec.mjs` with:
```js
// Dashboards load with a fake signed-in user (e2e/support/mock-supabase.mjs).
// These are the safety net for the dashboard redesign: each page loads with
// no errors and shows its real data.
import { test, expect } from "@playwright/test";
import { mockSupabase } from "./support/mock-supabase.mjs";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test.describe("dashboards (fake sign-in)", () => {
  test("farmer sees their deliveries grouped by stage", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ana");
    const home = page.locator("#homeLists");
    const section = (name) => home.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(section("On the road")).toContainText("SK-00003");
    await expect(section("Driver assigned")).toContainText("SK-00002");
    await expect(section("Waiting for a driver")).toContainText("SK-00001");
    await expect(section("Rate your driver")).toContainText("SK-00004");
    await expect(home).not.toContainText("SK-00006"); // the vendor's
    await expect(page.getByRole("img", { name: /Step 4 of 5/ })).toBeVisible();
    await page.goto("/dashboard/farmer/index.html#history");
    await expect(page.locator("#historyList")).toContainText("SK-00004");
    await expect(page.locator("#historyList")).toContainText("SK-00005");
    expect(errors).toEqual([]);
  });

  test("farmer can cancel a delivery that is still waiting", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const card = page.locator("#homeLists [data-delivery-id]", { hasText: "SK-00001" });
    await card.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.locator("#cancelSheet")).toBeVisible();
    await page.locator("#cancelConfirm").click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
  });

  test("vendor sees only their own deliveries", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "vendor");
    await page.goto("/dashboard/vendor/index.html");
    await expect(page.locator("#homeTitle")).toHaveText("Hello, Ben");
    await expect(page.locator("#homeLists")).toContainText("SK-00006");
    await expect(page.locator("#homeLists")).not.toContainText("SK-00001");
    expect(errors).toEqual([]);
  });

  test("farmer books a truck: fare first, then confirm", async ({ page }) => {
    const errors = trackErrors(page);
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "Cabanatuan City, Nueva Ecija");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#quoteAmount")).toHaveText("₱3,526"); // 150 + 118.4 km × 15 + 800 kg × 2
    expect(db.deliveries).toHaveLength(6); // nothing booked until confirm
    await page.locator("#confirmBtn").click();
    await expect(page.locator("#bookedBanner")).toBeVisible();
    expect(db.deliveries).toHaveLength(7);
    expect(db.deliveries[6]).toMatchObject({ goods_description: "Eggplant, 32 crates", quantity_kg: 800 });
    await expect(
      page.locator("#homeLists section").filter({ has: page.getByRole("heading", { name: "Waiting for a driver" }) }),
    ).toContainText("SK-00007");
    expect(errors).toEqual([]);
  });

  test("an address Mapbox can't find gets a plain error and no fare", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#book");
    await page.fill("#pickupAddress", "nowhere");
    await page.fill("#dropoffAddress", "Marikina Public Market, Marikina");
    await page.fill("#goodsDescription", "Eggplant, 32 crates");
    await page.fill("#quantityKg", "800");
    await page.fill("#scheduledPickup", "2026-10-16");
    await page.locator("#estimateBtn").click();
    await expect(page.locator("#pickupAddressError")).toHaveText("We couldn't find this address. Add the town and province.");
    await expect(page.locator("#pickupAddress")).toBeFocused();
    await expect(page.locator("#quote")).toBeHidden();
  });

  test("on a phone the tabs switch views and the landing link opens Book", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html#deliveryForm");
    await expect(page.locator("#deliveryForm")).toBeVisible();
    const tabs = page.locator(".rq-tabs");
    await tabs.getByRole("link", { name: "History" }).click();
    await expect(page.locator("#historyList")).toBeVisible();
    await expect(page.locator("#deliveryForm")).toBeHidden();
    await tabs.getByRole("link", { name: "Home" }).click();
    await expect(page.locator("#homeLists")).toBeVisible();
  });

  test("a notification opens its delivery", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await page.locator("[data-open-notifs]").first().click();
    await expect(page.locator("#notifSheet")).toBeVisible();
    await page.locator("#notifList").getByText("SK-00003").click();
    await expect(page.locator("#notifSheet")).toBeHidden();
    await expect(page.locator("[data-delivery-id]", { hasText: "SK-00003" })).toBeFocused();
    await expect.poll(() => db.notifications[0].is_read).toBe(true);
  });

  test("driver sees available jobs, their own jobs and their vehicle", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await expect(page.locator("#userName")).toHaveText("Carlo Santos");
    await expect(page.getByText("SK-00001")).toBeVisible(); // available (pending, no driver)
    await expect(page.getByText("SK-00003")).toBeVisible(); // assigned to them, in transit
    await expect(page.locator("#vehicleType")).toHaveValue("6-wheeler truck");
    expect(errors).toEqual([]);
  });

  test("admin sees the stats and the deliveries table", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "admin");
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#userName")).toHaveText("Dina Admin");
    await expect(page.getByRole("cell", { name: "SK-00001" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a farmer opening the driver dashboard is sent home", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/driver/index.html");
    await expect(page).toHaveURL(/\/index(\.html)?$|\/$/);
  });
});
```

## 11. Checks (from `sakada-web/`)
```
npm run lint         # no errors
npx vitest run       # 133 passed
npm run test:e2e     # 57 passed
```
If a check fails, stop and paste the output. Don't "fix" the code.
