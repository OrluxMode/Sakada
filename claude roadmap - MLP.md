# Sakada roadmap: MVP to MLP

Saved 2026-10-21. Owner priority: **the vendor side first** (farmer/vendor
dashboard and shared code) until the owner says it's "all goods", **then the
driver dashboard**.

## Where we are

The MVP loop works end to end: sign up (farmer / vendor / driver), book with
the fare up front (₱150 + ₱15/km + ₱2/kg), a driver accepts (2-job cap),
live status and map, notifications, rating, admin oversight. Live on main
as of `ed618fb`.

## 1. Vendor side (now)

| # | Feature | Who builds it | Size | Status |
|---|---|---|---|---|
| 1 | Honest drive time ("About 3 h drive" on each shipment, from Mapbox route duration; no fake ETA) | Claude (frontend only) | Small | Next |
| 2 | Saved addresses ("My farm", "Divisoria stall") in the Book form | Codex (table + RLS), then Claude | Medium | |
| 3 | Tracking link for the receiver, no account needed | Codex (secure link), then Claude (page) | Medium | |
| 4 | Payment choice: GCash or cash on delivery (planned in PRODUCT.md) | Codex + Claude + owner's GCash setup | Big | |
| 5 | Phone notifications (app-style push) | Claude + Codex | Big | |
| 6 | Filipino / Taglish option | Claude | Medium (every screen) | |

## 2. Driver dashboard (after the vendor side is done)

- Bring it to the new Home design language (cards, maps, tab bar).
- Proof of delivery photo at drop-off (also helps unpaid follow-up).
- Weekly earnings summary.

## Later / nice-to-have

- Driver verification (license and plate) before the first job.
- Follow-up flow for unpaid deliveries (today they're only flagged).
- SMS for users without data.

## Before calling it launch-ready

A small pilot with real farmers, vendors and drivers on their own phones;
their feedback reorders this list.

## How work runs

Figma design for anything new, owner approves, Claude builds the frontend,
Codex builds the backend (`codex prompt - <topic>.md`), test locally on
localhost:4400, then deploy when the owner says so.
