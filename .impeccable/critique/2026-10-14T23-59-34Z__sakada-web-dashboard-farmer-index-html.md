---
target: farmer dashboard Figma v3
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html"
target_fingerprint: "sha256:6fc66f59167df86d0593ef906db2bceef16735a7b7e2c20707e420a984b77503"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html
timestamp: 2026-10-14T23-59-34Z
slug: sakada-web-dashboard-farmer-index-html
---
Method: dual-agent. Target: farmer v3 frames 161:294, 161:503, 162:294, 162:375, 162:467, 162:589, 162:655, 162:716, 162:910.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | done vs current same on mobile; Waiting card no fare |
| 2 | Real world | 3 | "On the way" holds Driver assigned |
| 3 | Control | 3 | delivered card can't be dismissed |
| 4 | Consistency | 2 | Pending/Waiting; Book again ×3; tolls desktop-only |
| 5 | Prevention | 2 | matched place never shown; impossible fare |
| 6 | Recognition | 3 | good |
| 7 | Efficiency | 3 | good |
| 8 | Minimalist | 3 | empty maps; duplicates |
| 9 | Recovery | 3 | 0018 rate-limit / distance-mismatch copy missing |
| 10 | Help | 3 | help link lacks delivery code |
| Total | | 28/40 | Good |

Verified: geocode limit=1, placeName unused; 0018 errors exist. Farmer History still Guimaras ₱3,000 (impossible). Measurements: tappable rows edge 1.49; tab edge 1.39; ROUTE/LOAD/WHEN 13px eyebrows (banned).
Fixes → v4: Luzon route; matched-place lines + "Not right?"; Waiting fare + pickup-passed state; stepper done/current/future distinct; map pin; vocabulary + section names; remove extra Book again; tolls on mobile; Not now + "1 to rate"; notify copy; new error states; edges; legends instead of eyebrows.
