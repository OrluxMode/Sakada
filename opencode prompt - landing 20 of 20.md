# OpenCode task: take the landing page audit from 17/20 to 20/20

The landing page was re-audited at 17/20. Three areas lost a point: Performance, Theming and Responsive. Fix exactly the items below. **The page must look the same as now** (same layout, colors, fonts, photo and wordmark). Only the entrance animation changes slightly (item 2). Don't commit.

## Files you may touch
- `sakada-web/index.html`
- `sakada-web/css/nav.css`
- `sakada-web/css/base.css`
- new file `sakada-web/css/fonts.css`
- new folder `sakada-web/assets/fonts/`
- new files `sakada-web/assets/hero.webp` and `sakada-web/assets/hero-mobile.webp`

Don't touch the inner pages, `style.css`, `pages.css`, JS, or the existing `.jpg` files.

---

## PERFORMANCE

### 1. Serve the hero photo as WebP (JPEG stays as the fallback)
Create the WebP files with Pillow (it's installed and supports WebP):
```
python3 -c "from PIL import Image
for src,dst in [('sakada-web/assets/hero.jpg','sakada-web/assets/hero.webp'),('sakada-web/assets/hero-mobile.jpg','sakada-web/assets/hero-mobile.webp')]:
    Image.open(src).save(dst,'WEBP',quality=72,method=6)"
```
Targets: `hero.webp` under 200 KB, `hero-mobile.webp` under 110 KB. Report the actual sizes.

In CSS, use `image-set()` so browsers pick WebP and fall back to JPEG (see item 7 for where this goes):
```css
image-set(url("../assets/hero.webp") type("image/webp"), url("../assets/hero.jpg") type("image/jpeg"))
```
In `index.html`, point the two existing `<link rel="preload" as="image">` tags at the `.webp` files and add `type="image/webp"` to both. Keep their `media` attributes.

### 2. Don't hide the hero text while the page loads
`.hero-content` starts at `opacity: 0` and only fades in after 0.85s. Browsers don't count invisible text, so the page's main content ("Largest Contentful Paint") is reported almost a second late, and on a slow phone the headline is blank at first.
- In `.hero-content`, delete `opacity: 0;`. Keep `transform: translateY(18px);`.
- Change the animation to `animation: rise 0.6s ease-out forwards;` (no delay).
- In `@keyframes rise`, delete `opacity: 1;` and keep only `transform: translateY(0);`.

The text is then visible immediately and just slides up 18px. The existing reduced-motion rule still applies.

### 3. Self-host the fonts (no Google requests on the landing page)
Right now the landing page waits on `fonts.googleapis.com` and then `fonts.gstatic.com`: two extra connections before any text can render on slow mobile data. Host the files ourselves.

**a) Download the latin `.woff2` files.** The landing page uses Barlow Condensed **800** and **900** and Public Sans **400, 500, 600, 700**. Run:
```
mkdir -p sakada-web/assets/fonts
curl -s -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800;900&family=Public+Sans:wght@400;500;600;700&display=swap" \
  -o /tmp/sakada-fonts.css
```
- Open `/tmp/sakada-fonts.css`. Each `@font-face` block is preceded by a comment such as `/* latin */` or `/* latin-ext */`. Use **only the `/* latin */` blocks**.
- Download each latin block's `src: url(...)` file into `sakada-web/assets/fonts/`. Use clear names:
  - `barlow-condensed-800.woff2`
  - `barlow-condensed-900.woff2`
  - `public-sans.woff2`. Public Sans is a variable font, so all four weights may share one file. If the four blocks point to the same URL, download it once.

**b) Create `sakada-web/css/fonts.css`** with one `@font-face` per latin block:
- the same `font-family`, `font-style` and `font-weight` as Google's block
- `font-display: swap`
- `src: url("../assets/fonts/<file>.woff2") format("woff2")`
- the block's exact `unicode-range`

For Public Sans as a variable font, a single rule with `font-weight: 400 700;` is fine.

**c) In `index.html`:**
- Remove the two `preconnect` links and the `fonts.googleapis.com` stylesheet link.
- Add `<link rel="stylesheet" href="css/fonts.css" />` as the **first** stylesheet, before `base.css`.
- Preload the two fonts visible in the first screen, right after the stylesheet links:
  ```html
  <link rel="preload" href="assets/fonts/barlow-condensed-800.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="assets/fonts/public-sans.woff2" as="font" type="font/woff2" crossorigin />
  ```
