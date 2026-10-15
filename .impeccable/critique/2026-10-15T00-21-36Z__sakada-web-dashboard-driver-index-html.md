---
target: driver dashboard Figma v3
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html"
target_fingerprint: "sha256:5605074e3a1b98747e2ed1ba064161f896d1124e47b7d06ea630870ba6dc1808"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html
timestamp: 2026-10-15T00-21-36Z
slug: sakada-web-dashboard-driver-index-html
---
Method: dual-agent. Target: driver v3 frames 178:294, 178:437, 178:552, 179:294, 179:399, 179:484, 179:568, 179:960, 179:1259.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | "shared on both jobs" false for Accepted job |
| 2 | Real world | 3 | "Collect now" while 100 km away |
| 3 | Control | 3 | 5 s undo too short / not pausable |
| 4 | Consistency | 3 | chips vs back link; 4 amber primaries on desktop |
| 5 | Prevention | 3 | delayed write vs Maps; no 3rd-job limit |
| 6 | Recognition | 3 | Maps caveat repeated |
| 7 | Efficiency | 2 | no veteran fast path |
| 8 | Minimalist | 2 | "Next" ×4; full job cards under active job |
| 9 | Recovery | 3 | rate limit, system location off, null distance missing |
| 10 | Help | 4 | excellent contextual help |
| Total | | 29/40 | Good |

Verified: validators allow empty vehicle type and accept "NB 12" (v3 form-error copy unbacked); 0018 accept/status rate limits. Measurements: future segments #55544c 2.41:1; bar edges #3a3a33 1.71:1; offline disabled button not dimmed; snackbar border 2.43.
Fixes → v4: commit-on-hide undo + Saving/Saved; per-job sharing line + chip dots; collapsed new jobs; sharing in sticky meta; once-only Maps caveat; drop-off copy; chips-only switching; outlined Accept on desktop; new states (system location off, rate limit, no distance, 3rd job, real vehicle errors, inline rating, dimmed offline); contrast fixes; bell removed; 390 width.
Owner questions: unpaid deliveries (0007); cap drivers at 2 jobs?
