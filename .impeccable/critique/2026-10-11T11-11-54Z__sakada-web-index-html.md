---
target: landing page
total_score: 18
max_score: 36
na_heuristics: 7
p0_count: 1
p1_count: 3
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/index.html"
target_fingerprint: "sha256:8167a114e1901195c0b398d8ba1e3537748c9304097827b04afad3b928712772"
target_path: /home/orlux/Desktop/Sakada/sakada-web/index.html
timestamp: 2026-10-11T11-11-54Z
slug: sakada-web-index-html
---
Method: dual-agent (A: design review · B: detector + headless browser)

## Design Health Score: 18/36 (50%, Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No current-page indicator; hero content hidden at opacity 0 until a 0.7s fade-in finishes |
| 2 | Match System / Real World | 2 | Headline speaks the farmer's language; hero photo is a European tractor with wind turbines |
| 3 | User Control and Freedom | 2 | Mobile menu: no Esc or outside-click close, ☰ never becomes ✕ |
| 4 | Consistency and Standards | 1 | "Book a Delivery" goes to 3 different places; "Register as a Driver" opens login |
| 5 | Error Prevention | 2 | Vendors and drivers get funnelled into farmer content |
| 6 | Recognition Rather Than Recall | 2 | No sign-up link on the landing page; only on the login page |
| 7 | Flexibility and Efficiency | n/a | Single-screen persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained type and palette; ghost wordmark and filler stats are decoration |
| 9 | Error Recovery | 2 | Little to recover from on this page |
| 10 | Help and Documentation | 2 | No FAQ, pricing, coverage area, or phone/Messenger contact |

## Design Specificity Verdict
Mostly interchangeable. The headline and "stop calling around for a ride" are specific to the product. The dark photo with a gradient, outlined ghost wordmark, split headline/CTA layout and 4-up stat strip could front any logistics startup. The hero photo shows a European tractor with wind turbines, and its aria-label describes a truck that isn't in the image. Nothing is localised: no Tagalog, no ₱, no provinces, and "Sakada" is never explained.
Detector: index.html 0 findings (it does not follow the @import links). The css/ directory scan found 4 side-tab findings (toast borders, not on this page). The 1440px rendered scan found 5 low-contrast nav links (2.5 to 3.7:1), all confirmed. No false positives. Browser overlay skipped: no tool could inject a script into a live page.

## Priority Issues
- [P0] The CTA breaks its promise: "Book a Delivery" goes to how-it-works, then for-farmers, then login, then register. The landing page has no sign-up link. Fix: link to auth/register.html with a role param and add Sign up next to Log in. /impeccable clarify + /impeccable harden
- [P1] Hero image is off-locale and its alt text is false. Fix: use a Filipino truck/produce photo and make the aria-label match. /impeccable bolder (asset from the user)
- [P1] Nav links fail contrast, 2.5 to 3.7:1 over bright sky (nav.css:34-38). Fix: use cream text or a scrim behind the nav. /impeccable polish
- [P1] No role self-sorting on the main surface. Fix: add three "I'm a farmer / vendor / driver" entry points that go straight to register. /impeccable layout
- [P2] Stat strip is filler ("3 roles", "1 booking"); no proof and no answers on price, coverage or payment. /impeccable clarify

## Persona Red Flags
Jordan: doesn't know what Sakada means or whether it covers their province; the CTA opens an explainer; never sees "Sign up".
Riley: CTA destinations differ across pages; "Register as a Driver" opens login; aria-label doesn't match the image; header and footer nav differ.
Casey: downloads the 736KB desktop hero (hero-mobile.jpg is unused); headline invisible until the animation runs; role links hidden behind ☰.

## Minor Observations
Stale dev comment at index.html:39; 8% ghost wordmark adds noise; amber dot on Log In imitates a primary action; 13 to 15px body/label text; footer link margin-left causes wrap indent.

## Questions to Consider
Would a Nueva Ecija farmer recognise their road in the photo? Why does "One Booking" take four clicks to reach sign-up? Tagalog/Taglish first?
