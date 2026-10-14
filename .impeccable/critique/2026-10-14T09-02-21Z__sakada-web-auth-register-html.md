---
target: register page critique (desktop 1440x900, mobile 390x844, error/typo states)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/auth/register.html"
target_fingerprint: "sha256:1fad70d8eb332a20dfd140faa39f870d6a7e7e0c286a72cc688dc0023b3ceaed"
target_path: /home/orlux/Desktop/Sakada/sakada-web/auth/register.html
timestamp: 2026-10-14T09-02-21Z
slug: sakada-web-auth-register-html
---
Method: dual-agent (A: design review · B: detector + mechanical). Target: live register page at http://127.0.0.1:3000/sakada-web/auth/register.html — desktop 1440x900, mobile 390x844, empty-submit error state, gmail.co typo state.

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Creating-account label swap works; Google click gives no pending state before redirect; success message is text-only, no check icon |
| 2 | Match System / Real World | 3 | "Choose the account type that fits what you do" is good; Farmer/Vendor/Driver mean nothing to a first-time visitor — no one-line explanation of each |
| 3 | User Control and Freedom | 3 | Role preserved across errors and URL ?role= preset is smart; no password show/hide, so a typo means retyping blind |
| 4 | Consistency and Standards | 3 | Shares auth card with login; role tabs are buttons-in-a-group, not a radiogroup — no arrow-key semantics |
| 5 | Error Prevention | 3 | gmail.co blocked with one-tap fix is excellent; password rule (8 chars) only revealed after failing; no strength cue |
| 6 | Recognition Rather Than Recall | 2 | Nothing on the page says why to pick one role over another, or that the role decides which dashboard you land in |
| 7 | Flexibility and Efficiency | 3 | Google path skips the form entirely (good for returning users); form has no autofill friction (name/email/new-password all wired) |
| 8 | Aesthetic and Minimalist Design | 3 | Clean single-card layout; desktop card floats in a large empty field with no brand context; mobile card padding (36/32px) wastes scarce width |
| 9 | Error Recovery | 4 | Inline per-field errors with aria-describedby, first-invalid focus, clear-on-fix, "Use name@gmail.com" one-tap — textbook |
| 10 | Help and Documentation | 2 | No password requirement text, no "what happens after I sign up" (email confirmation only revealed post-submit via success copy) |
| Total | | 29/40 | Good; recovery is strong, prevention/context weak |

Detector: `impeccable detect` at 1440x900 and 390x844 → **[] (no findings)**. Page loads with no console/page errors; CSP present; noindex set.
Contrast: everything passes on the real bg; field-error text #f2a98a and amber fix-link on #151512 are fine; muted labels #b8b4a6 pass.
Sizes: inputs ~44px; submit/Google buttons ~46–48px; **role tabs ~38px tall (10px+10px padding + 13px line)** — under the 44px floor the detector did not flag because they are text-labeled controls; still worth padding to 12px for touch.
Verified/rejected: "errors are only color-coded" is REJECTED — each red border is paired with a visible message under the field. "Focus is lost after failed submit" is REJECTED — validateFields focuses the first invalid input (field-errors.js:59).

P1 Role tabs carry no explanation; a farmer and a vendor see an identical form with zero guidance on which to pick. → clarify
P1 Password rule (8+ characters) appears only after failure; show it as a hint under the field (and optionally a show/hide toggle). → harden
P1 Google button gives no pending feedback between click and redirect. → harden
P2 Mobile card keeps desktop padding (36px 32px); trim to ~20px horizontal at small widths to stop the near-full-bleed look. → layout
P2 Role control should be a radiogroup (role=radiogroup, arrow keys, roving tabindex) rather than aria-pressed buttons. → adapt
P3 Success state is a green banner + form reset; consider redirecting to login with a "check your email" flash instead of stranding the user on a cleared form. → adapt
P3 Desktop: vast empty surround — a quiet brand line or illustration beside/above the card would fill the void without cluttering the form. → layout

Personas: Marisol the farmer (doesn't know if she's a "vendor" too; picks Farmer by default and hopes); Kiko the driver on a cheap Android (password typo, no show/hide, retypes 8 chars); Anna from the landing "For drivers" page (lands with ?role=driver preset — works, but she can't tell it's preselected beyond the amber outline).

Minor: form.reset() does not reset the role tabs, so a re-submit after success would silently reuse the old role while the form looks blank; error banner (formMessage) and per-field errors can both show at once and compete; "or" divider is 12px muted — fine, but sits close to a full-width button pair.
Questions: Should the role be locked once the account exists (it is — role is registration-only)? Add a password-strength meter, or is 8-chars-enough the product rule? Should "Log in" link pass the selected role back to login for a smoother loop?
