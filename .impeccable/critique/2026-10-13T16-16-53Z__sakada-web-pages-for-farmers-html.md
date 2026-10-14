---
target: For Farmers polish (Figma)
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 1
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html"
target_fingerprint: "sha256:90cb8eb8d776fcd62e806a66049b9fcc54c2360212d365beb6e91c951d0e7bd2"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/for-farmers.html
timestamp: 2026-10-13T16-16-53Z
slug: sakada-web-pages-for-farmers-html
---
Method: dual-agent (A: design review · B: detector + measurements). Target: Figma "for farmers polish" (desktop 59:314, mobile 59:476) replacing sakada-web/pages/for-farmers.html.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Status model explained well |
| 2 | Match System / Real World | 3 | "Estimated fare" vs "set when you book" |
| 3 | User Control and Freedom | 3 | After-assigned changes unaddressed |
| 4 | Consistency and Standards | 3 | Sample "Book again" styled like a real CTA; amber overloaded; Log In / Log in |
| 5 | Error Prevention | 3 | Account notice up front; payment timing open |
| 6 | Recognition Rather Than Recall | 3 | Stage strip two sections from the cards |
| 7 | Flexibility and Efficiency | n/a | Persuade page |
| 8 | Aesthetic and Minimalist Design | 3 | Dead space in the fare left column and inside cards 1/3; close repeats card 3 |
| 9 | Error Recovery | 2 | No-show / damage / accountability unaddressed |
| 10 | Help and Documentation | n/a | Persuade page |
| **Total** | | **23/32** | **Good (72%)** |

## Design Specificity Verdict
Content specific (one delivery story across the 3 dashboard cards, receipt, honest copy); composition still generic. Detector: 1 false positive. Text ≥7:1 everywhere. Below 3:1: depicted card border 2.30, pill borders 2.6–2.9, band 1.07. **Verified in Chrome: ₱ (U+20B1) and → are not in the bundled woff2 (incl. latin-ext); they fall back to system fonts** (also affects the live How It Works).

## Priority Issues
1. [P1] Trust section skips "who is this driver / what keeps them accountable" (ratings ship but aren't mentioned); payment timing unanswered. /impeccable clarify
2. [P2] "Estimated fare" contradicts "set when you book". Fix: "Fare for this trip" + "Locked in when you book". /impeccable clarify
3. [P2] Sample cards read as live UI (clickable-looking Book again); equal heights leave filler; the live dot is off the route. /impeccable polish
4. [P2] Stage strip in the wrong section and duplicates How It Works. Fix: use the stages as the spine above the 3 cards. /impeccable layout
5. [P2] Mobile text links <44px; 2,625px between Book buttons on mobile. /impeccable adapt

## Persona Red Flags
Jordan: taps the sample Book again; amber IDs look like links. Casey: small links, long CTA gap, 13px card meta. Riley: cancel after assigned? no-show? fare change? when to pay? Mang Ruben: trusts people; no ratings shown; in-app notifications need saying "check the app".

## Minor Observations
Hero padding off-rhythm (96/62 vs ~76); heading→body gap 27 vs 23; FAQ columns 3–6px off the card grid; primary buttons at three x positions; "The fare is set when you book." period; kicker-like "The stages you'll see, in order"; close subline repeats card 3; fare card line 80 chars.

## Questions to Consider
Put the SK-00142 card in the hero? End on trust, not repeat convenience? Drop the stage strip and show stages through the cards?
