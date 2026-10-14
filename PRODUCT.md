# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Farmers and vendors** who need agricultural goods moved: they book a truck, see an estimated fare, and track the delivery.
- **Truck drivers** who accept and complete deliveries.
- **Admins** who oversee deliveries and accounts.
- **Viewing context (confirmed 2026-10-12):** the desktop website is mainly viewed indoors by business/company owners (e.g. vendors running a produce business). The mobile version serves vendors and owners in mixed conditions, both indoors and on the move.

## Product Purpose
Sakada Logistics connects people moving agricultural goods directly with available trucks, so they can book, track, and manage every shipment in one place instead of calling around for a ride. Success means a booking reaches a driver and is delivered without phone tag.

## Positioning
A booking platform built for agri-delivery in the Philippines. The fare is computed up front from distance and weight, the farmer/vendor and the driver deal through one booking, and each delivery stage is visible live.

## Operating Context
- Coverage: **nationwide** in the Philippines (confirmed). No specific provinces are claimed.
- Delivery stages tracked: Pending → Driver Assigned → Picked Up → In Transit → Delivered (Cancelled possible).
- Fare estimate (in code, `js/mapbox-client.js`): **₱150 base + ₱15 per km + ₱2 per kg**, using Mapbox routing.
- Bookings capture goods description, quantity in kg, pickup and drop-off addresses.

## Capabilities and Constraints
- Live: email + Google sign-up with role (farmer / vendor / driver), booking, fare estimate, real-time status, notifications, driver ratings, admin dashboard.
- **Planned, not built yet:** payment choice at booking. Either **GCash** (paid up front, so the drop-off has no cash handling) or **cash on delivery** (paid to the driver at drop-off, like Shopee COD). Present as upcoming until it ships.
- Stack: vanilla HTML/CSS/ES modules, Supabase, Mapbox, hosted on Vercel.
- **Confirmed by the owner 2026-10-13:**
  - payment today goes directly to the driver, outside the app
  - the driver is paid exactly the booked fare: no haggling at drop-off, no Sakada cut stated
  - **the receiver pays, like cash on delivery:** the farmer ships, and the buyer (usually a vendor) pays the driver in cash at drop-off; **expressway tolls are included** in the fare
  - after a driver accepts (Driver Assigned), only an admin can cancel; requesters cancel only while Pending
  - there is no weight limit; drivers see the kg before accepting (truck tonnage on the site is only a guide)
  - notifications are in-app only (no SMS); a booking stays Pending until a driver accepts or the requester cancels
- **Confirmed by the owner 2026-10-14 (Contact / About):**
  - there is **no public email and no phone hotline**; the contact form (saved to `contact_submissions`, read in the admin dashboard) is the only channel
  - no response-time, office-hours, 24/7, "guaranteed payout", onboarding-time or cold-chain promises
  - About tells the problem and the product only: no team, founder or origin story

## Brand Commitments
- Name: Sakada Logistics. Logo is a "SAKADA" wordmark with "DA" in the accent color.
- Existing voice: plain, direct, benefit-first ("Your Harvest. Their Truck. One Booking." / "Stop calling around for a ride.").

## Evidence on Hand
- Real: fare formula, delivery stages, three roles, nationwide scope.
- **Absent, do not fabricate:** customer counts, testimonials, partner logos, delivery volumes, verified-driver counts, ratings averages.
- Hero photo: keep the current `assets/hero.jpg` (tractor at sunset). Owner decision 2026-10-13: satisfied with it, no Filipino truck photo planned. Don't flag it as a problem.

## Product Principles
1. One booking replaces the phone calls: every page should lead to booking or signing up.
2. Show the price logic. The fare formula is real and simple, so show it instead of hiding it.
3. Each role has a clear entry point; nobody gets funneled into another role's page.
4. Claim only what ships; label planned features as planned.

## Accessibility & Inclusion
Many users are on budget Android phones with slow connections. Keep tap targets at 44px or larger, body text at 16px or larger, light page weight, and WCAG AA contrast.
