---
target: For Farmers polish round 5 (Figma)
total_score: 28
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-14T01-29-43Z
slug: sakada-web-pages-for-farmers-html
closed: true
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma "for farmers polish" round 5 (desktop 59:314, mobile 59:476), with the real Mapbox live-map sample.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Stages + notifications clear |
| 2 | Match System / Real World | 3 | Payment copy assumes the farmer is at the drop-off |
| 3 | User Control and Freedom | 3 | Sample Book again looks real |
| 4 | Consistency and Standards | 3 | Mobile-only post-cards CTA; HIW wording to sync |
| 5 | Error Prevention | 3 | Expectations set before booking |
| 6 | Recognition Rather Than Recall | 4 | One example next to the formula, breakdown and cards |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Route repeated 6×; many hairlines |
| 9 | Error Recovery | 3 | FAQ covers the money fears |
| 10 | Help and Documentation | 3 | FAQ + Contact + HIW links |
| **Total** | | **28/36** | **Good (78%)** |

## Design Specificity Verdict
Content highly specific (one worked trip; real dashboard cards; real Mapbox map); structure generic, single tempo, no designed moment. Detector: 1 false positive. Nothing clipped; all text ≥7.5:1. Map image border at the top 2.66:1; empty area under sample card 1 (416×204); body→content gaps 17/35/43; mobile chip line starts with "·".

## Priority Issues
1. [P1] Payment copy assumes the farmer is at the drop-off 120 km away. Fix: neutral "cash to the driver at drop-off" until the owner decides. /impeccable clarify
2. [P2] No designed moment; the live map is a 1/3-width box. Fix: give the map card 2/3 width. /impeccable bolder + layout
3. [P2] "Rate it" card shows no rating; Book again is a fake control. /impeccable harden
4. [P3] Repetition across the 3 cards. /impeccable distill
5. [P3] Picked Up / In Transit hues close. /impeccable colorize

## Persona Red Flags
Jordan: taps Book again; COD unexplained. Casey: 13–14px card text; heavy map image (lazy-load in code). Riley: static image captioned "updates automatically"; identical details on SK-00131. Mang Ramon: not at the drop-off; who receives the goods.

## Minor Observations
Hero right column 10px below the H1 cap; cancel note too tight to the timeline; desktop lacks the post-cards CTA; "a driver you can name" ambiguous; hairlines heavy.

## Questions to Consider
Truck in the hero? Settle the payment answer first? One card advancing through stages?
