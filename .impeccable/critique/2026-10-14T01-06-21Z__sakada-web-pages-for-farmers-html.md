---
target: For Farmers polish round 4 (Figma)
total_score: 28
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-14T01-06-21Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma "for farmers polish" round 4 (desktop 59:314, mobile 59:476).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Post-booking visibility explained |
| 2 | Match System / Real World | 4 | Palengke, tolls, cash, onions, Isuzu Elf |
| 3 | User Control and Freedom | 3 | Cancel rules stated |
| 4 | Consistency and Standards | 3 | Amber overloaded |
| 5 | Error Prevention | 3 | Hero chip has no "Example" label |
| 6 | Recognition Rather Than Recall | 3 | Mobile total missing from the breakdown |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Broken mobile total; empty space under the H1; ragged sample row |
| 9 | Error Recovery | 3 | FAQ covers the real failure cases |
| 10 | Help and Documentation | 3 | Coverage and receiver-pays missing |
| **Total** | | **28/36** | **Good (78%)** |

## Design Specificity Verdict
Strongly specific to Sakada. Detector: 1 false positive. Defects: mobile ₱3,550 clipped to a sliver; map route crosses the "Nueva Ecija" label; Book again 34px; cash note 81 chars; map border 2.95:1.

## Priority Issues
1. [P1] Mobile fare total collapses (long label pushes the amount off the card). /impeccable adapt
2. [P2] Hero fare chip looks like an input and reads as a quote (no "Example", no km). /impeccable clarify
3. [P2] "Pay in cash when goods arrive" assumes the farmer is at the drop-off (rule needed from the owner). /impeccable clarify
4. [P2] Stage labels have no glosses; desktop rail stops short and doesn't match the grid. /impeccable layout
5. [P3] Empty space under the desktop H1; eye jumps across. /impeccable layout

## Persona Red Flags
Jordan: taps the chip; Pending unexplained; notifications = in-app only unclear. Casey: broken total; small links. Riley: "without a single phone call" is absolute; coverage unstated; rating omitted. Mang Ramon: who pays in Marikina if he stays on the farm; is Mindanao covered.

## Minor Observations
Amber overload (SK codes vs pills); map road stripes as noise; ragged card bottoms; no toll line in the breakdown; footer link set out of scope.

## Questions to Consider
Who holds the cash at drop-off? What does amber mean? "Without phoning around for a truck" instead?