- In the CSP meta tag on `index.html` only, change `font-src https://fonts.gstatic.com` to `font-src 'self'`, and remove `https://fonts.googleapis.com` from `style-src`. Leave every other directive exactly as it is.

---

## THEMING

### 4. Declare the dark color scheme
- In `base.css` `:root`, add `color-scheme: dark;`.
- In `index.html` `<head>`, add `<meta name="color-scheme" content="dark" />` after the viewport meta.

This makes the browser draw scrollbars, autofill and other built-in controls dark to match the page.

### 5. Tokenize the remaining literal colors
In `base.css` `:root`, add these channel tokens next to the existing colors:
```css
--ink-rgb: 11 12 9;        /* same as --bg-black */
--cream-rgb: 243 239 228;  /* same as --text-cream */
```
- Replace every `rgba(11, 12, 9, X)` in `nav.css` with `rgb(var(--ink-rgb) / X)` (same X).
- Replace the wordmark's `rgba(243, 239, 228, 0.08)` with `rgb(var(--cream-rgb) / 0.08)`.

The rendered colors must be identical.

### 6. Tokenize radii
- In `base.css` `:root`, add `--radius-btn: 6px;`.
- In `nav.css`:
  - `border-radius: 999px` → `var(--radius-pill)`
  - `border-radius: 8px` → `var(--radius-md)`
  - `border-radius: 6px` → `var(--radius-btn)`
  - the dropdown's `border-radius: 10px` → `var(--radius-lg)` (12px, an acceptable tiny change)

### 7. One hero background declaration instead of two copies
`.hero-photo` has its full 3-gradient + photo background written twice (default and inside the `max-width: 1024px` query). Write it once and swap only the photo through a custom property:
```css
.hero-photo {
  --hero-img: image-set(url("../assets/hero.webp") type("image/webp"), url("../assets/hero.jpg") type("image/jpeg"));
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(270deg, rgb(var(--ink-rgb) / 0.5) 0%, rgb(var(--ink-rgb) / 0) 45%),
    linear-gradient(180deg, rgb(var(--ink-rgb) / 0.35) 0%, rgb(var(--ink-rgb) / 0.55) 55%, rgb(var(--ink-rgb) / 0.96) 100%),
    linear-gradient(90deg, rgb(var(--ink-rgb) / 0.75) 0%, rgb(var(--ink-rgb) / 0.15) 45%, rgb(var(--ink-rgb) / 0.05) 70%),
    var(--hero-img);
  background-size: cover;
  background-position: center 60%;
}
@media (max-width: 1024px) {
  .hero-photo {
    --hero-img: image-set(url("../assets/hero-mobile.webp") type("image/webp"), url("../assets/hero-mobile.jpg") type("image/jpeg"));
  }
}
```
Delete the old duplicated background-image block from the media query.

---

## RESPONSIVE

### 8. Give the headline breathing room under the nav on short screens
On a phone held sideways (844×390), the headline sits exactly against the bottom of the nav. In `.hero`, change `padding-top: var(--nav-h);` to `padding-top: calc(var(--nav-h) + 24px);`. Tall screens don't change, because the content is bottom-aligned.

---

## Quality rules (these will be checked)
- At 1440×900 and 390×844 the page looks identical to before, apart from the text being visible from the first frame.
- At 844×390 there's a visible gap between the nav and "Your Harvest.".
- The DevTools Network tab on `index.html` shows **no requests** to `fonts.googleapis.com` or `fonts.gstatic.com`, the hero image loads as `.webp`, and there are no CSP errors in the console.
- The fonts look exactly the same (Barlow Condensed headline/wordmark, Public Sans body).
- No horizontal overflow at 320, 390, 768, 1024, 1440.
- No `!important` added, and no new colors.

## When you're done
1. Run `npm test` inside `sakada-web`.
2. Reply with:
   - the files you changed or added
   - the sizes of the two `.webp` files and the font files
   - anything you couldn't do and why
   - the test result

The reviewer (Claude Code) will re-run the audit.
