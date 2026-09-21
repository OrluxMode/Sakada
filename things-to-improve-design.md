# Sakada Logistics — Design Improvements

## Critique Summary

**Strengths:** Dark theme is well-executed with warm tints. Typography pairing (Barlow Condensed + Public Sans) is solid. Hero layout follows the Vertex reference faithfully. Excellent reduced motion support. Anti-pattern avoidance is clean — no purple gradients, no glassmorphism, no bounce easing, no nested cards, no pure black/white.

**Weaknesses:** The foundation is solid but the site is functional and forgettable. It needs visual richness — icons, imagery, micro-interactions, and trust signals to feel like a product farmers and vendors would actually use.

---

## Component Inventory

Track all components that need design improvements:

| Component | File | Status | Priority |
|-----------|------|--------|----------|
| Navbar | `index.html` | ✅ Exists | P0 |
| Hero Section | `index.html` | ✅ Exists | P0 |
| Feature Grid | `features.html` | ⚠️ Needs icons | P1 |
| Delivery Card | `dashboard.html` | ⚠️ Needs hover | P1 |
| Status Pill | `dashboard.html` | ⚠️ Needs tokens | P1 |
| Form Fields | All pages | ⚠️ Needs disabled state | P2 |
| Primary Button | All pages | ✅ Exists | P1 |
| Secondary Button | All pages | ✅ Exists | P1 |
| Small Button | `dashboard.html` | ⚠️ Needs focus | P2 |
| Toast Notification | — | ❌ Missing | P1 |
| Empty State | `dashboard.html` | ⚠️ Needs design | P1 |
| Loading Skeleton | — | ❌ Missing | P2 |
| Notification Panel | `dashboard.html` | ⚠️ Needs animation | P2 |
| Star Picker | `dashboard.html` | ⚠️ Needs ARIA | P2 |
| 404 Page | — | ❌ Missing | P0 |
| Footer | All pages | ✅ Exists | P0 |

---

## Critical Issues

### 1. No visual identity beyond the hero
Every inner page is text-only. No icons, no illustrations, no photography. The hero does all the brand work, then the rest of the site feels like a docs page. Farmers and vendors need to *see* what they're getting.
**Effort:** 8-12 hours

### 2. Feature grid is just paragraphs
`features.html` and `for-farmers.html` use `.feature-grid` which is just `<h3>` + `<p>` repeated 10 times. No icons, no visuals, no hierarchy. This is the most forgettable section on the site.
**Effort:** 3-4 hours

### 3. CTA bands are identical everywhere
Every page ends with the same `<div class="cta-band">` — same layout, same styling, same position. Repetition kills urgency.
**Effort:** 2-3 hours

### 4. No trust signals
No testimonials, no driver count, no delivery count, no partner logos, no "500+ deliveries completed." The stat strip shows "3 roles connected" and "1 booking flow" — these aren't impressive metrics, they're features.
**Effort:** 4-6 hours

### 5. No favicon, no OG tags, no 404
Sharing Sakada on social media shows a blank preview. No `og:image`, no `og:title`. Favicon is missing entirely.
**Effort:** 2-3 hours

---

## Typography Issues

### 6. Line height on body text is tight
`line-height: 1.6` on `.hero-side p` and `.step-list p` is readable but cramped for dark-on-dark. Impeccable recommends 1.65–1.8 for dark surfaces. The dashboards use 1.7 which is better.
**Effort:** 30 minutes

### 7. No consistent type scale
Font sizes are scattered: `13px`, `14px`, `14.5px`, `15px`, `16px`, `19px`, `20px`, `22px`, `24px`, `26px`, `28px`, `30px`, `38px`, `42px`, `64px`, `88px`. That's 16 distinct sizes. A tight scale of 8–10 steps would feel more intentional.
**Effort:** 2-3 hours

