---
target: signup page
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/auth/register.html"
target_fingerprint: "sha256:1fad70d8eb332a20dfd140faa39f870d6a7e7e0c286a72cc688dc0023b3ceaed"
target_path: /home/orlux/Desktop/Sakada/sakada-web/auth/register.html
timestamp: 2026-10-14T13-17-25Z
slug: sakada-web-auth-register-html
---
Method: dual-agent (A: design review · B: detector + browser evidence). Live register page at 1440x900 and 390x844; empty submit, gmail.co / gmial.com typo, ?role=driver.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Google button has no busy state; success clears the form, leaves a small banner |
| 2 | Match System / Real World | 2 | Farmer/Vendor/Driver unexplained; raw Supabase error text |
| 3 | User Control and Freedom | 2 | Role is permanent (migration 0006) and nothing says so; no show-password |
| 4 | Consistency and Standards | 3 | Buttons render in system font (no font:inherit); "Create Account" Title Case |
| 5 | Error Prevention | 3 | Typo guard excellent; 8-char rule hidden until failure |
| 6 | Recognition Rather Than Recall | 2 | Must recall what "vendor" means; password rule not shown |
| 7 | Flexibility and Efficiency | 2 | Google + autocomplete + ?role= preset good; no password reveal |
| 8 | Aesthetic and Minimalist Design | 3 | Clean but generic floating card; 284px usable at 390 |
| 9 | Error Recovery | 3 | Inline errors/focus/one-tap fix good; server errors detached, no "Log in instead" |
| 10 | Help and Documentation | 1 | No role help, no "what happens next", confirm-email step is a surprise |
| Total | | 23/40 | Acceptable |

Specificity: category-interchangeable. Detector: CLI [] and browser "No anti-patterns found" at both sizes (CSP blocked plain injection; ran with bypassCSP in Playwright).
Correction vs 09:02 run: inputs measure 39px / 14px, not ~44px.

P1 Permanent role choice looks trivial (37px, 13px, 1.31:1 border) and is unexplained; Farmer and Vendor share one dashboard. Fix: radio cards with one-line descriptions, "I am a…" label, can't-change note. → clarify + layout
P1 Below size floors: inputs 39px/14px, tabs 37px/13px, labels 13px, divider 12px, buttons in system font. Fix: ≥48px/16px, labels 14–15px, button{font:inherit}, trim mobile card padding. → adapt + typeset
P1 Field boundaries fail WCAG 1.4.11: input bg = card bg, border 1.36:1. Fix: inputs on #0b0c09 with ≥3:1 border. → harden
P2 Server errors raw and detached; "already registered" has no Log in path; no offline copy; no Google busy state. → harden + clarify
P2 Rules hidden up front, flat end: add "At least 8 characters", show/hide, "we'll email a link" pre-submit, success panel with next step. → clarify

Personas: Mang Lito (farmer who also sells; Farmer vs Vendor, permanent); Casey (budget Android outdoors; small targets, vanishing edges); Jordan (surprised by email confirm); Sam (toggle buttons not radiogroup; Google busy not announced).
Minor: subtitle orphan "do." at 390; input focus is a faint 1px border; email error doesn't refresh while typing after empty submit; logo is the only way home.
Questions: merge Farmer/Vendor at signup? Is email the right front door for farmers? Should drivers get their own signup path?
