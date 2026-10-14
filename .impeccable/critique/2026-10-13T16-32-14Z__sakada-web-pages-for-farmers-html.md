---
target: For Farmers polish round 2 (Figma)
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-13T16-32-14Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma "for farmers polish" round 2 (desktop 59:314, mobile 59:476).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Bright/dim stage labels read as progress |
| 2 | Match System / Real World | 3 | Sample route contradicts the fare |
| 3 | User Control and Freedom | 3 | Cancel window stated; escape links |
| 4 | Consistency and Standards | 3 | Different worked examples vs HIW; amber overloaded |
| 5 | Error Prevention | 3 | Route/fare mismatch sets a wrong price expectation |
| 6 | Recognition Rather Than Recall | 3 | Formula in prose + table |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Driver line buried in card 1; fare left column trails off |
| 9 | Error Recovery | 2 | No-show / dispute at drop-off unaddressed |
| 10 | Help and Documentation | n/a | Persuade page |
| **Total** | | **23/32** | **Good (72%)** |

## Design Specificity Verdict
Content specific and honest; skeleton standard. Detector: 1 false positive. Text ≥7.5:1; pill and card borders now ≥3:1. Lines too long: stage intro 173 chars, FAQ answers 82–86, band body 90. FAQ dividers misaligned between columns. FAQ grid ≠ card grid.

## Priority Issues
1. [P1] Sample cards say Cabanatuan → Balintawak (~115 km) at ₱2,350 (the 40 km example); the real fare ≈ ₱3,475. HIW uses a third example. Fix: one canonical example across both pages; "example run" not "typical". /impeccable clarify
2. [P2] Money hand-off method + drop-off disputes unanswered. /impeccable clarify
3. [P2] Pending answer lacks the accept notification. /impeccable clarify
4. [P2] Bright/dim stage labels unexplained; cancel ring looks like a stage. /impeccable polish
5. [P2] Driver line buried at the card bottom; sample "Book again" looks tappable; card label only in the intro. /impeccable polish

## Persona Red Flags
Jordan: sample cards may look real; payment method unclear. Casey: text links <44px; 4–5 amber buttons. Riley: route/fare; differing examples; rebook price implied same. Mang Ramon: knows the route is ~2.5 h; ₱2,350 implausible; wants to know he pays cash and what to point to if asked for more.

## Minor Observations
"Locked in when you book" 14px; amber IDs; mobile "Book your first run" label repeats the final heading; quiet final band; empty under the hero H1.

## Questions to Consider
Make the fare card and the 3 sample cards one trip at one price? Put the fare card in the hero? Name the cash hand-off bluntly?
