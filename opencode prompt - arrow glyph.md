# OpenCode task: the → arrow uses our fonts too

The "→" in routes ("Nueva Ecija → Marikina palengke") isn't in Barlow Condensed or Public Sans, so it fell back to a thin system arrow. Claude drew a matching → for every weight. To keep it to one small download per weight, the → now lives in the same file as the ₱. The files were renamed from `*-peso.woff2` to `*-symbols.woff2`.

**Already done by Claude. Don't touch, rename or regenerate these files:**
- Added to `sakada-web/assets/fonts/`:
  - `barlow-condensed-600-symbols.woff2`
  - `barlow-condensed-700-symbols.woff2`
  - `barlow-condensed-800-symbols.woff2`
  - `barlow-condensed-900-symbols.woff2`
  - `public-sans-symbols-400.woff2`
  - `public-sans-symbols-500.woff2`
  - `public-sans-symbols-600.woff2`
  - `public-sans-symbols-700.woff2`
- Removed: the 8 old `*-peso.woff2` files. `fonts.css` still points at them, which is what you fix below.

Don't commit.

## 1. `css/fonts.css`
At the end of the file there are 8 `@font-face` blocks for the ₱. In **each of those 8 blocks only**:
1. In the `src` URL, change `-peso` to `-symbols`. Note the Public Sans pattern: `public-sans-peso-400.woff2` → `public-sans-symbols-400.woff2`, and `barlow-condensed-600-peso.woff2` → `barlow-condensed-600-symbols.woff2`.
2. Change `unicode-range: U+20B1;` to `unicode-range: U+20B1, U+2192;`

Then replace the comment above those 8 blocks with:
```css
/* ₱ (U+20B1) and → (U+2192): neither font has them, so each weight gets
   a tiny "symbols" font built from that weight's own P and hyphen.
   Used for those two characters only. */
```
Don't change anything else in the file: the 4 Barlow blocks, the 4 Public Sans blocks, `font-display`, `font-weight` and the order all stay as they are.

When you're done, `grep -c "peso" css/fonts.css` must print `0` and `grep -c "symbols" css/fonts.css` must print `8`.

## 2. `e2e/smoke.spec.mjs`
Replace the existing test `"the ₱ sign uses our own font, not a system fallback"` with:
```js
test("₱ and → use our own fonts, not a system fallback", async ({ page }) => {
  await page.goto("/pages/for-farmers.html");
  await page.waitForLoadState("networkidle");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((f) => f.status === "loaded")
      .map((f) => f.unicodeRange.toUpperCase());
  });
  expect(loaded.some((r) => r.includes("U+20B1") && r.includes("U+2192"))).toBe(true);
});
```
(The For Farmers page has both ₱ and → in its hero.)

## Files you may touch
- `sakada-web/css/fonts.css`
- `sakada-web/e2e/smoke.spec.mjs`

Nothing else.

## Check before you finish
From `sakada-web/`, run:
1. `npm run lint`
2. `npx vitest run`
3. `npm run test:e2e`

All three must pass. Report each result.
