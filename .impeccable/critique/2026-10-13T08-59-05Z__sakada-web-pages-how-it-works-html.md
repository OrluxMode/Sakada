---
target: How It Works Figma design v2
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html"
target_fingerprint: "sha256:cc0d30f5a591e7727f3a8ef7e998b824b8dd3a25fe226c63701ce795358e9caf"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html
timestamp: 2026-10-13T08-59-05Z
slug: sakada-web-pages-how-it-works-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma How It Works v2 (desktop 35:301, mobile 37:389) refining sakada-web/pages/how-it-works.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | All 5 stages shown; the rail line is 1.32:1 and nearly invisible |
| 2 | Match System / Real World | 3 | "Three people" headline vs two parties in the product |
| 3 | User Control and Freedom | 3 | Jump chips + cancel rule; long mobile page |
| 4 | Consistency and Standards | 3 | Matches the landing button system; Picked Up teal vs app blue (until the pill tokens ship) |
| 5 | Error Prevention | 3 | Fare logic + honest "coming soon" |
| 6 | Recognition Rather Than Recall | 3 | Status names match the dashboard |
| 7 | Flexibility and Efficiency | n/a | Explainer page |
| 8 | Aesthetic and Minimalist Design | 3 | ~540px void under the driver column; 11 amber numerals dilute the CTA amber |
| 9 | Error Recovery | 2 | Only cancel covered; no-driver / after-assigned unaddressed |
| 10 | Help and Documentation | 3 | Contact band; "how do I pay today?" open |
| **Total** | | **26/36** | **Good (72%)** |

## Design Specificity Verdict
Content is specific to Sakada (status rail, cancel rule, fare receipt); the structure is generic. No agri/truck/PH visual cue apart from ₱. Detector: 1 false positive (flat-type-hierarchy, @imports not followed). Contrast: all text ≥8:1; dots ≥5:1. Overlay unavailable (CSP).

## Priority Issues
1. [P1] Desktop columns unbalanced: ~540px void under drivers, CTAs at different heights. Fix: pull the fare receipt into a full-width band between the rail and the roles; CTAs on a shared baseline. /impeccable layout
2. [P1] No reassurance at "wait for a driver". Fix: step 03 "We'll notify you the moment a driver accepts. You don't need to keep this page open." /impeccable clarify
3. [P2] Headline "three people" vs two parties. Fix: "You book it. A driver takes it. You both see every step." (owner's copy, ask first). /impeccable clarify
4. [P2] Fare footnotes/example at 15px (<16px); "estimated" vs "real fare" ambiguity. Fix: all 16px; "Your estimate uses the road distance from the map, not a straight line." /impeccable typeset
5. [P2] First booking CTA at 87% of desktop height; ends on a support prompt. Fix: Book a Delivery under the receipt total; closing band primary Book + ghost Contact. /impeccable shape

## Persona Red Flags
Jordan: "three people"; "The driver marks it" ×3. Casey: 4,480px page; no divider between sender CTA and driver section on mobile; orphan "next.". Riley: estimated vs real; no-driver case; teal vs app blue; landing step order differs. Mang Ramon: fare footnotes smallest; rail line invisible in sun; nothing says produce.

## Minor Observations
Rail left-heavy; "Goods loaded / On the road / Arrived"; Cancelled ring reads like a 6th stage; 6px gap under the H2 sub-labels; band 1.07:1 vs page; hero lede top not aligned to the h1 cap; mobile footer "Contact" orphan, ~20px footer hit area; step 01 "roughly when" → "the pickup date" (required in the form).

## Questions to Consider
Receipt as hero? Follow one delivery end to end? How do people pay today?
