---
target: How It Works Figma design v3
total_score: 26
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html"
target_fingerprint: "sha256:cc0d30f5a591e7727f3a8ef7e998b824b8dd3a25fe226c63701ce795358e9caf"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html
timestamp: 2026-10-13T09-08-26Z
slug: sakada-web-pages-how-it-works-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma How It Works v3 (desktop 35:301, mobile 37:389) refining sakada-web/pages/how-it-works.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Static timeline; rail 2.74:1 |
| 2 | Match System / Real World | 3 | "Cancelled is not a stage" reads like developer jargon; "takes" vs "accepts" |
| 3 | User Control and Freedom | 3 | No way back to the role switch on a 5,042px mobile page |
| 4 | Consistency and Standards | 3 | Footer nav ≠ header nav; amber status dot = CTA amber |
| 5 | Error Prevention | 3 | The payment line is ambiguous at the CTA |
| 6 | Recognition Rather Than Recall | 3 | "like the example above" breaks for jump-link users |
| 7 | Flexibility and Efficiency | n/a | Explainer page |
| 8 | Aesthetic and Minimalist Design | 3 | Story told 3 times; 608×289px void under drivers |
| 9 | Error Recovery | 2 | No-driver / after-assigned unaddressed |
| 10 | Help and Documentation | 3 | No short answers for payment / no driver / truck size |
| **Total** | | **26/36** | **Good (72%)** |

## Design Specificity Verdict
Content is specific to Sakada (fare receipt, real stages, cancel rule); the layout is a standard template. Detector: 1 false positive (flat-type-hierarchy). All text ≥7.5:1; no sentence text under 16px. Below 3:1: the rail line 2.74, the card border 1.32, the band vs page 1.07. Header Sign up 42px on mobile.

## Priority Issues
1. [P1] Payment line ambiguous at the CTA ("COD coming soon" reads as "no way to pay today"). Fix: "In-app payment (GCash or cash on delivery) is coming soon." + the owner states the current arrangement. /impeccable clarify
2. [P2] Step 03 "notify" implies SMS; the no-driver case is silent. Fix: "You'll get a notification in Sakada the moment a driver accepts. Until then your booking stays Pending, and you can cancel it any time." /impeccable clarify
3. [P2] Story told three times; "like the example above" skipped by the jump link. Fix: step 02 one line + anchor link to the fare section; status dots beside the stage names in the steps. /impeccable distill
4. [P2] Flat layout; 608×289px void under the driver column (caused by the baseline alignment); fare left column floats. Fix: CTA directly under each list; top-align the fare text; stronger rail (accent line, bigger dots). /impeccable layout
5. [P3] Closing band speaks only to senders. Fix: add "Sign up to drive". /impeccable clarify

## Persona Red Flags
Jordan: "Cancelled is not a stage"; how do I pay; where does Book lead when logged out. Casey: no role switch after the hero; drivers scroll past the sender section. Riley: no-driver case; cancel after assigned; estimate final?; notify how? Aling Nena: payment and truck capacity unanswered; expects an SMS.

## Minor Observations
Fare intro 89 chars/line; orphan "time." in sender step 05; teal/blue dots close in hue (labels carry meaning); the formula appears twice; band 1.07:1; mobile footer "Contact" orphan; header Sign up 42px.

## Questions to Consider
One traced booking instead of three tellings? A fare calculator? What happens with money today?
