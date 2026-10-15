---
target: farmer/vendor dashboard Figma redesign
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html"
target_fingerprint: "sha256:6fc66f59167df86d0593ef906db2bceef16735a7b7e2c20707e420a984b77503"
target_path: /home/orlux/Desktop/Sakada/sakada-web/dashboard/farmer/index.html
timestamp: 2026-10-14T14-46-30Z
slug: sakada-web-dashboard-farmer-index-html
---
Method: dual-agent (A: design review + code truth-check · B: Figma measurements + detector baseline). Target: Figma page "dashboards" (149:294) farmer/vendor frames 149:295, 150:294, 150:375, 151:294, 151:359, 150:503.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Pending under "On the way"; no loading frames |
| 2 | Match System / Real World | 3 | "Step 1 of 5 · Pending"; "receiver" undefined |
| 3 | User Control and Freedom | 2 | Book again tile no target; cancel confirm not designed |
| 4 | Consistency and Standards | 2 | tiles/tabs/links duplicate; Assigned vs Driver Assigned |
| 5 | Error Prevention | 3 | stale quote not designed |
| 6 | Recognition Rather Than Recall | 3 | cards carry the facts |
| 7 | Flexibility and Efficiency | 2 | no history filter |
| 8 | Aesthetic and Minimalist Design | 3 | status said 3×; map too tall |
| 9 | Error Recovery | 1 | no error states |
| 10 | Help and Documentation | 2 | why Cancel disappears |
| Total | | 24/40 | Acceptable |

Unbacked: "1 delivered this week" (drop); delivered/cancelled dates (use updated_at); pickup date + email (small build); map "last updated" (updated_at).
Measurements: text contrast all pass; targets ≥44 except text links; tab indicator clipped (invisible); stepper inactive 1.45:1; 13px tab labels/chips; Deliveries last card under tab bar.
P0 states frame; P1 notifications sheet + real stats; P1 IA (Waiting vs On the way, Past deliveries filters, named Book again); P2 stepper one line + Pending waiting + vocabulary + 3:1 + map fallback; P2 ergonomics (14px+, From/To, help row 48, tab indicator, sticky confirm); P3 who-pays copy.
