---
target: For Farmers Figma v3
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-13T16-01-44Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma For Farmers v3 (desktop 52:295, mobile 55:409) replacing sakada-web/pages/for-farmers.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live map never named |
| 2 | Match System / Real World | 3 | App terms in the legend without meaning |
| 3 | User Control and Freedom | 3 | After-cancel / long-Pending unstated |
| 4 | Consistency and Standards | 2 | "Your fare/locked" vs HIW "Estimated fare"; secondary CTA link vs button; legend lacks Cancelled |
| 5 | Error Prevention | 3 | Account requirement never stated |
| 6 | Recognition Rather Than Recall | 3 | Form fields listed up front |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Formula twice; steps repeat the FAQ |
| 9 | Error Recovery | 2 | No-driver / no-show / wrong-weight unaddressed |
| 10 | Help and Documentation | n/a | Persuade page |
| **Total** | | **22/32** | **Acceptable (69%)** |

## Design Specificity Verdict
Content specific; composition generic (same skeleton as How It Works). The farmer-only shipped features (driver name/vehicle/plate, live map, Book again) are single sentences. Detector: 1 false positive. Text contrast ≥7.5:1; card border 3.10; band 1.07; teal/blue dots near-identical hue. Empty Q&A left column 516×535. No CTA in the fare card.

## Priority Issues
1. [P1] Page repeats How It Works; farmer-only features are sentences. Fix: replace the steps with "What you'll see after you book" UI vignettes (Driver Assigned card, live map, Book again); CTA in the fare card. /impeccable distill + shape
2. [P2] Driver claim unconditional (vehicle/plate optional); "locked" vs "estimated" terminology. /impeccable clarify
3. [P2] Close aimed at returning users; secondary CTA style inconsistent. /impeccable clarify
4. [P2] Status legend doesn't read as a sequence; no Cancelled; wraps badly on mobile. /impeccable layout
5. [P3] Dead space (Q&A left column, fare rule overshoot). /impeccable layout

## Persona Red Flags
Jordan: no account notice; legend jargon; payment timing unclear. Riley: conditional vehicle data; declared vs actual weight; never-accepted case; 4 vs 5 steps. Casey: no CTA between hero and close; small inline links. Mang Ruben: English only; trust told, not shown.

## Minor Observations
Orphans ("call.", "again.", "changes.", mobile headings); closing H2 36px vs 39px; band heading gap 13px vs 19–22px; hero top padding 102 vs ~72; right columns start at different x (800/856/580); "Nobody has accepted yet?" phrasing; "in Sakada" repeated.

## Questions to Consider
What is this page for that How It Works isn't? Show the Driver Assigned card in the hero? Lead in Tagalog/Bisaya?
