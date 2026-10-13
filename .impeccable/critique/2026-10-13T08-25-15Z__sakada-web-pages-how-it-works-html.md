---
target: How It Works Figma design
total_score: 21
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html"
target_fingerprint: "sha256:cc0d30f5a591e7727f3a8ef7e998b824b8dd3a25fe226c63701ce795358e9caf"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html
timestamp: 2026-10-13T08-25-15Z
slug: sakada-web-pages-how-it-works-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma design (desktop 35:301, mobile 37:389) refining sakada-web/pages/how-it-works.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Current page is shown in the nav; stages are only named in prose, and Pending/Cancelled are missing |
| 2 | Match System / Real World | 3 | Plain language, ₱/km/kg; no local cues |
| 3 | User Control and Freedom | 2 | Drivers have no action; no way to jump to your own role on mobile |
| 4 | Consistency and Standards | 2 | "1" vs landing "01"; one price called cost/fare/fee; CTA goes to for-farmers, not register |
| 5 | Error Prevention | 2 | The fare caveat helps; nothing on no-driver, cancel, or payment |
| 6 | Recognition Rather Than Recall | 3 | Quoted status names match the app |
| 7 | Flexibility and Efficiency | n/a | Static explainer page |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, but 9 identical rows and a 532×294px dead block |
| 9 | Error Recovery | 1 | No failure paths explained (no driver, cancel) |
| 10 | Help and Documentation | 2 | The page is the help but skips payment/cancel/account; no Contact link near the steps |
| **Total** | | **21/36** | **Acceptable (58%)** |

## Design Specificity Verdict
Mostly category-interchangeable (hero, two numbered lists, CTA band). The one authored element is the sample-fare receipt in sender step 2. Missed: the shared status chain, the page's core promise, is never drawn. Detector: 1 finding, flat-type-hierarchy, a false positive (style.css @imports not followed). No overlay, because the CSP blocks injection.

## Priority Issues
1. [P1] Drivers get no next step; vendors are sent to For Farmers. Fix: a per-column action (Book a Delivery → register?role=farmer/vendor; "Sign up to drive" → register?role=driver in the empty driver space). /impeccable clarify + layout
2. [P1] The fare receipt is below the type floor (rows ~14px, caption 13px, caveat 12px; PRODUCT.md requires 16px+). Fix: rows 16px / 28px row height, caveat 15–16px. /impeccable typeset
3. [P2] The shared status is told, never shown; 9 rows have identical weight; small numerals. Fix: a 5-stage strip with sender-/driver-triggered marks; 40px "01" numerals like the landing. /impeccable bolder
4. [P2] One price, three names (cost/fare/fee); no cancel or payment info. Fix: use "fare" everywhere; a line under step 3 that you can cancel while Pending (it ships); "GCash or COD: coming soon". /impeccable clarify
5. [P2] Mobile: drivers scroll ~1,200px of sender steps; the only CTA is at the bottom. Fix: "I'm sending goods / I'm driving" anchor chips under the hero. /impeccable adapt

## Persona Red Flags
Jordan: account needed? "Base fare" unexplained; no wait-time expectation. Casey: no role jump; fare text 12–14px outdoors. Riley: landing says 5 stages, this page names 4; cost/fare/fee; no weight limit. Marites (vendor owner): "Book a Delivery" lands on For Farmers; no payment or cancel info.

## Minor Observations
Desktop hero right half empty; unequal columns 684/532; 88px number gutter; sender lines 81–90 chars (driver 59–63); orphan "go." in step 1; CTA band #14150f barely separates from the page; rect CTA vs pill nav buttons; "If you're driving (driver)" repeats itself. In code: h3 asks for Barlow 700 but the inner pages load 600/800/900 from Google Fonts (not self-hosted like the landing). Mobile footer tap targets are already 44px in code (Figma clone only).

## Questions to Consider
Should the status chain be the page's main visual? One door or two at the end? Does a driver see the same ₱2,875?
