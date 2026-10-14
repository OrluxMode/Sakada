---
target: For Farmers Figma redesign
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-13T15-36-01Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma For Farmers redesign (desktop 52:295, mobile 55:409) replacing sakada-web/pages/for-farmers.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Stage legend color-only; teal/blue close |
| 2 | Match System / Real World | 3 | Farmer language; ("watch the trip live" flagged, but a live location map ships — false positive) |
| 3 | User Control and Freedom | 3 | Cancel-while-Pending stated; after-accept unstated |
| 4 | Consistency and Standards | 3 | Step 05 title "Rate your driver" vs body about rebooking; hyphen breaks |
| 5 | Error Prevention | 2 | "Estimated" vs "fare you book is the fare you pay" — lock point unclear |
| 6 | Recognition Rather Than Recall | 3 | Formula beside the example; stage names match the dashboard |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Dead left columns (fare ~790×200, FAQ ~516×356); formula repeats the card |
| 9 | Error Recovery | 2 | No-driver / after-accept / wrong-weight unaddressed |
| 10 | Help and Documentation | n/a | Persuade page |
| **Total** | | **22/32** | **Acceptable (69%)** |

## Design Specificity Verdict
Content specific and honest (fare card, Pending/cancel, no weight limit, notifications); composition generic and largely a subset of How It Works. The two unique features (driver name/vehicle, book again) are buried in step copy. Detector: 1 false positive. All text ≥7.5:1; card border 3.10:1; first CTA at 13% (desktop) / 10% (mobile).

## Priority Issues
1. [P1] Unique features buried; page duplicates How It Works. Fix: FAQ "Who's picking up my harvest?" → name + vehicle; closing band = repeat-run payoff; trim the steps (drop "See the fare"). /impeccable distill + clarify
2. [P2] Step 05 title/body mismatch. Fix: "Rate it, then rebook it". /impeccable clarify
3. [P2] Fare lock point unclear. Fix: "The fare is locked when you book. The driver is paid exactly that, with no haggling at drop-off." /impeccable clarify
4. [P3] Hyphen breaks (drop-off, In-app), orphans, FAQ lines 77–80 chars, dead left columns, small inline links. /impeccable polish + layout

## Persona Red Flags
Jordan: step 05 mismatch; "Pending" before it's defined; "next harvest run" for a first-timer. Casey: no CTA between hero and close on a 3,700px page; small inline links. Riley: estimated vs locked; after-accept cancel; Cancelled missing from the legend. Mang Ramon: "who is the driver?" unanswered where the heading raises it; weekly rerun buried.

## Minor Observations
Formula repeats the card; legend wraps on mobile (orphans In Transit/Delivered); 01–05 numerals compete with titles; step 03 twice as long; secondary CTA text link vs button; band 1.07:1 vs page.

## Questions to Consider
Lead with knowing your driver + repeat runs and link out for mechanics? Is "who is this driver?" the real question of the FAQ? Is "without a single phone call" fully true with cash payment?
