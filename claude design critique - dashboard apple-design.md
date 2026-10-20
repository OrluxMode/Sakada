# Farmer / vendor dashboard — Apple-design pass

**Date:** 2026-10-20 · **Skills:** apple-design, impeccable (Operate mode)
**Target (live code):** `sakada-web/dashboard/{farmer,vendor}/index.html`, `css/requester.css`, `js/requester-dashboard.js`
**Status:** findings only. No code changed. Build prompt: `opencode prompt - dashboard apple feel.md`.

## Verdict

The layout, copy and booking flow are solid. They follow the approved v4 design and already pass earlier critiques. What's missing is **feel**. The dashboard currently has no motion at all: buttons don't react to a press, sheets snap in and out, and the most important moments (fare ready, booking sent, driver accepted) happen without anything marking them. The sheets also show a drag handle that can't actually be dragged.

Every fix below is behavior only: no new layout, colours, copy or dependencies. All of it is plain CSS plus a small amount of vanilla JS, and it stays inside the budget-Android constraint (only `transform` and `opacity` animate; nothing loops).

## Findings

### P1. No press feedback anywhere (§1 Response, §10 Tap)
`.rq-btn`, `.rq-row`, `.rq-help`, `.rq-filter`, `.rq-tabs a`, `.rq-topnav a`, `.rq-stars button`, `.rq-notif` and `.rq-bell` have no `:active` state. The older `.btn-primary` classes in `ui-feedback.css` scale to 0.97, but the `rq` dashboard doesn't use them. On a phone, a tap gives nothing back until the network responds, so on slow connections people tap twice.
**Fix:** react the moment the finger goes down:
- Solid buttons scale to 0.97 (100ms ease-out).
- List rows and notifications get a background tint instead of shrinking.
- The active tab icon scales to 0.92.
- Stars scale to 0.88.
- Add `touch-action: manipulation` and remove the grey tap flash (`-webkit-tap-highlight-color: transparent`), because the new pressed state replaces it.

### P1. The sheet drag handle can't be dragged (§2 Direct manipulation, §16 Familiarity)
The notifications and cancel sheets show a grab bar (`.rq-sheet-grab`), which every phone user reads as "drag me down". Nothing happens when they try. A control that looks interactive but isn't breaks trust.
**Fix:** on phones (`max-width: 1023px`, `pointer: coarse`), make the grab bar and the sheet heading draggable:
- The sheet follows the finger 1:1, keeping the spot where it was grabbed.
- Dragging upward meets rubber-band resistance.
- On release, the sheet closes if the projected landing point is past 35% of its height, or if the finger was moving down faster than 600px/s. Otherwise it springs back.
- The spring is critically damped (no bounce) and starts at the finger's release speed.
- The notification list keeps its own scrolling: only the handle and heading start a drag.
- Desktop shows the sheet centred, so the grab bar is hidden there.

### P1. Sheets snap in and out (§7 Spatial consistency, §3 Interruptibility)
`showModal()` and `close()` toggle instantly. A bottom sheet should rise from the bottom edge and go back down the same way.
**Fix:**
- **Phone:** slide in from `translateY(100%)`; close by sliding back down, then call `close()`. The backdrop fades with it.
- **Desktop:** the centred sheet fades in while scaling from 0.96 to 1, and reverses the same path on close.
- Closing via Escape, a scrim tap or the Close button all use the same exit animation.
- A drag that starts during the open animation takes over from the sheet's current on-screen position, with no jump.

### P2. "Your fare" and "Booked" appear abruptly (§16 completion feedback, §8 Hint direction)
The quote card is the payoff of the booking form, and the Booked banner confirms the booking went through. Both pop in with `hidden = false`.
**Fix:** a single short entrance for both: opacity 0→1 and translateY 8px→0 over 220ms ease-out. The stale-fare card swaps in instantly, because a sudden change signals "redo this". Do not count up the fare amount: it's an exact price, not a score.

### P2. Driver accepting a booking goes unmarked (§13 Causality)
When the status changes, the realtime update calls `loadDeliveries()`, and the card is redrawn with `innerHTML`. The stepper simply jumps to its new state, so the moment the user is waiting for (a driver accepted, the goods were picked up) looks the same as any refresh.
**Fix:**
- Remember each delivery's previous status between renders.
- If a status moved forward, give that card's new current step a one-time `.is-advanced` class: the bar grows from the left (`scaleX` 0→1, 400ms ease-out, `transform-origin: left`).
- The card gets a 1.2s amber outline that fades away.
- This plays once per change, never on first load and never for history cards.

### P3. Cancelled cards vanish without leaving (§7)
After cancellation the list is redrawn and the card is simply gone.
**Fix:** fade the cancelled card out and slide it 8px down (180ms), then redraw. The cancel sheet's exit and the card's exit then read as one continuous action.

### P3. Large-heading tracking (§15 Typography)
`.rq-display` uses Barlow Condensed 800 at 44px (desktop) and 32px (phone) with no tracking. Condensed heavy type at 44px benefits from slightly tighter spacing: `letter-spacing: -0.01em` on desktop only. Body text stays at 0.

## Considered and rejected

- **Translucent, blurred tab bar and top bar (§12 Materials).** Rejected. PRODUCT.md targets budget Android phones on slow connections, where `backdrop-filter` over a scrolling page costs GPU on every frame. The tab bar sits over a plain grid background, so blur would add little. Keep the solid `#15160f`.
- **Animated tab switching.** Rejected. Apple doesn't animate tab switches either: it's instant, which is correct. Keep it.
- **Bouncy springs.** No interaction here involves a throw. Everything stays critically damped (no overshoot).
- **Sound and vibration (§13).** Rejected. The Vibration API is Android-only and not worth adding for this.

## Reduced motion

`base.css` already cuts every CSS animation to 0.01ms under `prefers-reduced-motion`. The JS sheet spring must check `matchMedia("(prefers-reduced-motion: reduce)")` too, and switch to a 150ms opacity fade with no slide. Dragging still works, because moving with the finger isn't decorative motion.

## Not verified

These findings come from reading the code, not from running the app on a device. After the build, test the sheet drag on a real Android phone (Chrome) and on iOS Safari.
