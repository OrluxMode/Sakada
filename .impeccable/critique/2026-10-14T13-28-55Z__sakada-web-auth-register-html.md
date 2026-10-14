---
target: signup page (Figma redesign)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/auth/register.html"
target_fingerprint: "sha256:1fad70d8eb332a20dfd140faa39f870d6a7e7e0c286a72cc688dc0023b3ceaed"
target_path: /home/orlux/Desktop/Sakada/sakada-web/auth/register.html
timestamp: 2026-10-14T13-28-55Z
slug: sakada-web-auth-register-html
---
Method: dual-agent (A: design review of Figma PNGs + code truth-check · B: Figma node measurements + detector baseline). Target: Figma page "signup" (file 8q1102hOL3ZvFsiePuJrQv): desktop 131:294, mobile 133:299, states 133:376. Proposed redesign of sakada-web/auth/register.html.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Offline/Google-opening/success drawn; "Creating account…" not |
| 2 | Match System / Real World | 3 | Plain copy + real fare; Farmer vs Vendor self-labelling unexplained |
| 3 | User Control and Freedom | 2 | No "wrong email? start over"; role permanent |
| 4 | Consistency and Standards | 3 | "truck details" vs dashboard "Your vehicle" |
| 5 | Error Prevention | 2 | Permanence note 14px grey right-aligned; typo-suggestion state not drawn |
| 6 | Recognition Rather Than Recall | 3 | Role descriptions + password rule up front |
| 7 | Flexibility and Efficiency | 3 | No ?role=driver variant |
| 8 | Aesthetic and Minimalist Design | 3 | Mobile double headline pushes form down |
| 9 | Error Recovery | 2 | Duplicate-email state can't trigger with current code |
| 10 | Help and Documentation | 2 | Nothing for farmer-who-sells; nothing if email never arrives |
| Total | | 26/40 | Acceptable |

Specific to Sakada now. Measurements: all text ≥4.5:1 (lowest Back to home 4.89 on photo); input/card borders 4.07:1; inputs/buttons 48–52px. Detector baseline on current register.html: [].

P0 Duplicate-email state impossible: register.js checks only `error`; with confirmation on, Supabase returns identities: [] and no error → false "Check your email". Fix: check identities.length === 0; humanise rate-limit error. → harden
P1 Success says "then log in" but callback.html signs in and opens dashboard; amber "Go to log in" leads to raw "Email not confirmed". Fix copy, role-specific next step, demote log-in link, add "Wrong email? Start over". → clarify
P1 Permanence note too quiet; doesn't say Farmer and Vendor get the same booking tools. Fix: 16px sentence under legend. → clarify
P2 Mobile hero + two display headlines push Create account to ~y=1000. Fix: thin band, one H1. → layout
P2 Missing states: empty-field errors, gmail.co suggestion, Creating account…, ?role=driver panel; offline and Google-opening merged. → harden
Minor: desktop Back to home 42px; "Log in instead" 18px link; mobile Vendor card taller; 14px note/hints.
