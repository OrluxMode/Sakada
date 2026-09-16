---
name: impeccable
description: Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, layout, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.
---

# Impeccable Design Principles for Sakada

This skill enforces professional design standards from the Impeccable design system (https://github.com/pbakaus/impeccable). Every frontend change must follow these principles.

## Core Principles

1. **Go all out.** No hedging, no shortcuts. The deliverable must be complete.
2. **Dream big and bold.** Distinct, beautiful, outstanding work.
3. **Verify in bounded passes, not a loop.** Build fully, inspect once, fix everything in one batch, confirm with at most one more round, and stop polishing.
4. **The brief wins.** Honor pinned aesthetics, fonts, and palettes.
5. **Refinement preserves; redesign replaces.** Ask before replacing factual copy or adding claims.

## Anti-Patterns to Avoid (Critical)

These are the most common AI-generated design failures. Check for them on every UI change:

### Typography
- **Don't use overused fonts** (Arial, Inter, system defaults as the primary brand font)
- **Don't use italic serif display typography** for hero/brand moments
- **Don't mix too many font families** — max 2 (display + body) plus mono

### Color
- **Don't use purple gradients** as a primary accent
- **Don't use gray text on colored backgrounds** — always ensure contrast
- **Don't use pure black/gray** — always tint with warm tones
- **Don't use neon cyan, magenta, or generic AI-tool glow**
- **Don't use glassmorphism** (blur/translucency panels)

### Layout
- **Don't wrap everything in cards** or nest cards inside cards
- **Don't use wide rounded cards** — use tight radii (2-8px)
- **Don't use bounce/elastic easing** — feels dated
- **Don't add decorative elements that don't align with real content**

### Spacing
- **Dark type needs air** — line-height 1.65-1.8 for body text on dark surfaces
- **Max line length 65-75ch** for body copy
- **Use consistent spacing scale** — don't invent random pixel values

## Sakada Design System

### Colors
- **Primary Accent:** `#D4A843` (golden wheat — agricultural warmth)
- **Secondary Accent:** `#2E7D32` (fresh green — growth, harvest)
- **Dark Ground:** `#1a1a1a` (warm black, not pure black)
- **Raised Surface:** `#2a2a2a` (panels, cards)
- **Text Primary:** `#f5f5f0` (warm white)
- **Text Muted:** `#a0a0a0` (captions, meta)
- **Error:** `#c62828` (deep red)
- **Success:** `#2e7d32` (green)
- **Warning:** `#f57f17` (amber)

### Typography
- **Display/Headlines:** Barlow Condensed (600-900 weight)
- **Body/UI:** Public Sans (400-700 weight)
- **Mono/Labels:** SFMono-Regular, Roboto Mono, Consolas

### Spacing Scale
- `--space-xs: 4px`
- `--space-sm: 8px`
- `--space-md: 16px`
- `--space-lg: 24px`
- `--space-xl: 32px`
- `--space-2xl: 48px`
- `--space-3xl: 64px`

### Border Radius
- `--radius-sm: 4px` (inputs, small elements)
- `--radius-md: 8px` (cards, panels)
- `--radius-lg: 12px` (modals, large containers)
- `--radius-pill: 999px` (badges, tags)

### Shadows
- **Subtle:** `0 2px 8px rgba(0,0,0,0.15)`
- **Medium:** `0 4px 16px rgba(0,0,0,0.2)`
- **Large:** `0 8px 32px rgba(0,0,0,0.25)`
- No glow effects, no neon shadows

## Quality Checklist

Before shipping any UI change, verify:

- [ ] **Contrast:** All text passes WCAG AA (4.5:1 for body, 3:1 for large text)
- [ ] **Typography:** No more than 2 font families in use
- [ ] **Color:** No pure black (#000), no pure white (#fff)
- [ ] **Spacing:** Uses the spacing scale, not random values
- [ ] **Radius:** Consistent with the radius tokens
- [ ] **Shadows:** Subtle, warm-toned, no colored glows
- [ ] **Cards:** Not nested, tight radii, clear hierarchy
- [ ] **Buttons:** Clear primary/secondary distinction
- [ ] **Forms:** Labels always visible, clear error states
- [ ] **Responsive:** Works on mobile, tablet, desktop
- [ ] **Loading states:** Skeletons or spinners for async operations
- [ ] **Empty states:** Helpful messages when no data exists
- [ ] **Error states:** Clear, actionable error messages

## Command Reference

When the user asks for design work, follow this flow:

1. **Understand the context** — What page/component? What's the user's goal?
2. **Check existing patterns** — Look at current CSS, components, design tokens
3. **Apply principles** — Use the anti-patterns list and quality checklist
4. **Build complete** — Don't leave half-done work
5. **Verify** — Check against the quality checklist before finishing

### Common Tasks

**New Component:**
- Check existing components for patterns to follow
- Use design tokens (colors, spacing, radius)
- Include hover/focus/active states
- Include loading and empty states
- Ensure responsive behavior

**Refine Existing:**
- Check for anti-patterns first
- Don't break existing patterns
- Improve hierarchy and spacing
- Ensure accessibility

**Critique:**
- Check typography hierarchy
- Check color contrast
- Check spacing consistency
- Check for AI slop patterns
- Provide specific, actionable feedback

## Project Context

Sakada is a logistics platform for agricultural delivery in the Philippines. The design should feel:
- **Professional** — trustworthy for business transactions
- **Warm** — agricultural roots, not cold tech
- **Clear** — farmers, vendors, and drivers need simple UIs
- **Functional** — form follows function, not decoration

The current tech stack is vanilla HTML/CSS/JS with no framework. Design decisions must work within these constraints.
