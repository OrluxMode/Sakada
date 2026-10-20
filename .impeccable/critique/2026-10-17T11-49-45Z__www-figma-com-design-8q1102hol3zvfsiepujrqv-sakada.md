---
target: codex v1 vendor/farmer Figma Home desktop and mobile
total_score: 24
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
target_identity: "url:https://www.figma.com/design/8q1102hOL3ZvFsiePuJrQv/Sakada"
timestamp: 2026-10-17T11-49-45Z
slug: www-figma-com-design-8q1102hol3zvfsiepujrqv-sakada
closed: true
---
Method: dual-agent (A: /root/ux_design_review · B: /root/ux_evidence_review)

Target: codex v1 desktop (223:294) and mobile (224:451), Figma file 8q1102hOL3ZvFsiePuJrQv.
Scope: static vendor/farmer Home concepts; no Figma or application edits.

**Verdict: recognizably Sakada, but mobile needs a stronger attention hierarchy.**
Produce, Philippine routes, driver/plate details and receiver-paid cash fares make the design specific to this product. The dark/amber palette and established fonts remain coherent. This critique assesses the visible concept, not working application behavior.

**Design health: 24/36 — 67%, acceptable with improvements.** Scores are provisional design judgments, not usability-test results. Error recovery is unscored because no recovery state or executable flow was supplied.

| Heuristic | Score /4 | Finding |
|---|---:|---|
| System status | 3 | Current stage and update time visible; stale-location state absent. |
| Real-world match | 3 | Familiar produce/logistics language; weight-to-fare commitment could be clearer. |
| Control and freedom | 3 | Pending cancellation and rating dismissal visible; behavior unverified. |
| Consistency | 3 | Consistent visual language; shipment-detail affordances unclear. |
| Error prevention | 2 | Fare-before-confirm promise exists; confirmation and validation states unreviewed. |
| Recognition over recall | 3 | Route, driver, fare and recent delivery information visible. |
| Efficiency | 2 | Mobile tracking dominates; pending cancellation is far down the page. |
| Aesthetic/minimalism | 3 | Restrained and legible; excessive expansion slows scanning. |
| Error recovery | n/a | Static Home frames do not establish recovery behavior. |
| Help/documentation | 2 | Useful inline explanations; support is distant from active deliveries. |
| **Total** | **24/36** | **Acceptable; revise before implementation approval.** |

**What works**
- Lifecycle groups distinguish assignment from actual pickup; fare and vehicle details make a shipment accountable.
- Booking has a clear primary action and says the fare comes before confirmation.
- Measured text combinations have strong contrast: muted text on the panel is 8.84:1; CTA text on amber is 7.52:1. Mobile CTA is 350×48 and rating controls are 46×46 in the design.

**Priority issues**

1. **[P1] Mobile gives passive tracking priority over an expiring cancellation option.** The expanded in-transit card occupies roughly y422–1101; pending cancellation appears around y1499. A user withdrawing another shipment must scan unrelated details while a driver could accept it. **Fix:** make the status summary an explicit jump navigation, provide a compact active-shipment summary, and make pending cancellation reachable without traversing the map. Preserve tracking visibility. Suggested command: `/impeccable layout`.

2. **[P2] The fare commitment needs clearer wording at the booking boundary.** “A rough total is fine” sits beside per-kilogram pricing and an exact-booked-fare promise. That can leave a first-time sender uncertain about what the receiver owes. **Fix:** connect entered weight to the calculated booking fare, and carry the existing exact-fare/cash/tolls rule into the quote and confirmation design. Do not invent a reweighing or repricing policy. Those follow-up states are outside this Home concept, not proven broken flows. Suggested command: `/impeccable clarify`.

3. **[P2] Compact deliveries do not visibly explain how to see full details.** Assigned and waiting entries show summaries without an explicit detail action. Full addresses, pickup information and driver information are therefore less discoverable. **Fix:** use a consistent “View delivery” or clearly labeled expand action across shipment groups. This is an affordance issue; navigation failure was not tested. Suggested command: `/impeccable polish`.

4. **[P2] The map takes substantial space without geographic orientation.** Its abstract roads and pin do not identify a place or destination. The timestamp helps, but no stale/unavailable variant is shown. **Fix:** use representative labeled map content and define stale/unavailable location states; keep the map compact or expandable on mobile. Do not imply an ETA or distance from the segmented status bar. Suggested command: `/impeccable clarify`.

**Cognitive load and emotional journey:** Moderate. Status grouping works; mobile lacks progressive disclosure and puts a lengthy monitoring task ahead of another shipment's actionable state. The six booking fields would scan better grouped as Route, Load and When. Keep the familiar five-star scale. The greeting and fare promise reassure; the long journey to cancellation and support creates friction.

**Persona red flags**
- Busy repeat vendor: pending cancellation and repeat booking are deep in the mobile composition.
- First-time farmer: approximate-weight language leaves the fare commitment less clear.
- User needing accessibility support: text contrast and drawn bounds look sound, but keyboard, focus, semantics and screen-reader behavior remain unverified.

**Minor observations and limits:** Support sits near y1998 on mobile. Bottom navigation is laid out at the end of the tall frame, with no scrolling/fixed-navigation prototype; persistent availability is not established. Both frames have zero prototype reactions. No text bounding overflow was detected; four clipped map-road vectors were decorative false positives. Long-content wrapping, loading/empty/error states, mobile keyboard behavior and actual hit areas remain unverified.

**Detector evidence:** The real attempt against the exact Figma URL failed with HTTP 403 (exit 1); its empty array is not a clean scan. Native Figma screenshots and read-only node measurements supplied the evidence. No reliable DOM detector overlay or browser interaction validation was available.

**Questions to consider:** Should pending-request actions be immediately reachable while tracking stays compact? Which shipment details need to remain visible before expansion?
