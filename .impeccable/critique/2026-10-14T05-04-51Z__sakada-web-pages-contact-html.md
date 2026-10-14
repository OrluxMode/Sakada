---
target: contact page figma design
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/contact.html"
target_fingerprint: "sha256:1ec3bdb138740ee8382c83fa05898500d40c121590f61504ff114707002fd7f9"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/contact.html
timestamp: 2026-10-14T05-04-51Z
slug: sakada-web-pages-contact-html
---
Method: dual-agent (A: design review · B: detector + mechanical). Target: Figma Contact design (desktop 93:295, mobile 93:765), which will replace sakada-web/pages/contact.html.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 1 | No loading/success/error/focus states designed |
| 2 | Match System / Real World | 3 | Plain language; "Business partner" implies a programme that doesn't exist |
| 3 | User Control and Freedom | 2 | Farmer + "Booking a delivery" preselected; no "send another" |
| 4 | Consistency and Standards | 3 | Matches siblings; selected pill and focus would both be amber |
| 5 | Error Prevention | 2 | Defaults misfile messages; booking code is free text |
| 6 | Recognition Rather Than Recall | 2 | Never says where the SK- code is (My Deliveries) |
| 7 | Flexibility and Efficiency | 2 | No logged-in prefill, no entry from a booking |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; booking code mentioned 4 times |
| 9 | Error Recovery | 1 | No error state; current code says "email us directly" (no email exists) |
| 10 | Help and Documentation | 3 | Real inline Q&A, but after the form on mobile |
| Total | | 22/40 | Acceptable |

Specificity: mostly product-specific (the Q&A is built from the owner's rules); the form shell and "Get in touch." / "Send a message" are generic.
Detector (old contact.html): 2 warnings. low-contrast (placeholder/hint/disclaimer at 50% alpha = 3.11:1 on the real bg; still applies if forms.css is reused). pulsing-dot (removed by the redesign). Browser overlay skipped (Figma target).
Contrast of the design: all text passes (9.45 / 17.07 / 8.07 / 7.52). Input and tab borders 3.11:1, a pass by 0.11.

P0 States undesigned, and the code they'd inherit breaks owner rules: success "within 2 hours", error "email us directly"; contact.js still reads contactPhone, which throws once the field is removed; the JS resets the button to "Send Message"+arrow; aria-pressed isn't reset after send. → harden
P1 On mobile, "Before you write" comes after the Send button. → layout
P1 The booking answer skips self-cancel while Pending (Cancel request in My Deliveries) and never says where the code is; the overcharge answer assumes the receiver has the booking open. → clarify
P2 Preselected Farmer/Booking defaults and two overlapping classify questions; select options unspecified (the code has 5, incl. "Driver Application", which contradicts "No need to message us"). → distill
P2 Placeholder = body color (#b8b4a6), and the selected value looks like a placeholder; borders at the edge of 3:1; hint/disclaimer 14px < 16px rule; text links ~19px tall. → audit/polish

Personas: Jordan (two classify questions first; doesn't know the reply comes by email), Sam (pills should be a radio group; no required legend; errors not tied to fields), Casey (answers at the bottom; double-tap without a loading state; 2367px page), budget-Android farmer (14px text; overcharge answer assumes the wrong person).
Minor: tall empty desktop hero; Q heads compete with the card title; "It starts with SK-." reads awkwardly; footer links ≠ header.
Questions: Should this be "Help", answers first with the form as fallback? Should "Report a problem" live on the booking card with the code prefilled? What does the page do for someone being overcharged at drop-off right now?
