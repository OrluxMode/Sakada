---
target: "Home prototype http://localhost:4400/prototypes/home/"
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/prototypes/home/index.html"
target_fingerprint: "sha256:37ea57e0b2c1e8a7ef6ae0535a550ae867c2e744b92c415fea001ebd7bf50d36"
target_path: /home/orlux/Desktop/Sakada/sakada-web/prototypes/home/index.html
timestamp: 2026-10-20T08-29-23Z
slug: sakada-web-prototypes-home-index-html
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

Target: Home prototype, http://localhost:4400/prototypes/home/ (sakada-web/prototypes/home/). Operate mode. Prototype chrome (data switch, "only Home" toasts, single desktop column) excluded.

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Keep waiting gives no feedback; "Updated 9 min ago" beside "Location not shared yet" contradicts |
| 2 | Match System / Real World | 3 | Late card leans on SK-00012 instead of date + route |
| 3 | User Control and Freedom | 2 | "Not now" drops skipped drivers for good; closing the rate sheet mid-way loses sent ratings; no undo on Keep waiting |
| 4 | Consistency and Standards | 3 | Right vs down chevrons; outline vs solid red cancel; "Waiting" vs "Waiting for a driver" |
| 5 | Error Prevention | 3 | Cancel confirms; nothing warns that skipping is permanent |
| 6 | Recognition Rather Than Recall | 3 | Late card omits pickup date and route |
| 7 | Flexibility and Efficiency | 2 | One row open at a time; 3 taps per driver rating |
| 8 | Aesthetic and Minimalist Design | 3 | Closed rows ~160px; route repeated when open |
| 9 | Error Recovery | 2 | "Cancel and book a new date" has no rebook path |
| 10 | Help and Documentation | 3 | Good inline help (who pays, cancel rule, help link) |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity
Specific to Sakada: produce loads, real routes, plate/vehicle, real fare formula and cash-at-drop-off rule, pending-only cancel, incumbent Barlow/amber world. Detector: CLI clean (0); browser pass 1 hit, codex-grid-background on body.rq from css/requester.css:19 — the approved existing dashboard background, out of scope (false positive for this prototype). No console errors.

## Priority Issues
1. [P1] Skipped and interrupted ratings are lost (home.js nextRate clears toRate; sheet dismissal never commits). Fix: remove only rated drivers, keep skipped as "Rate 3 drivers"; commit each rating on Send. → harden
2. [P1] Late-pickup path dead-ends: copy promises a new date, Cancel only toasts. Fix: "Cancel and rebook" opens Book prefilled (goods, kg, route; date cleared). → clarify/onboard
3. [P2] Late card lacks context; Keep waiting silent. Fix: "Potatoes, 800 kg · Baguio → Santolan · pickup was Oct 16"; toast "Still open to drivers" + Undo; chip becomes neutral "Waiting past Oct 16". Owner fact needed: do drivers still see past-date requests? → clarify
4. [P2] Closed rows not really collapsed (~160px) and route repeats. Fix: one meta line "In transit · status updated 9 min ago"; drop duplicate route when open. → distill
5. [P2] 15px muted text below the 16px floor (route line, note, summary, rate names); 9px toast close. Fix: 16px, 44px close hit area; "Status updated" wording. → typeset/adapt

## Persona Red Flags
- Vendor at a market stall (budget Android, glare, interruptions): loses a sent rating when interrupted; 15px grey text washes out; ragged 3-line summary.
- Jordan (first-timer): unclear what Keep waiting does; can't link SK-00012 to the potatoes row; expects "Not now" drivers to come back.
- Alex (desktop owner): one row open at a time; ~12 taps to rate four drivers.

## Minor Observations
- Topbar shows lowercase raw name while greeting is capitalised.
- Pending row chip keeps shouting after Keep waiting.
- Map has no "as of" label on the image itself.
- Tapping the stepper of an open card closes it; easy to do by accident.

## Questions to Consider
- Should the most urgent row (the late one) auto-open in a busy account?
- Should rating prompts wait until no truck is moving?
- Is "Keep waiting" a real choice, or should it be "Pick a new date"?
