---
target: How It Works grid background trial
total_score: 21
max_score: 32
na_heuristics: 7,9
p0_count: 0
p1_count: 2
target_identity: "file:/home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html"
target_fingerprint: "sha256:ac9655b80980e62bfcaee81771dabd2fc2a23852b683541ee5bb75f6a8940e25"
target_path: /home/orlux/Desktop/Sakada/sakada-web/pages/how-it-works.html
timestamp: 2026-10-14T06-52-59Z
slug: sakada-web-pages-how-it-works-html
---
Method: dual-agent (A: design review · B: detector + mechanical). Target: 32px cream graph-paper grid background trial on How It Works (Figma 110:334 / 110:512; also live page with grid.css injected).

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Timeline clear; grid doesn't touch it |
| 2 | Match System / Real World | 2 | Copy speaks palengke; backdrop speaks dev-tool (reference is an AI/dev directory) |
| 3 | User Control and Freedom | 3 | Unaffected |
| 4 | Consistency and Standards | 2 | One page only; grid (1.10:1) nearly as strong as real dividers (1.25:1) |
| 5 | Error Prevention | 3 | Unaffected |
| 6 | Recognition Rather Than Recall | 3 | Unaffected |
| 7 | Flexibility and Efficiency | n/a | Read-only explainer |
| 8 | Aesthetic and Minimalist Design | 2 | Information-free texture; section rules miss grid lines by 2-11px (y894 vs 896 doubled rule) |
| 9 | Error Recovery | n/a | No inputs |
| 10 | Help and Documentation | 3 | The page is the help |
| Total | | 21/32 | Acceptable (66%) |

Detector: static 1 pre-existing (cramped-padding on .hiw-close, likely false positive, not reproduced live); live overlay with grid injected: no anti-patterns (CSP bypass needed for the overlay only; CSP img-src allows data: so the grid loads in production).
Contrast: text barely affected (muted 9.45→7.60 worst on a crossing pixel; amber 6.49). Grid line 1.10:1, crossing 1.24:1; invisible in glare/low-end LCD; visible on OLED in dim rooms.
DPR: PNG tile crisp only at 1x; at 2x/3x bilinear blur (line ~1.06:1). Use a CSS linear-gradient or SVG.
Alignment: on-grid at 1440 (64/768/800/1376); 20px mobile gutter and the 5vw fluid gutter are off-grid; section tops never on grid (fractional px).
Covers the grid: nav (#0b0c09, abrupt stop), hiw-close (#14150f), hero chips (#0b0c09 patches), buttons. Fare card is TRANSPARENT in the live CSS (verified pages.css .hiw-fare-card has no background), so the grid runs behind the prices.

P1 Grid competes with real dividers; rules near-miss grid lines → drop to ~3%/raise dividers, or snap rules. polish
P1 Generic dev-tool texture, unearned → give it meaning/scope (hero fade or fare section), not wallpaper. shape
P2 PNG tile blurs on 2x/3x phones → CSS linear-gradient hairlines anchored to the content edge. polish/adapt
P2 Fare card + hero chips: card transparent (grid behind prices), chips are opaque patches → solid card surface; chips transparent or panel. polish
P3 Ending + scope: CTA band breaks grid, then the footer resumes; one page only → end the grid before the band; decide page-only vs site-wide. polish
Personas: Jordan (dev-tool signal), Casey (invisible outdoors), Sam (forced-colors/prefers-contrast: disable), budget Android (blur/invisible).
Questions: Would anyone miss it? Where is "graph paper = worked out" literally true (fare math)? Look like AI SaaS or like the palengke?
