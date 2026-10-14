---
target: contact figma design round 2 (desktop, mobile, states)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/contact.html"
target_fingerprint: "sha256:1ec3bdb138740ee8382c83fa05898500d40c121590f61504ff114707002fd7f9"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/contact.html
timestamp: 2026-10-14T05-19-16Z
slug: sakada-web-pages-contact-html
---
Method: dual-agent (A: design review · B: detector + mechanical). Target: Figma Contact design round 2: desktop 93:295, mobile 93:765, states board 103:306 (replaces sakada-web/pages/contact.html).

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | All states exist; "locked" fields during Sending look editable |
| 2 | Match System / Real World | 3 | "Business partner" vs "Partnering with Sakada" name one idea two ways |
| 3 | User Control and Freedom | 3 | Message kept on failure, Send another; can't un-pick a role chip |
| 4 | Consistency and Standards | 2 | States 4/5 have topic "A booking I made" but no Booking code field; spec note styled like UI text |
| 5 | Error Prevention | 3 | Role/topic required-or-optional not marked |
| 6 | Recognition Rather Than Recall | 3 | Code must be copied from My Deliveries |
| 7 | Flexibility and Efficiency | 2 | No prefilled entry from a delivery card; no jump to the form on mobile |
| 8 | Aesthetic and Minimalist Design | 3 | Tall generic desktop hero |
| 9 | Error Recovery | 3 | Human errors; no invalid-email state |
| 10 | Help and Documentation | 3 | Fare answer omits "receiver pays cash at drop-off" |
| Total | | 28/40 | Good (up from 22) |

Detector (old contact.html): low-contrast (rgba placeholder/disclaimer, 3.11:1 on the real bg; the redesign removes it, and the build must replace the global forms.css placeholder); pulsing-dot (removed). Overlay skipped (Figma target).
Contrast: everything passes except "Sending…" label at 60% opacity (3.38, disabled-exempt; keep the label full opacity) and the "value:" annotation on the highlighted menu row (3.93, must not ship).
Sizes: all controls ≥44px (menu options ~52px); text links need a 44px hit area (room exists). Text ≥16px except 15px labels/errors (spec).
Verified/rejected: Reviewer A's claim that "cancel until pickup" is unconfirmed is REJECTED. 0007_valid_status_transitions allows cancelled only from pending/driver_assigned.

P1 Booking code field missing in states 4/5 while the topic is "A booking I made"; the "Shown only when…" note reads as UI copy. → harden
P1 Role and topic not marked optional; no error for them in state 3; no invalid-email error. → clarify
P2 Mobile form starts ~1050px down; add a "Write to us" jump link under the lede. → adapt
P2 Fare answer omits receiver-pays-cash; sent follow-up "same booking code" is wrong for non-booking topics. → clarify
P3 Desktop hero tall and generic ("Get in touch."); tighten 60-80px, consider "Questions about a delivery?". → layout/typeset

Personas: Jordan (unclear if role is required; Driver + "A booking I made" combo), Sam (desktop order is form before answers; focus after a failed submit unspecified), Casey (form far below the fold; no progress on a slow send), budget-Android user (copying the SK code across pages).
Minor: "value:" annotations must not ship; FAQ column longer than the card; disclaimer could be muted beside the CTA.
Questions: "Report a problem" on each delivery card with the code prefilled? Infer role when logged in? FAQ before the form on desktop too?
