---
target: How It Works Figma design v4
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 0
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html"
target_fingerprint: "sha256:cc0d30f5a591e7727f3a8ef7e998b824b8dd3a25fe226c63701ce795358e9caf"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html
timestamp: 2026-10-13T09-25-55Z
slug: sakada-web-pages-how-it-works-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma How It Works v4 (desktop 35:301, mobile 37:389) refining sakada-web/pages/how-it-works.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Stage model clear; static page |
| 2 | Match System / Real World | 3 | "Estimated fare" vs what you hand the driver unclear |
| 3 | User Control and Freedom | 3 | No control described after Driver Assigned |
| 4 | Consistency and Standards | 3 | Pill chips vs rect ghost; amber = action + numerals + status |
| 5 | Error Prevention | 3 | Load guide, pay-driver note, cancel rule help; estimate vs final open |
| 6 | Recognition Rather Than Recall | 3 | Step 02 sends readers ~600px back up; stages shown 3× |
| 7 | Flexibility and Efficiency | n/a | Explainer page |
| 8 | Aesthetic and Minimalist Design | 3 | Stages ×3, ~20 rules, 3 identical Book buttons |
| 9 | Error Recovery | 2 | No driver / late / change after accept / dispute |
| 10 | Help and Documentation | 3 | Good Q&A; support is one small link |
| **Total** | | **26/36** | **Good (72%)** |

## Design Specificity Verdict
Words specific to Sakada, layout generic. Missed: a two-lane shared track (sender | stages | driver) that literally draws "you both see every step". Detector: 1 false positive. All text ≥7.5:1; no sentence text <16px. Fails 3:1: fare card border 2.09, band vs page 1.07. Rail now 5.08 (fixed).

## Priority Issues
1. [P2] Role steps disconnected from the status track; stages shown 3×. Fix: merge into one two-lane track. /impeccable layout + distill
2. [P2] Mobile fare order: formula → load Q&A → card. Fix: card right after the formula; Q&A below the card. /impeccable adapt
3. [P2] Trust gaps: driver paid exactly the booked fare? change after accept? what the sender learns about the driver (not shipped: the dashboard shows no driver name)? no driver accepts? Fix: owner answers, then a short "If something changes" block; Contact gets a real place. /impeccable clarify + harden
4. [P3] 3 identical Book buttons, 2 Sign up to drive, ~20 rules; staggered column CTAs. Fix: keep the fare-card + band CTAs; end-of-list → quiet links or drop. /impeccable quieter
5. [P3] Inline links ~17px tall (<44px). Fix: padded block links / ghost button for Contact. /impeccable adapt

## Persona Red Flags
Jordan: estimate vs pay; "Rate the service" whom?; ✕ looks like a close button. Casey: first primary action ~2.6 screens down on mobile; the fare link scrolls up. Riley: can the final price differ?; heavier-than-declared load?; does Sakada take a cut? Vendor: renegotiation fear at drop-off; "harvest" speaks to farmers.

## Minor Observations
Sending 03 line 80 chars; orphans "list." / "immediately." in driving 02/03; red ✕ → status-style dot; amber Driver Assigned dot = CTA amber; columns drift row by row; "Jump to your part:" label optional; legend dots look like filter chips.

## Questions to Consider
Two-lane shared track? Is the driver paid exactly the booked fare (make it the boldest line)? Live fare calculator?