### 8. Section h2s are too similar to body text
`clamp(28px, 3.4vw, 40px)` for section h2s vs `16px` body. Barlow Condensed at 800 weight looks heavy next to Public Sans at 400. The visual gap feels smaller than the numeric gap.
**Effort:** 1 hour

---

## Spacing Issues

### 9. No spacing scale
Padding and margins are arbitrary: `28px`, `32px`, `36px`, `40px`, `48px`, `56px`, `64px`, `72px`, `96px`. No rhythm. A consistent scale (e.g., 4/8/16/24/32/48/64/96) would make the layout feel more deliberate.
**Effort:** 3-4 hours

### 10. Section padding is inconsistent
`.section` uses `padding: 72px`, `.page-hero` uses `padding: 96px ... 56px`, `.cta-band` uses `padding: 64px`. These should follow a pattern.
**Effort:** 1-2 hours

---

## Component Issues

### 11. Delivery cards have no hover state
`.delivery-card` has no `:hover` effect. On a dashboard where users scan lists of cards, hover feedback is essential for discoverability.
**Effort:** 30 minutes

### 12. Status pills use hardcoded colors
`.status-pill[data-status="pending"]` uses `#888`, `[data-status="picked_up"]` uses `#5b9bd5`, `[data-status="delivered"]` uses `#7ab05c`. These aren't in the design tokens. They'll drift from the palette over time.
**Effort:** 1 hour

### 13. Notification panel has no animation
`.notif-panel` toggles between `display: none` and `display: block`. No transition, no fade, no slide. Feels abrupt.
**Effort:** 1-2 hours

### 14. Form inputs have no disabled state
`.field input:disabled` and `.field textarea:disabled` aren't styled. When buttons go disabled during submission, the inputs stay fully opaque.
**Effort:** 30 minutes

### 15. Buttons lack focus-visible styles on dashboards
`.btn-accept` and `.btn-small` have no `:focus-visible` outline. Keyboard users can't see where focus is.
**Effort:** 30 minutes

---

## Missing Design Elements

### 16. No empty state design
When there are no deliveries, the site shows `<p class="delivery-empty">Nothing active right now.</p>` — a dashed border box with text. No illustration, no guidance, no "Create your first delivery" prompt.
**Effort:** 2-3 hours

### 17. No loading skeletons
Dashboard pages show "Loading..." text until data arrives. No skeleton screens, no shimmer. Users see a blank page then a sudden pop of content.
**Effort:** 3-4 hours

### 18. No toast/notification system
Errors show in a small `formMessage` div. Success messages disappear on next action. No persistent toast, no auto-dismiss, no stack.
**Effort:** 4-6 hours

### 19. No micro-interactions
No hover lift on cards, no button press feedback beyond color change, no transition on status changes, no skeleton shimmer. The UI is static.
**Effort:** 3-4 hours

### 20. No visual hierarchy on dashboard pages
The dashboard topbar, greeting, form, and delivery list all run together. No visual sections, no card grouping, no background differentiation.
**Effort:** 4-6 hours

---

## Accessibility Issues

### 21. Focus indicators are inconsistent
`.nav-links a:focus-visible` changes color. `.btn-primary:focus-visible` changes background. `.field input:focus-visible` gets an outline. `.btn-accept` and `.btn-small` have no focus style at all.
**Effort:** 1 hour

### 22. Missing ARIA on interactive elements
The notification bell has `aria-label="Notifications"` (good). But the star picker buttons, status update buttons, and accept buttons have no ARIA labels.
**Effort:** 1-2 hours

### 23. Color contrast on muted text
`var(--text-muted)` is `#B8B4A6` on `#0B0C09` background — roughly 6.5:1 (passes AA). On `#14150F` panel background, drops to ~5.8:1. Still passes but feels faint.
**Effort:** 30 minutes

---

## Structural Issues

### 24. Single CSS file
1238 lines in one `style.css`. No component-level splitting, no BEM naming, no CSS custom properties for spacing/radius/shadows. Will become unmaintainable.
**Effort:** 6-8 hours

