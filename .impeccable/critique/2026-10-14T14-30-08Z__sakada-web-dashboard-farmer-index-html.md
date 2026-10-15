---
target: farmer + driver dashboards (baseline)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html"
target_fingerprint: "sha256:6fc66f59167df86d0593ef906db2bceef16735a7b7e2c20707e420a984b77503"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html
timestamp: 2026-10-14T14-30-08Z
slug: sakada-web-dashboard-farmer-index-html
---
Method: dual-agent (A: design review · B: detector + measurements). Farmer + driver dashboards (fake sign-in, fixture data) at 390/1440/320. Baseline before the Phase 1 redesign (refs Figma 147:296 / 147:299).

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Stage is a 12px pill; "Sharing your location…" shown before permission |
| 2 | Match System / Real World | 3 | Local copy good; SK code loudest |
| 3 | User Control and Freedom | 2 | Mark Delivered one tap, no undo; native confirm() |
| 4 | Consistency and Standards | 2 | 31/33/44px buttons on one card |
| 5 | Error Prevention | 2 | Driver accepts without date/notes/distance |
| 6 | Recognition Rather Than Recall | 2 | First farmer card at y≈1162 below empty form |
| 7 | Flexibility and Efficiency | 2 | No nav; vehicle form above jobs every visit |
| 8 | Aesthetic and Minimalist Design | 2 | Equal-weight cards; desktop half empty |
| 9 | Error Recovery | 2 | Raw error.message; location error detached |
| 10 | Help and Documentation | 2 | No stage meaning, no who-pays |
| Total | | 21/40 | Acceptable (low) |

Measurements: Accept/Mark 33px, stars 20×22, inputs 39px, Refresh 35px; card text 12–13px; input borders 1.31:1; placeholders 3.1:1; 320px overflow 25px (Log Out); header wraps at 390; skip link → no #main; stars unlabeled; rating textarea unlabeled. Detector: 2 flat-type-hierarchy (false positive), overlay 5 placeholder low-contrast.

P0 Primary task buried + stage invisible → active card with 5-stage stepper first; booking behind quick action; driver current job first with big next-step button. (layout/shape)
P1 Driver ergonomics + irreversible Delivered → ≥56px next-step, ≥44px everything, confirm/undo on Delivered. (adapt/harden)
P1 Location state contradictory/detached → state on the card; farmer "Last updated". (clarify/harden)
P2 Header breaks, no nav → compact header + bottom tab bar + Profile tab; id="main". (adapt)
P2 Cards hide key facts → pickup/drop-off dots, date, fare; quieter code; driver sees date/notes/distance. (layout/clarify)
