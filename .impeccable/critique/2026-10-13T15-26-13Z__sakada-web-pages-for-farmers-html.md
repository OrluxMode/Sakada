---
target: For Farmers page
total_score: 14
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-13T15-26-13Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: sakada-web/pages/for-farmers.html (live).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Stages only as text; no track; status tokens unused |
| 2 | Match System / Real World | 2 | Never answers how much / how to pay / no driver / weight; "schedule" vs pickup date |
| 3 | User Control and Freedom | 2 | Cancel-while-Pending never mentioned |
| 4 | Consistency and Standards | 1 | Two false claims; eyebrow; "1" vs "01"; 14.5/15px body |
| 5 | Error Prevention | 1 | No fare example, weight, or payment expectation |
| 6 | Recognition Rather Than Recall | 2 | "Cost estimate" never shown |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 2 | Empty, flat; 4-up grid duplicates the steps |
| 9 | Error Recovery | 2 | No-driver case unexplained |
| 10 | Help and Documentation | n/a | Persuade page |
| **Total** | | **14/32** | **Poor (44%)** |

## Design Specificity Verdict
Interchangeable: identical scaffold to for-vendors (eyebrow, h1, lede, 4-up grid, steps, CTA band). None of Sakada's own assets (fare formula, status track, exact-fare rule, cancel, no weight limit). Banned eyebrow; same-size tile grid. Detector: 1 false positive (flat-type-hierarchy, @imports). All contrast ≥7.5:1. Empty regions: hero right 716×469, steps right 616×555.

## Priority Issues
1. [P0] False claims: "Know your driver… who they are and their vehicle details" (no driver join in getMyDeliveries) and "repeat a booking" (no rebook action). Fix: replace with true copy (in-app notifications; history with route/weight/fare + rating) or ship the features. /impeccable clarify
2. [P1] No fare logic or payment truth. Fix: farmer-scale worked example (40 km, 800 kg → ₱2,350) + "pay the driver exactly this, no haggling; GCash/COD coming soon". /impeccable shape
3. [P1] No CTA until the bottom (~2,150px on mobile); hero half empty. Fix: two-column hero with Book a Delivery + "See how it works"; drop the eyebrow. /impeccable layout
4. [P2] Generic duplicated structure, no status visual. Fix: merge grid+steps; farmer objections (Pending/cancel, no weight limit, notifications) in uneven layout; status dots; "01" numbering. /impeccable distill + bolder
5. [P2] Body 14.5/15px < 16px floor. Fix: 16px / 1.6. /impeccable typeset

## Persona Red Flags
Jordan: no price, no payment, button only at the end. Casey: 4.5 screens of 15px grey text, no action. Riley: finds no driver name, no repeat, concludes the marketing lies. Mang Ben (600 kg co-op lead): how much / how to pay / can I back out — none answered; "schedule" unclear; weight unclear.

## Minor Observations
Eyebrow repeats the nav; "schedule" → pickup date; "fee" → fare; step 3 lacks notification/Pending/cancel; CTA band heading generic, heading and button 900px apart; lede orphan "call."; logo tap target 31px tall.

## Questions to Consider
Merge For Farmers + For Vendors into one "Sending goods" page? Make the fare the hero? Which three promises can a farmer verify on the first booking?
