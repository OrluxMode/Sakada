# OpenCode task: put the outlined "SAKADA" wordmark back in the landing hero

The approved design now includes a large, very faint outlined "SAKADA" behind the hero, centered above the tractor in the photo. It is decoration only. It was in the old site and was removed during the v2 build. Add it back, on desktop and mobile.

## Reference
- Figma file `8q1102hOL3ZvFsiePuJrQv`:
  - desktop frame "Sakada v2 lp" (node `18:184`), wordmark layer `24:209`
  - mobile frame "Sakada v2 lp (mobile)" (node `25:209`), wordmark layer `25:270`
- Desktop (1440): the wordmark is 260px tall, centered horizontally, and its top edge is about 120px below the top of the hero (just under the nav bar).
- Mobile (390): the wordmark is 90px tall, centered, and its top edge is about 109px below the top of the hero.

## Files you may touch
- `sakada-web/index.html`
- `sakada-web/css/nav.css`

Nothing else. Don't commit.

## 1. HTML (`index.html`)
Inside `<header class="hero">`, add this line **right after** the `.hero-photo` div and **before** `<main id="main" class="hero-content">`:
```html
<div class="wordmark" aria-hidden="true">SAKADA</div>
```
It must stay `aria-hidden="true"`. It's decoration, and screen readers already get the logo and the h1.

## 2. CSS (`css/nav.css`)
Add this in the Hero section, right after the `.hero-photo` rule:
```css
.wordmark {
  position: absolute;
  top: 14%;
  left: 50%;
  z-index: 1;
  transform: translateX(-50%);
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 900;
  font-size: clamp(90px, 18vw, 260px);
  line-height: 1;
  letter-spacing: 0.02em;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(243, 239, 228, 0.08);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
```
Notes:
- Layer order must be: photo + scrim (`.hero-photo`), then the wordmark (`z-index: 1`), then the hero content (`z-index: 2`, already set), then the nav (`z-index: 10`, already set). The wordmark must never cover the headline, the buttons or the nav, and must never block clicks (`pointer-events: none`).
- Barlow Condensed 900 is already loaded by the Google Fonts link in `index.html`. Don't add any font.
- `rgba(243, 239, 228, 0.08)` is `--text-cream` at 8% opacity. Keep it that faint, because it should barely show.
- Don't add any animation to it.

## Check
1. Open `index.html` at 1440, 1100, 900, 390 and 320px wide.
   - At 1440 the wordmark is about 260px tall, centered, just under the nav.
   - At 390 and 320 it's 90px tall, centered, and not cut off on the sides.
   - No horizontal scrollbar at any width.
2. The headline, Book a Delivery, the role chips and every nav link still work and still sit on top of the wordmark.
3. Run `npm test` inside `sakada-web`, then reply with the files you changed and the test result.
