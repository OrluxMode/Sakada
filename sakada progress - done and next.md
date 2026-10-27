# Sakada Logistics — What's Done and What's Next

Written 2026-10-27. A summary of what has been built so far and what Claude
suggests doing next, in priority order. The full history is in `claude agent.md`.

---

## Part 1: What's done

### The product today
Farmers and vendors book a truck, see the fare before they confirm, and follow
their harvest live until it's delivered. The receiver pays the driver in cash at
drop-off. There are four roles: **farmer**, **vendor**, **driver** and **admin**.

### Public site
- Landing page, How it works, For farmers / vendors / drivers, About, Contact page
  (saved to the database).
- Phone welcome screen with **swipe to start** (matches the approved Figma).
- Navbar that hides while scrolling and comes back when you stop.

### Accounts and security
- Sign up and log in (email or Google), with every form checked (including email typos like `gmail.co`).
- **Forgot password** on Log in and in Edit profile; reset page from the email link.
- **Show / Hide** password in words, not an eye icon.
- Security hardening: XSS fixes, Content Security Policy, row-level security on every
  table, no role escalation, rate limits, server-side pricing, text limits in the database.

### Farmer / vendor dashboard (the main work)
**Home**
- Delivery status tiles (Waiting / On the road / Delivered) and search by code or produce.
- Active shipments with **real route maps**: swipe one card at a time on phones, two per row on desktop.
- "Needs you" for late bookings, a Booked banner, and smooth tab changes.

**Book (4 steps)**
1. Route & schedule: **address suggestions** while typing (Mapbox, Philippines),
   **Pin on the map**, **Use my location**, **saved addresses** first, a date picker, and pickup time windows.
2. Shipment details: **produce rows** with English + Tagalog suggestions
   (e.g. "kamatis" → Tomatoes), a **kg wheel**, and receiver name and phone.
3. Review: the fare up front (₱150 + ₱15/km + ₱2/kg, tolls included) and an honest drive time.
4. Request sent: **copy the booking code**, track it, and turn on phone alerts.

**Track**
- 5 tabs: Home, Track, Book, History, Profile.
- The shipment page: big status headline, 5-step bar with "Next: …", the driver's
  name, vehicle, plate and **real rating**, the route and the fare.
- **Live line**: the amber road starts at the truck and moves with it; a new road is
  asked for if the driver leaves the planned one.
- **Maximize map**: the real zoomable map on phone and desktop. The truck glides
  to each new position, with Center on the truck.
- A late booking shows **Book a new date** right in its status card.

**History**
- All / Delivered / Cancelled filters on one row, 25 per page, Book again, and rate the driver.

**Profile**
- Photo, Edit profile, saved addresses, in-app **Contact Support** and **How it works**,
  and a log-out confirm.
- **Language**: English / Filipino / Taglish (593 phrases); the choice follows the account.
- **Phone alerts** (web push), including the iPhone Home Screen steps.

### Driver dashboard (works, older design)
- Available jobs, accept with a confirm, a **2-job cap**, and a vehicle needed first.
- I've picked up the load → I'm driving to drop-off → I've delivered it, with **Undo**.
- **Cash check** at drop-off (paid / not paid → flagged Unpaid).
- Location sharing every 20 seconds while a job is moving.

### Admin dashboard
- Stats, a deliveries table, and unpaid deliveries.

### Backend (Supabase, built by Codex)
- 28 migrations (`0001`–`0028`): core schema, status history, notifications, ratings,
  RLS, valid status transitions, rate limits, pricing, driver jobs and payment,
  past pickup dates, rating averages, recipient and pickup window, avatars,
  saved addresses, language, and push subscriptions.
- Edge Function `send-push` (phone alerts in 3 languages).

### Quality
- **255 unit tests, 113 end-to-end tests**, lint clean.
- Worst-case data test (`npm run break-ui`): long names and addresses, 100,000 kg,
  ₱230,150 fares, 400 bookings, and empty accounts at 320 / 390 / 1440 wide. Nothing breaks.
- Design review score **30/40 (Good)**; all 5 issues it found have been fixed.
- Figma-first: every new screen was designed and approved before it was built.

### Not committed yet (as of this file)
The 5 review fixes, the live line, the maximize map, the worst-case test updates,
`demo guide.md`, and this file.

---

## Part 2: What Claude suggests next

### A. Before the presentation (do first)
1. **Commit, push, and test on the live Vercel site.** Run one full flow there:
   book → accept → pickup → live map → delivered → rate.
2. **Rehearse with `demo guide.md`**, with the driver side on a real phone outdoors.
3. **Record a backup video** of the full flow.

### B. High value, next to build
4. **Keep the driver's screen awake during a trip.** A website can't send its location
   while the phone is locked or the browser is in the background, so the truck stops
   moving on the vendor's map. Use the browser's Screen Wake Lock while a job is moving,
   and tell the driver to keep Sakada open. *Small, frontend only. Big impact on live tracking.*
5. **Receiver tracking link.** The receiver (who pays the cash) can follow the truck
   without an account. *Codex: a secure expiring link. Claude: a small public page.*
6. **Driver dashboard redesign.** Bring it to the new design (cards, maps, tab bar, Filipino/Taglish).
   Add a **proof of delivery photo** at drop-off and a **weekly earnings** summary.
7. **Custom email sender (SMTP).** Supabase's built-in email only sends a few per hour,
   so password-reset emails can fail once real users sign up. The steps are already in
   `FORGOT PASSWORD SAKADA EMAIL.md`.

### C. Important before real users
8. **Privacy Policy and Terms page.** Sakada stores names, phone numbers and live
   locations, which the Philippine Data Privacy Act (RA 10173) covers. Add a short
   Privacy Policy and Terms, and link them on sign-up.
9. **GCash / cash-on-delivery choice.** Waiting on the owner's payment provider account.
10. **Location quality.** Send the GPS accuracy with each position and ignore very
    poor readings (common on laptops) so the truck doesn't jump off the road. *Codex adds one column.*
11. **Watch the Mapbox usage.** Each card map, route and live update uses Mapbox
    requests. The free tier is generous, but check the Mapbox dashboard monthly
    and set a billing alert.
12. **Follow-up for unpaid deliveries.** Today they're only flagged for admin.
13. **Driver verification.** Check the license and plate before the first job.

### D. Polish and checks
14. **Review pass on the driver and admin dashboards** (the same review the vendor side
    just had: design critique plus the worst-case data test).
15. **Accessibility and speed check on real budget Android phones** (screen reader,
    large text, slow 3G).
16. **A small pilot**: 3–5 real farmers or vendors and 2 drivers for a week.
    Their feedback should reorder this list.

### E. Later / nice-to-have
- SMS updates for receivers without mobile data.
- A home-screen app install prompt for drivers (already a web app, with a manifest and service worker).
- Saved "regular routes" for vendors who book the same trip every week.

---

## How the work runs
Figma design → owner approves → Claude builds the frontend → Codex builds the
backend (`codex prompt - <topic>.md`) → test on localhost:4400 and a phone →
the owner commits and pushes.
