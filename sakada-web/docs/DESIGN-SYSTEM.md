# Sakada Logistics — Design System

Reference: Vertex Transport Inc. hero layout (dark cinematic freight-brand style).
Decision: keep layout + palette mood exactly as referenced; swap subject matter
from US highway freight to Philippine agricultural logistics (farm roads, produce,
local trucks, vendors/markets). Tone: friendly & approachable, farmer-first.

## Color

| Token             | Hex        | Use                                      |
|-------------------|------------|-------------------------------------------|
| --bg-black        | #0B0C09    | Page background, hero overlay base        |
| --panel-dark       | #14150F    | Stat strip, nav bar, footer panels        |
| --text-cream       | #F3EFE4    | Headlines, primary text on dark           |
| --text-muted       | #B8B4A6    | Supporting copy, nav links                |
| --accent-amber     | #E0972F    | Primary CTA, active states, key numbers   |
| --accent-amber-dim | #B9761C    | CTA hover/pressed                         |
| --line             | rgba(243,239,228,0.12) | Hairline dividers              |

Not pure black — every dark surface carries a faint warm tint (#0B0C09, not #000)
so it reads as fields-at-dusk rather than industrial steel.

## Type

- Display / headlines: **Barlow Condensed**, weight 800–900, tight letter-spacing,
  large scale, always sentence case (never all-caps for real words — only the
  ghost wordmark, which is a logotype, not a label).
- Body / UI text: **Public Sans**, weight 400–600.
- No more than two families. No Inter, no system-default stack for display type.

## Layout pattern (hero, carried across every page)

1. Full-bleed photograph, dark gradient overlay (bottom + left heavier for text contrast).
2. Oversized translucent "SAKADA" wordmark centered behind the headline — brand
   presence, not a UI element, ~6–8% opacity.
3. Left-aligned, multi-line bold headline, stacked short lines rather than one
   long line.
4. Supporting paragraph + primary CTA button sit lower-right, not stacked
   directly under the headline — this is the Vertex layout signature.
5. Minimal top nav: logotype left, 4–5 text links center-right, one filled
   pill button (dark bg, amber icon accent) top-right for Login/Register.
6. Dark stat-strip band anchors the bottom of the hero: 3–4 metrics, big
   condensed number + small muted label, evenly spaced, hairline dividers
   between them.

## Motion

One deliberate entrance on load (headline + wordmark fade/rise together,
~600ms, ease-out). No per-card hover lift effects, no scroll-triggered
fade-ins on every section — motion is spent once, at the hero.

## Photography direction

Golden-hour or blue-hour lighting, real working scenes: loaded trucks or
tricycles on provincial roads, rice paddies, vendors at a palengke, farmers
loading produce. Same cinematic mood as the reference, different subject.
Current placeholder image is Unsplash-licensed (attribution in index.html
comment) — swap for commissioned/licensed photography before real launch.

## Content voice

Plain, active, farmer-first. No corporate freight jargon ("flatbed partner",
"specialized freight"). Say what the person can actually do: book a delivery,
see your driver, track your shipment.