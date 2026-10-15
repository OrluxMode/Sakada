---
target: driver dashboard Figma v2
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html"
target_fingerprint: "sha256:5605074e3a1b98747e2ed1ba064161f896d1124e47b7d06ea630870ba6dc1808"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html
timestamp: 2026-10-14T16-44-16Z
slug: sakada-web-dashboard-driver-index-html
---
Method: dual-agent. Target: driver v2 frames 173:294, 173:430, 174:580, 174:659, 174:737, 174:294, 174:1119.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | outlined segments ~1.9:1; no mobile stage labels |
| 2 | Real world | 3 | mixed button voice |
| 3 | Control | 3 | picked up / start trip irreversible, unprotected |
| 4 | Consistency | 3 | green primary; double new-job counts |
| 5 | Prevention | 3 | no-vehicle gate not in code |
| 6 | Recognition | 3 | sticky bar lacks job identity with 2 jobs |
| 7 | Efficiency | 2 | extra accept tap; list not live |
| 8 | Minimalist | 3 | duplicated "come back" line; cash smallest |
| 9 | Recovery | 2 | blocked has no steps; unpaid dead end |
| 10 | Help | 3 | good |
| Total | | 28/40 | Good |

Verified: 0007 in_transit → delivered only (unpaid job stuck, owner question); "taken by another driver" unknowable (code says "or no longer available"). Measurements: More 37px wide; sticky bar overlaps Help row 6px; bar borders 1.34:1; 14px labels.
Fixes → v3: undo snackbar + job identity on sticky; two-job design; location no-signal/returning/blocked steps; honest copy; solid segments + labels; cash block; one voice; missing states; single new-job count; Luzon route.
