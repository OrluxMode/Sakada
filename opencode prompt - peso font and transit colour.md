# OpenCode task: ₱ font fix + In Transit colour

Two small fixes. Both are CSS only. Don't commit.

## 1. The ₱ sign uses a fallback font
Our bundled fonts (Barlow Condensed, Public Sans) have no ₱ (U+20B1), so the browser borrowed a serif ₱ from the system. Claude built a matching ₱ for each weight we use. **The 8 font files are already in `sakada-web/assets/fonts/`. Don't touch, rename or regenerate them:**
- `barlow-condensed-600-peso.woff2`
- `barlow-condensed-700-peso.woff2`
- `barlow-condensed-800-peso.woff2`
- `barlow-condensed-900-peso.woff2`
- `public-sans-peso-400.woff2`
- `public-sans-peso-500.woff2`
- `public-sans-peso-600.woff2`
- `public-sans-peso-700.woff2`

Each file contains only the ₱ glyph (~0.5 KB). CSS `unicode-range: U+20B1` makes the browser use it for ₱ only.

**Important:** Chrome only combines faces with **identical** `font-weight` descriptors. The current Public Sans face is declared as a range (`font-weight: 400 700`), which stops a per-weight ₱ face from ever loading. So Public Sans must be declared once per weight (400, 500, 600, 700), all pointing at the same `public-sans.woff2`. The browser downloads it once, and text renders exactly as before; the site only uses those four weights.

### `css/fonts.css`
**1a.** Replace the whole existing Public Sans block:
```css
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url("../assets/fonts/public-sans.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```
with these four blocks. They are identical except for `font-weight`:
```css
/* Public Sans is one variable file, declared per weight so the ₱ faces
   below (same weights) can combine with it. Downloaded once. */
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../assets/fonts/public-sans.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("../assets/fonts/public-sans.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../assets/fonts/public-sans.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("../assets/fonts/public-sans.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
    U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
    U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

**1b.** Append this to the end of `css/fonts.css`:
```css
/* ₱ (U+20B1): neither font has it, so each weight gets a one-glyph
   font built from that weight's own "P". Used for the ₱ character only. */
@font-face {
  font-family: "Barlow Condensed";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../assets/fonts/barlow-condensed-600-peso.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Barlow Condensed";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("../assets/fonts/barlow-condensed-700-peso.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Barlow Condensed";
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url("../assets/fonts/barlow-condensed-800-peso.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Barlow Condensed";
  font-style: normal;
  font-weight: 900;
  font-display: swap;
  src: url("../assets/fonts/barlow-condensed-900-peso.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("../assets/fonts/public-sans-peso-400.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("../assets/fonts/public-sans-peso-500.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("../assets/fonts/public-sans-peso-600.woff2") format("woff2");
  unicode-range: U+20B1;
}
@font-face {
  font-family: "Public Sans";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("../assets/fonts/public-sans-peso-700.woff2") format("woff2");
  unicode-range: U+20B1;
}
```
Leave the four existing Barlow Condensed blocks at the top of the file as they are.

## 2. In Transit colour: blue → violet
Picked Up (teal `#4fa3b0`) and In Transit (blue `#5b9bd5`) were too close to tell apart. In `css/base.css` change exactly these two lines:
```css
  --status-in-transit: #5b9bd5;
```
→
```css
  --status-in-transit: #b09bee;
```
and
```css
  --status-in-transit-text: #9cc3ee;
```
→
```css
  --status-in-transit-text: #d4c9fb;
```
Change nothing else. The status pills (`dashboard.css`) and stage dots (`pages.css`) already read these variables. **Leave `css/ui-feedback.css` alone:** its `.toast--info` blue `#5b9bd5` is the info toast, not a status.

## 3. `e2e/smoke.spec.mjs`: append this test
```js
test("the ₱ sign uses our own font, not a system fallback", async ({ page }) => {
  await page.goto("/pages/how-it-works.html");
  await page.waitForLoadState("networkidle");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((f) => f.unicodeRange.toUpperCase().includes("U+20B1") && f.status === "loaded")
      .map((f) => `${f.family} ${f.weight}`);
  });
  expect(loaded.length).toBeGreaterThan(0);
});
```

## Files you may touch
- `sakada-web/css/fonts.css`
- `sakada-web/css/base.css` (the 2 lines only)
- `sakada-web/e2e/smoke.spec.mjs` (append only)

Nothing else.

## Check before you finish
From `sakada-web/`, run:
1. `npm run lint`
2. `npx vitest run`
3. `npm run test:e2e`

All three must pass. Report each result.
