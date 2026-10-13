---
target: index.html
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/index.html"
target_fingerprint: "sha256:30c10d7481ea0756cc268b5dab158cc9f37dd0f0c25a0f5acf21ad99f2489958"
target_path: /home/orlux/Desktop/Sakada/sakada-web/index.html
timestamp: 2026-10-13T03-40-02Z
slug: sakada-web-index-html
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No fare/quote feedback; page ignores login state |
| 2 | Match System / Real World | 1 | European tractor + wind turbines; no ₱, km, kg anywhere |
| 3 | User Control and Freedom | 3 | Skip link, Esc/outside-click close menu |
| 4 | Consistency and Standards | 3 | Footer nav (Features/About) ≠ header nav (role pages) |
| 5 | Error Prevention | 2 | "Book a Delivery" lands on a register wall, even for logged-in users |
| 6 | Recognition Rather Than Recall | 3 | Clear labels, explicit role chips |
| 7 | Flexibility and Efficiency | n/a | Persuade page (note: Log In hidden in mobile menu) |
| 8 | Aesthetic and Minimalist Design | 3 | Lean; ghost SAKADA wordmark is noise; top ~45% of hero is dim photo |
| 9 | Error Recovery | 2 | offline.js not loaded on this page |
| 10 | Help and Documentation | n/a | Landing page |
| **Total** | | **19/32** | **Acceptable (59%)** |

## Design Specificity Verdict
Category-interchangeable. Ships Option A (dark photo + gradient + headline + CTA + 3 steps) — the exact default the Option B brief rejects. Only the headline is specific. Fare formula, 5 stages, nationwide, GCash/COD-coming all absent. Detector: 0 findings CLI and in-browser at 1440/390 (CSP index.html:14 blocks injection; bypassed in test browser only). Detector is clean because the problems are about missing product truth, not anti-pattern tells.

## Priority Issues
1. [P1] Fare and its logic invisible — add estimator/worked example in hero (₱150 + km×₱15 + kg×₱2, tabular nums). /impeccable shape
2. [P1] Wrong, generic visual world — tractor/turbines photo (index.html:107-112, og:image :50,:57); decide A vs B. /impeccable bolder or shape (Option B)
3. [P2] Five CTAs all go to register.html; "Book a Delivery" misleads; Log In hidden on mobile. /impeccable clarify
4. [P2] Below the fold has no proof — replace 3 generic steps with 5-stage row, nationwide line, payment (coming), closing CTA. /impeccable layout
5. [P3] Copy accuracy/resilience — "nearby" (index.html:214) unbacked; "from pickup" skips Pending (:222); hero aria-label; offline.js. /impeccable clarify, /impeccable harden

## Persona Red Flags
- Jordan: Book → account form, never sees a price; 5 buttons, one destination.
- Riley: no quote form to stress; offline → browser error page.
- Casey: ~330px dim photo before headline on 390px; Log In 2 taps; chips 14px at ≤360px.
- Vendor-owner (desktop): looks for price, coverage, payment, finds none.

## Minor Observations
15px nav/chip/footer labels; hero min(860px,100svh) pushes steps below fold; entrance translateY on hero content; legacy .stat-strip CSS in nav.css:336-365; title "No More Guesswork" unbacked by page.

## Questions to Consider
- Why must a visitor make an account before seeing a single peso?
- Would a bagsakan vendor recognise themselves with the name removed?
- Would "See your fare" convert better than "Book a Delivery"?
