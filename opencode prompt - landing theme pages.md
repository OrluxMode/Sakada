# OpenCode task: landing theme on the inner pages

The owner and testers want How It Works, For Farmers, For Vendors, For Drivers and Contact to match the landing page's theme:
- the landing's tractor-at-dusk photo, with its dark grade, behind each page's hero
- a faint 32px graph-paper grid running top to bottom

**The landing page (`index.html`) must not change at all.** Everything is scoped to a new body class, `theme-dusk`, which only these five pages get. The CSS below is final: Claude already tested it on all five pages at 1440px and 390px. **Copy it exactly.** It reuses the photo files the landing page already loads (`assets/hero.webp`/`.jpg` and `hero-mobile.webp`/`.jpg`). No new files.

Reference: Figma file `8q1102hOL3ZvFsiePuJrQv`, the frames named "… — landing theme" on each page, plus How It Works `110:334` / `110:512`.

Don't commit.

## 1. Add the body class (5 files, one line each)
Change only the `<body>` tag:

| File | `<body>` becomes |
|---|---|
| `sakada-web/pages/how-it-works.html` | `<body class="theme-dusk page-hiw">` |
| `sakada-web/pages/for-farmers.html` | `<body class="theme-dusk page-farmers">` |
| `sakada-web/pages/for-vendors.html` | `<body class="theme-dusk page-vendors">` |
| `sakada-web/pages/for-drivers.html` | `<body class="theme-dusk page-drivers">` |
| `sakada-web/pages/contact.html` | `<body class="theme-dusk page-contact">` |

## 2. Append this block to the END of `sakada-web/css/pages.css`
```css
/* ================================================
   Landing theme on the inner pages (body.theme-dusk):
   the landing's dusk photo + grade behind each page hero,
   and a 32px graph-paper grid from top to bottom.
   The landing page itself does not use this class.
   ================================================ */
.theme-dusk {
  --grid-line: rgb(var(--cream-rgb) / 0.05);
  --grid: linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  --grid-x: clamp(20px, 5vw, 64px); /* vertical lines meet the page gutter */
  --dusk-img: image-set(
    url("../assets/hero.webp") type("image/webp"),
    url("../assets/hero.jpg") type("image/jpeg")
  );
  --dusk-size: cover;
  --dusk-pos: center 45%;
  background-color: var(--bg-black);
  background-image: var(--grid);
  background-size: 32px 32px;
  background-position: var(--grid-x) 0;
}
.theme-dusk .nav--static { background: transparent; }

.theme-dusk :is(.hiw-hero, .rp-hero, .ct-hero) {
  position: relative;
  isolation: isolate;
}
.theme-dusk :is(.hiw-hero, .rp-hero, .ct-hero)::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  /* top layer first: grid (kept in step with the page grid; the hero
     starts right under the nav), then the landing grade, then the photo */
  background-image:
    var(--grid),
    linear-gradient(270deg, rgb(var(--ink-rgb) / 0.65) 0%, rgb(var(--ink-rgb) / 0) 50%),
    linear-gradient(180deg, rgb(var(--ink-rgb) / 0.45) 0%, rgb(var(--ink-rgb) / 0.6) 55%, rgb(var(--ink-rgb) / 0.96) 100%),
    linear-gradient(90deg, rgb(var(--ink-rgb) / 0.75) 0%, rgb(var(--ink-rgb) / 0.2) 45%, rgb(var(--ink-rgb) / 0.15) 70%),
    var(--dusk-img);
  background-size: 32px 32px, 32px 32px, auto, auto, auto, var(--dusk-size);
  background-position:
    var(--grid-x) calc(-1 * var(--nav-h)),
    var(--grid-x) calc(-1 * var(--nav-h)),
    0 0, 0 0, 0 0,
    var(--dusk-pos);
  background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat, no-repeat;
}

/* One photo, a different crop per page (wide screens) */
.theme-dusk.page-farmers { --dusk-size: 161% auto; --dusk-pos: 0% 46%; }
.theme-dusk.page-vendors { --dusk-size: 167% auto; --dusk-pos: 100% 26%; }
.theme-dusk.page-drivers { --dusk-size: 200% auto; --dusk-pos: 44% 41%; }
.theme-dusk.page-contact { --dusk-pos: center 20%; }

/* Surfaces that sit on the grid */
.theme-dusk .hiw-hero .chip { background: transparent; }
.theme-dusk .hiw-fare-card,
.theme-dusk .ct-card { background: var(--panel-dark); }
.theme-dusk .hiw-close { background: rgb(20 21 15 / 0.6); }

@media (max-width: 1024px) {
  .theme-dusk {
    --dusk-img: image-set(
      url("../assets/hero-mobile.webp") type("image/webp"),
      url("../assets/hero-mobile.jpg") type("image/jpeg")
    );
  }
  .theme-dusk[class] { --dusk-size: cover; --dusk-pos: center 60%; }
}

@media (forced-colors: active), (prefers-contrast: more) {
  .theme-dusk { background-image: none; }
  .theme-dusk :is(.hiw-hero, .rp-hero, .ct-hero)::before { display: none; }
}
```

## 3. `sakada-web/e2e/smoke.spec.mjs`: append
```js
test.describe("landing theme on the inner pages", () => {
  for (const path of ["/pages/how-it-works.html", "/pages/for-farmers.html", "/pages/for-vendors.html", "/pages/for-drivers.html", "/pages/contact.html"]) {
    test(`${path} has the dusk photo hero and the grid`, async ({ page }) => {
      await page.goto(path);
      const result = await page.evaluate(() => {
        const hero = document.querySelector(".hiw-hero, .rp-hero, .ct-hero");
        return {
          themed: document.body.classList.contains("theme-dusk"),
          grid: getComputedStyle(document.body).backgroundImage.includes("linear-gradient"),
          photo: getComputedStyle(hero, "::before").backgroundImage.includes("hero"),
        };
      });
      expect(result).toEqual({ themed: true, grid: true, photo: true });
    });
  }

  test("the landing page is untouched", async ({ page }) => {
    await page.goto("/index.html");
    expect(await page.evaluate(() => document.body.classList.contains("theme-dusk"))).toBe(false);
  });
});
```

## Files you may touch
- the 5 page files above (the `<body>` tag only)
- `sakada-web/css/pages.css` (append only)
- `sakada-web/e2e/smoke.spec.mjs` (append only)

Nothing else. Don't touch `index.html`, `nav.css`, `base.css` or any image.

## Check before you finish
From `sakada-web/`, run:
1. `npm run lint`
2. `npx vitest run`
3. `npm run test:e2e`

All three must pass. Report each result.
