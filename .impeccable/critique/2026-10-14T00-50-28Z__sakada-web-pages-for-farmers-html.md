---
target: For Farmers polish round 3 (Figma)
total_score: 28
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 0
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-14T00-50-28Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma "for farmers polish" round 3 (desktop 59:314, mobile 59:476).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No typical Pending wait stated |
| 2 | Match System / Real World | 4 | Palengke, ₱, cash at drop-off, plate number |
| 3 | User Control and Freedom | 3 | Nothing after a driver accepts |
| 4 | Consistency and Standards | 3 | palengke/Palengke; "Delivered" label alignment; trip/run/booking |
| 5 | Error Prevention | 3 | Account notice; overcharge + weight answered |
| 6 | Recognition Rather Than Recall | 3 | Formula only inside a paragraph |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Generic hero; the sample map looks broken |
| 9 | Error Recovery | 3 | Overcharge + no-driver answered; after-accept not |
| 10 | Help and Documentation | 3 | FAQ + Contact; two questions repeat |
| **Total** | | **28/36** | **Good (78%)** — on the earlier /32 basis (7, 10 n/a): 25/32 |

## Design Specificity Verdict
Content specific (canonical ₱3,550 trip, cash, plate, status tokens); layout generic. Craft-floor refuse list passes. Detector: 1 false positive. All text ≥7.5:1; card/pill borders ≥3:1 (amber pill border vs its fill 2.87). Lines >75: stage intro 84/83, close 81, card note 78. Card 3 sits 26px lower (3-line caption). Map route clipped at the frame top.

## Priority Issues
1. [P2] Sample live map reads as a rendering bug (route clipped, dot off route). /impeccable polish
2. [P2] Nothing on "what if something goes wrong after a driver accepts?"; tolls unstated. /impeccable clarify
3. [P2] Samples labelled only once; "Book again" looks real. /impeccable clarify
4. [P3] Hero generic, empty left column; no product artefact. /impeccable layout
5. [P3] Formula hidden in a paragraph. /impeccable typeset

## Persona Red Flags
Jordan: Book again looks live; "run" vs delivery. Casey: sample note far from the cards; thin links (code). Riley: broken-looking map; palengke/Palengke; no-show after accept; tolls. NE grower: tolls? loaders? small card text in glare; "A fair fare" trips a second-language reader.

## Minor Observations
Delivered label right-aligned; FAQ repeats two earlier facts; "A fair fare up front" sound repeat; receipt "Example" label blends in; second-column left edges vary (800/720/736/960/936).

## Questions to Consider
Receipt in the hero? Are tolls included? Why quiet after a driver accepts?
