---
target: farmer/vendor dashboard full review
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html"
target_fingerprint: "sha256:2077c735fb806fac5f3845953785f8ff471c9f9947318da0b53f97e61c43f4a8"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html
timestamp: 2026-10-26T21-09-54Z
slug: sakada-web-dashboard-farmer-index-html
---
⚠️ DEGRADED: single-context (sub-agents are only used when the owner asks; A and B ran one after the other)

# Farmer/vendor dashboard: full review pass (2026-10-27)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Stepper, status lines, live captions, toasts are strong; late bookings bury the fix |
| 2 | Match with the real world | 3 | Plain words, ₱, produce, now Filipino/Taglish |
| 3 | User control and freedom | 3 | Back steps, cancel while pending, Book again |
| 4 | Consistency and standards | 3 | Booking codes break in some lines but not others |
| 5 | Error prevention | 3 | Fare first, past dates off, typo checks, locked-address note |
| 6 | Recognition over recall | 3 | Saved addresses, recent route, produce suggestions |
| 7 | Flexibility and efficiency | 3 | Rebook, saved places, wheel keys; History has no search of its own |
| 8 | Aesthetic and minimalist | 3 | Desktop Home stacks full-width map cards |
| 9 | Error recovery | 3 | Errors say what to do next |
| 10 | Help and documentation | 3 | How it works sheet, Contact Support with the code filled in |
| Total | | 30/40 | Good |

## Priority issues
1. [P2] Late booking: the fix is far from the problem (Track page: status says "book it again", button is below map, route and fare).
2. [P2] Booking codes split at the hyphen ("Contact Support about SK-" / "00001") on phones.
3. [P2] Desktop Home: active shipments stack as full-width cards with ~350px maps.
4. [P3] Card footer dates orphan at 320 px ("Since Oct" / "14").
5. [P3] History filter chips wrap to two rows with big counts ("Cancelled (80)").

## Worst-case data (break-ui): held up
80-char recipient, 5-produce 120-char goods line, 100,000 kg, ₱230,150, 200-char and unbroken addresses, 10 saved addresses with 40-char names, 40-char vehicle, 12 active / 400 past bookings, empty and single states: no sideways scroll, no clipped text, pagination keeps History light.

## Detector
CLI: 1 finding (flat-type-hierarchy) = false positive (headings sized by CSS classes, not tags). Browser overlay blocked by the dashboard's CSP (script-src 'self').
