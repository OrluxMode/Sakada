---
target: driver dashboard Figma v1
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html"
target_fingerprint: "sha256:5605074e3a1b98747e2ed1ba064161f896d1124e47b7d06ea630870ba6dc1808"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/driver/index.html
timestamp: 2026-10-14T16-27-17Z
slug: sakada-web-dashboard-driver-index-html
---
Method: dual-agent. Target: Figma page "driver dashboard" 164:294 (Home 164:295, Jobs 164:449, History 166:294, Profile 166:371, First visit 166:449, States 167:294, Desktop 167:536). Incumbent code: dashboard/driver/index.html.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility | 3 | no location paused/stale state |
| 2 | Real world | 3 | Pending as step 1 for drivers |
| 3 | Control | 2 | Accept one tap, irreversible |
| 4 | Consistency | 3 | four names for the jobs list |
| 5 | Prevention | 2 | Open in Maps pauses sharing silently |
| 6 | Recognition | 3 | good |
| 7 | Efficiency | 2 | ~450px job cards |
| 8 | Minimalist | 3 | 6 panels above the action; weight twice |
| 9 | Recovery | 3 | admin-cancel misread as signal |
| 10 | Help | 3 | clear |
| Total | | 27/40 | Good |

Verified: location setInterval 20s (foreground only); multiple active jobs allowed. Measurements: text all pass; stars 30px; desktop account 36px; 14–15px hints; 13px account sub-label.
Fixes → v2: honest location + paused state + Maps caption + ask at accept; sticky action bar + stage-ordered card; accept confirm sheet; states (admin cancel, two jobs, no vehicle, no date, notifications, loading, rating sent/failed, stale notification, receiver didn't pay); compact job cards; 16px body, 48px stars, confirm title, 4-stage driver stepper, "New jobs" naming.
