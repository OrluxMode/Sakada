# OpenCode prompt: nav auto-hide + Features/About background

Project: `sakada-web/` (vanilla HTML/CSS/JS). Make ONLY the edits below, exactly as written. Do not reformat, rename, or touch any other file or line.

## Goal
1. `pages/features.html` and `pages/about.html` get the same dusk photo + grid background as the other inner pages.
2. The top nav (all pages that use `header > .nav`) stays pinned to the top, **slides up and fades out while the page is scrolling**, and **slides back once scrolling stops** (250 ms after the last scroll event). It never hides near the top of the page, while the mobile menu is open, or while a nav item has keyboard focus.

## Files allowed to change
`pages/features.html`, `pages/about.html`, `css/pages.css`, `css/nav.css`, `js/main.js`. Nothing else.

## Step 1: `pages/features.html`
Replace the line `  <body>` with:
```html
  <body class="theme-dusk page-features">
```

## Step 2: `pages/about.html`
Replace the line `  <body>` with:
```html
  <body class="theme-dusk page-about">
```

## Step 3: `css/pages.css`
a) In the comment at the very top, change
`   for-vendors, for-drivers, contact)` → `   for-vendors, for-drivers, contact, features, about)`

b) There are exactly **3** occurrences of `(.hiw-hero, .rp-hero, .ct-hero)` in this file (two in the "Landing theme on the inner pages" block, one in the `forced-colors` media query at the end). Change all 3 to:
`(.page-hero, .hiw-hero, .rp-hero, .ct-hero)`

## Step 4: `css/nav.css`
a) Directly under the first line `/* ---------- Nav ---------- */` and ABOVE `.nav {`, insert:
```css
/* The top nav stays pinned. js/main.js hides it while the page
   scrolls and slides it back once scrolling stops. */
header:has(> .nav) {
  position: sticky;
  top: 0;
  z-index: 10;
}
html {
  scroll-padding-top: var(--nav-h); /* anchor jumps land below the nav */
}
```

b) In the `.nav { ... }` rule, after the line `  border-bottom: 1px solid var(--line);` and before its closing `}`, add the transition, then add the `.nav.is-hidden` rule right after the closing `}` so it reads:
```css
  background: var(--bg-black);
  border-bottom: 1px solid var(--line);
  transition:
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease-out;
}
.nav.is-hidden {
  transform: translateY(-100%);
  opacity: 0;
}
```
Do NOT change `position: absolute` on `.nav` or `.nav--static` in pages.css; the sticky `header` does the pinning.

## Step 5: `js/main.js`
Right after the first line `document.addEventListener("DOMContentLoaded", () => {` and BEFORE `  const toggle = document.querySelector(".nav-toggle");`, insert:
```js
  // Top nav: slides away while the page scrolls, comes back once scrolling stops
  const nav = document.querySelector("header > .nav");
  if (nav) {
    let stopTimer;
    const show = () => nav.classList.remove("is-hidden");
    window.addEventListener(
      "scroll",
      () => {
        clearTimeout(stopTimer);
        const busy = nav.querySelector(".nav-links.open, :focus-visible");
        if (window.scrollY > nav.offsetHeight && !busy) nav.classList.add("is-hidden");
        stopTimer = setTimeout(show, 250);
      },
      { passive: true },
    );
    nav.addEventListener("focusin", show);
  }

```
(It must sit above the `if (!toggle || !menu) return;` line, otherwise pages without a toggle skip it.)

## Check
From `sakada-web/`: `npx eslint .` (clean), `npx vitest run` (143 pass), `npx playwright test` (65 pass). Then tell me "done".