### 25. No design tokens for spacing, radius, or shadows
Colors have tokens (`--bg-black`, `--accent-amber`). But spacing, border-radius, and box-shadow are all hardcoded inline. Inconsistent radii: `6px`, `8px`, `10px`, `12px`, `999px` used interchangeably.
**Effort:** 2-3 hours

### 26. Inline styles in HTML
Several pages use `style="display: flex; justify-content: space-between; ..."` directly in the HTML. These should be classes.
**Effort:** 2-3 hours

---

## Animation & Timing Specifications

### Transition Durations
Use these consistent timing values across all interactions:

| Interaction | Duration | Easing | Transform |
|-------------|----------|--------|-----------|
| Button hover | `150ms` | `ease-out` | `translateY(-1px)` |
| Button active/press | `100ms` | `ease-in` | `scale(0.98)` |
| Card hover lift | `200ms` | `ease-out` | `translateY(-2px)` |
| Card hover shadow | `200ms` | `ease-out` | shadow transition |
| Status pill color | `300ms` | `ease-in-out` | — |
| Notification panel open | `250ms` | `ease-out` | `translateY(-8px)` → `translateY(0)` |
| Notification panel close | `200ms` | `ease-in` | `translateY(0)` → `translateY(-8px)` |
| Toast enter | `300ms` | `ease-out` | `translateX(100%)` → `translateX(0)` |
| Toast exit | `250ms` | `ease-in` | `translateX(0)` → `translateX(100%)` |
| Skeleton shimmer | `1.5s` | `linear` | background position loop |
| Focus outline | `100ms` | `ease-out` | — |

### CSS Implementation Examples

```css
/* Button hover — subtle lift */
.btn-primary {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out, background-color 150ms ease-out;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.btn-primary:active {
  transform: scale(0.98);
  transition-duration: 100ms;
}

/* Card hover — gentle lift + shadow */
.delivery-card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out;
}
.delivery-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(212, 168, 67, 0.3);
}

/* Notification panel — slide + fade */
.notif-panel {
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}
.notif-panel.active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Status pill — smooth color transition */
.status-pill {
  transition: background-color 300ms ease-in-out, color 300ms ease-in-out;
}

/* Toast notification — slide in from right */
.toast {
  transform: translateX(100%);
  transition: transform 300ms ease-out;
}
.toast.show {
  transform: translateX(0);
}
.toast.hiding {
  transform: translateX(100%);
  transition: transform 250ms ease-in;
}

/* Skeleton shimmer animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg-panel) 25%, rgba(255,255,255,0.05) 50%, var(--bg-panel) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
  border-radius: var(--radius-md);
}

/* Reduced motion — respect user preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Responsive Breakpoints

### Breakpoint Tokens

```css
:root {
  --bp-xs: 320px;    /* Small phones */
  --bp-sm: 480px;    /* Large phones */
  --bp-md: 768px;    /* Tablets */
  --bp-lg: 1024px;   /* Small laptops */
  --bp-xl: 1280px;   /* Desktops */
  --bp-2xl: 1440px;  /* Large screens */
}
```

### Mobile Adaptations

| Component | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| Navbar | Hamburger menu, full-screen overlay | Horizontal links | Horizontal links |
| Hero | Stack vertically, full-width image | Side-by-side, 50/50 | Side-by-side, 40/60 |
| Feature grid | 1 column | 2 columns | 3 columns |
| Delivery cards | Full-width stack | 2 columns | 3 columns |
| Dashboard form | Full-width, stacked fields | 2-column grid | 2-column grid |
| Section padding | `48px 16px` | `64px 32px` | `72px 48px` |
| Page hero | `72px 16px` | `80px 40px` | `96px 56px` |
| CTA band | `48px 16px` | `56px 32px` | `64px 48px` |
| Footer | Single column, stacked | 2 columns | 4 columns |

### Responsive CSS Patterns

```css
/* Mobile-first approach */
.section {
  padding: var(--space-2xl) var(--space-md);  /* 48px 16px */
}
@media (min-width: 768px) {
  .section {
    padding: var(--space-3xl) var(--space-xl);  /* 64px 32px */
  }
}
@media (min-width: 1024px) {
  .section {
    padding: 72px var(--space-2xl);  /* 72px 48px */
  }
}

