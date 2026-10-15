---
target: farmer/vendor dashboard Figma v2
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html"
target_fingerprint: "sha256:6fc66f59167df86d0593ef906db2bceef16735a7b7e2c20707e420a984b77503"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html
timestamp: 2026-10-14T15-10-57Z
slug: sakada-web-dashboard-farmer-index-html
---
Method: dual-agent. Target: v2 Figma frames 154:294, 154:426, 155:294, 155:375, 155:519, 155:586, 155:648, 155:756.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | no Driver assigned card; no getting-fare/booking states |
| 2 | Real world | 3 | Deliveries tab holds only past |
| 3 | Control | 3 | notif close out of reach |
| 4 | Consistency | 2 | stepper labels desktop-only; Home highlighted under sheet |
| 5 | Prevention | 3 | no route-not-found |
| 6 | Recognition | 3 | good |
| 7 | Efficiency | 2 | no rate-now on mobile Home |
| 8 | Minimalist | 3 | who-pays repeats |
| 9 | Recovery | 3 | booking failed / rating failed missing |
| 10 | Help | 2 | no weight help |
| Total | | 27/40 | Good |

Verified: notification strings (0008) differ from mock; "You cancelled" not always true. Measurements: Pending current segment 2.78:1 (fail, hue-only); Cancelled chip border 2.53; banner borders 2.88/2.90; unread badge clipped 2px; disabled confirm 2.03.
Fixes → v3: lifecycle states; real copy; stepper shape+count; History tab; Home order + bottom-sheet notifications; desktop sticky rail; grouped Book form + weight hint; collapsed rating; borders/badge/lock.