/* Feature grid responsive */
.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-lg);
}
@media (min-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .feature-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Dashboard delivery cards */
.delivery-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}
@media (min-width: 768px) {
  .delivery-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 1024px) {
  .delivery-list {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Hide mobile nav on desktop */
.nav-overlay {
  display: none;
}
@media (max-width: 767px) {
  .nav-overlay.active {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: var(--bg-black);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-xl);
  }
}

/* Typography scale responsive */
.hero-title {
  font-size: clamp(2.5rem, 6vw, 5.5rem);
}
.section-title {
  font-size: clamp(1.75rem, 3.4vw, 2.5rem);
}
.body-text {
  font-size: clamp(0.875rem, 1.5vw, 1rem);
}
```

---

## Success Metrics

Track these metrics to measure improvement impact:

### User Engagement
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Bounce rate | — | <40% | Google Analytics |
| Avg. session duration | — | >2 minutes | Google Analytics |
| Pages per session | — | >2.5 | Google Analytics |
| Delivery creation rate | — | +25% | App analytics |
| Return visitor rate | — | >30% | Google Analytics |

### Technical Quality
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| WCAG compliance | — | AA | Lighthouse audit |
| Lighthouse performance | — | >90 | Lighthouse |
| Lighthouse accessibility | — | >95 | Lighthouse |
| First contentful paint | — | <1.5s | Lighthouse |
| Largest contentful paint | — | <2.5s | Lighthouse |
| Cumulative layout shift | — | <0.1 | Lighthouse |

### Visual Consistency
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Design token usage | ~30% | >80% | CSS audit |
| Inline styles | ~15 instances | 0 | Code review |
| Font size variations | 16 sizes | 10 sizes | CSS audit |
| Hardcoded colors | ~20 instances | 0 | CSS audit |

### Accessibility
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Focus indicators | 3/8 components | 8/8 components | Manual testing |
| ARIA labels | 1/5 interactive | 5/5 interactive | Code review |
| Keyboard navigation | Partial | Full | Manual testing |
| Screen reader compatible | — | Yes | NVDA/VoiceOver testing |

---

## Accessibility Testing Steps

### 1. Keyboard Navigation Test
Navigate entire site using only keyboard:
- [ ] Tab through all interactive elements in logical order
- [ ] Enter/Space activates buttons and links
- [ ] Escape closes notification panel and modals
- [ ] Arrow keys navigate within star picker
- [ ] Focus is always visible (outline on all focused elements)
- [ ] No keyboard traps (can always tab away from element)

### 2. Screen Reader Test
Test with NVDA (Windows) or VoiceOver (Mac):
- [ ] All images have descriptive `alt` text
- [ ] Form inputs have associated `<label>` elements
- [ ] Buttons have accessible names (visible text or `aria-label`)
- [ ] Headings create logical document outline (h1 → h2 → h3)
- [ ] Landmarks identified (`<nav>`, `<main>`, `<footer>`)
- [ ] Dynamic content announces changes (`aria-live` regions)
- [ ] Status pills announce status change

### 3. Color Contrast Test
Use WebAIM Contrast Checker:
- [ ] Body text (#f5f5f0 on #0B0C09): ratio ≥7:1 (AAA)
- [ ] Muted text (#B8B4A6 on #0B0C09): ratio ≥4.5:1 (AA)
- [ ] Muted text on panels (#B8B4A6 on #14150F): ratio ≥4.5:1 (AA)
- [ ] Accent text (#D4A843 on #0B0C09): ratio ≥4.5:1 (AA)
- [ ] Status pill text on backgrounds: ratio ≥4.5:1 (AA)
- [ ] Button text on backgrounds: ratio ≥4.5:1 (AA)

### 4. Reduced Motion Test
Enable "Reduce motion" in OS settings:
- [ ] All animations disabled or <0.01ms
- [ ] All transitions disabled or <0.01ms
- [ ] No auto-playing animations
- [ ] Content remains functional without animation
- [ ] Skeleton shimmer replaced with static placeholder

### 5. Zoom/Scaling Test
Zoom browser to 200%:
- [ ] No horizontal scrolling
- [ ] All text remains readable
- [ ] No content overlap
- [ ] Buttons remain clickable
- [ ] Forms remain usable

### 6. Responsive Test
Test at each breakpoint:
- [ ] 320px (small phone): Content accessible, no overflow
- [ ] 480px (large phone): Layout adjusts, touch targets ≥44px
- [ ] 768px (tablet): 2-column layouts activate
- [ ] 1024px (laptop): Full desktop layout
- [ ] 1280px+ (desktop): Max-width container centered

---

## Priority Improvement List

### P0 — Must Have Before Launch

| # | Item | What to do | Effort |
|---|------|-----------|--------|
| 1 | **Favicon + OG tags** | Create `assets/favicon.ico` and `favicon.png`. Add `<link rel="icon">` to all HTML files. Add `og:title`, `og:description`, `og:image`, `og:url` to `index.html` and key pages. Add Twitter card meta tags. | 2-3 hrs |
| 2 | **404 page** | Create `404.html` with the same nav/footer styling. Show "Page not found" with a link back to home. Configure hosting to serve it for unknown routes. | 1-2 hrs |
| 3 | **Self-host hero image** | Download the Unsplash photo to `assets/hero.jpg`. Replace the hotlinked URL in CSS. Add responsive `<img>` with `srcset` or use CSS `image-set()`. | 1 hr |

### P1 — High Impact

| # | Item | What to do | Effort |
|---|------|-----------|--------|
| 4 | **Icons for feature grids** | Add SVG icons (inline or sprite) to each feature item. Use the accent amber or muted cream for icon color. Keep icons simple — line icons, not filled illustrations. | 3-4 hrs |
| 5 | **Empty state illustrations** | Replace dashed-border "Nothing active right now" with a designed empty state: icon + heading + CTA button ("Create your first delivery"). | 2-3 hrs |
| 6 | **Toast notification system** | Create `js/toast.js` — a simple toast component (appears at top-right, auto-dismisses after 5s). Replace all `console.error()` calls in catch blocks with toast notifications. | 4-6 hrs |
| 7 | **Hover states on delivery cards** | Add subtle hover effect: `transform: translateY(-2px)` + slightly brighter border or background shift. Use `200ms ease-out` transition. | 30 min |
| 8 | **Status pill color tokens** | Move hardcoded status colors (`#888`, `#5b9bd5`, `#7ab05c`, `#e0542f`) into CSS custom properties in `:root`. | 1 hr |

### P2 — Polish

| # | Item | What to do | Effort |
|---|------|-----------|--------|
| 9 | **Loading skeletons** | Add a CSS `.skeleton` class (animated pulse placeholder). Show skeleton cards in delivery lists while data loads. Show a spinner on buttons during async operations. | 3-4 hrs |
| 10 | **Spacing/radius/shadow tokens** | Add to `:root`: spacing scale (`--space-xs` to `--space-4xl`), radius tokens (`--radius-sm/md/lg/pill`), shadow tokens (`--shadow-sm/md/lg`). Replace hardcoded values throughout. | 2-3 hrs |
| 11 | **Focus-visible on all interactive elements** | Add `:focus-visible` outlines to `.btn-accept`, `.btn-small`, `.star-picker button`, `.notif-bell`, `.role-tabs button`, `.admin-tabs button`. Use `outline: 2px solid var(--accent-amber); outline-offset: 2px`. | 1 hr |
| 12 | **Notification panel animation** | Add CSS transition: `opacity 250ms ease-out` + `transform: translateY(-8px) 250ms ease-out` on `.notif-panel`. Toggle with a class instead of `display: none/block`. | 1-2 hrs |
| 13 | **Form input disabled state** | Add `.field input:disabled, .field textarea:disabled { opacity: 0.5; cursor: not-allowed; transition: opacity 150ms ease-out; }` | 30 min |
| 14 | **Inline styles → classes** | Replace `style="display: flex; ..."` in HTML with proper CSS classes (`.section-header-row`, `.delivery-form-wrapper`, etc.). | 2-3 hrs |

### P3 — Delight

| # | Item | What to do | Effort |
|---|------|-----------|--------|
| 15 | **Micro-interactions** | Add button press feedback (`transform: scale(0.98)` on `:active`, `100ms ease-in`). Add subtle card lift on hover (`translateY(-2px)`, `200ms ease-out`). Add transition on status pill color changes (`300ms ease-in-out`). | 3-4 hrs |
| 16 | **Trust signals** | Add a testimonials section or "Trusted by X farmers" counter. Add partner/driver logos if available. Show real delivery count on the stat strip. | 4-6 hrs |
| 17 | **Inner page photography** | Add relevant images to at least 2-3 inner pages (e.g., farmers loading produce, driver with truck, market scene). Use `<figure>` with `<figcaption>`. | 4-6 hrs |
| 18 | **CSS component split** | Split `style.css` into: `base.css` (tokens, resets), `nav.css`, `hero.css`, `auth.css`, `dashboard.css`, `components.css` (cards, buttons, pills). | 6-8 hrs |
| 19 | **Type scale normalization** | Reduce to 10 font size steps: 12/13/14/16/18/20/24/32/48/64. Map each to a CSS variable. | 2-3 hrs |

---

## Anti-Pattern Check (Impeccable)

| Pattern | Present? | Notes |
|---------|----------|-------|
| Purple gradients | No | Clean |
| Glassmorphism | No | Clean |
| Bounce/elastic easing | No | Clean |
| Nested cards | No | Clean |
| Pure black/white | No | Clean |
| Overused fonts (Inter, system) | No | Clean |
| Gray text on colored backgrounds | No | Clean |
| Cards wrapped around everything | No | Clean |
| Italic serif display | No | Clean |
| Neon cyan/magenta | No | Clean |

**All clear on anti-patterns.** The foundation avoids every common AI-slop tell.

---

## Design Tokens to Add

```css
:root {
  /* Spacing scale */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 999px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.15);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.25);

  /* Status colors */
  --status-pending: #888;
  --status-assigned: var(--accent-amber);
  --status-transit: #5b9bd5;
  --status-delivered: #7ab05c;
  --status-cancelled: #e0542f;

  /* Semantic colors */
  --color-success: #7ab05c;
  --color-warning: #e0972f;
  --color-error: #e0542f;
  --color-info: #5b9bd5;

  /* Type scale (reduced to 10 steps) */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.8125rem;  /* 13px */
  --text-base: 0.875rem; /* 14px */
  --text-md: 1rem;       /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 2rem;      /* 32px */
  --text-4xl: 3rem;      /* 48px */
  --text-5xl: 4rem;      /* 64px */

  /* Breakpoints (for reference, used in media queries) */
  --bp-xs: 320px;
  --bp-sm: 480px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --bp-2xl: 1440px;

  /* Transition durations */
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 250ms;
  --duration-slower: 300ms;

  /* Easing functions */
  --ease-out: ease-out;
  --ease-in: ease-in;
  --ease-in-out: ease-in-out;
}
```

---

## Image & Asset Specifications

### Hero Image
- **Dimensions:** 1920×1080px (16:9 aspect ratio)
- **Format:** WebP with JPEG fallback
- **File size:** <200KB (compressed)
- **Location:** `/assets/hero.webp` + `/assets/hero.jpg`
- **Alt text:** "Aerial view of Philippine farmland at sunrise"
- **Loading:** `loading="eager"` (above the fold)
- **Srcset:** Provide 1280px and 1920px versions for responsive loading

```html
<picture>
  <source srcset="assets/hero-1280.webp 1280w, assets/hero-1920.webp 1920w" type="image/webp">
  <img src="assets/hero-1920.jpg" 
       srcset="assets/hero-1280.jpg 1280w, assets/hero-1920.jpg 1920w"
       sizes="(max-width: 768px) 100vw, 50vw"
       alt="Aerial view of Philippine farmland at sunrise"
       width="1920" height="1080"
       loading="eager">
</picture>
```

### Inner Page Images
- **Dimensions:** 800×600px (4:3 aspect ratio)
- **Format:** WebP with JPEG fallback
- **File size:** <100KB (compressed)
- **Location:** `/assets/inner-[name].webp` + `/assets/inner-[name].jpg`
- **Loading:** `loading="lazy"` (below the fold)

### Favicon
- **ICO:** 32×32px, `/favicon.ico`
- **PNG:** 192×192px, `/assets/favicon-192.png`
- **Apple Touch:** 180×180px, `/assets/apple-touch-icon.png`
- **SVG:** Scalable, `/assets/favicon.svg` (for modern browsers)

### OG Image (Social Sharing)
- **Dimensions:** 1200×630px (1.91:1 aspect ratio)
- **Format:** PNG (for text clarity)
- **File size:** <300KB
- **Location:** `/assets/og-image.png`
- **Content:** Sakada logo + tagline + farm imagery background

### Icons (Feature Grid)
- **Format:** SVG (inline or sprite sheet)
- **Dimensions:** 24×24px or 32×32px viewBox
- **Style:** Line icons (stroke, not fill)
- **Color:** `var(--accent-amber)` or `var(--text-muted)`
- **Count:** 6-8 icons for feature grid items

### Empty State Illustration
- **Dimensions:** 200×200px viewBox
- **Format:** SVG (inline)
- **Style:** Simple line illustration, single color (`var(--text-muted)`)
- **Content:** Delivery truck or package icon with dashed circle

### Loading Skeleton Placeholder
- **Dimensions:** Match content area dimensions
- **Format:** CSS-only (no image needed)
- **Color:** `var(--bg-panel)` base with shimmer overlay

---

## Implementation Order

Follow this sequence for maximum efficiency:

### Phase 1: Foundation (P0) — Day 1
1. Add all design tokens to `:root` in `style.css`
2. Create `favicon.ico` and OG meta tags
3. Create `404.html` page
4. Self-host hero image

### Phase 2: Components (P1) — Day 2-3
1. Add SVG icons to feature grid
2. Add hover states to delivery cards
3. Create toast notification system
4. Move status pill colors to tokens

### Phase 3: Polish (P2) — Day 4-5
1. Add loading skeletons
2. Add focus-visible styles
3. Animate notification panel
4. Add disabled states
5. Replace inline styles with classes

### Phase 4: Delight (P3) — Day 6-7
1. Add micro-interactions
2. Add trust signals
3. Add inner page photography
4. Split CSS into components
5. Normalize type scale

### Phase 5: Verify — Day 8
1. Run Lighthouse audit (target: >90 performance, >95 accessibility)
2. Complete accessibility testing checklist
3. Test at all responsive breakpoints
4. Verify reduced motion support
5. Cross-browser testing (Chrome, Firefox, Safari, Edge)

---

## Total Estimated Effort

| Priority | Items | Hours |
|----------|-------|-------|
| P0 | 3 | 4-6 hrs |
| P1 | 5 | 12-17 hrs |
| P2 | 6 | 10-14 hrs |
| P3 | 5 | 18-24 hrs |
| **Total** | **19** | **44-61 hrs** |
