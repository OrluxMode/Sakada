// Swipe-to-start on the phone welcome screen (index.html).
// The amber knob follows the finger 1:1, resists past either end, and on
// release either springs home or, if the swipe (or flick) carries it far
// enough, finishes the trip and opens the link. A plain tap slides the knob
// across by itself, so nobody is stuck if they can't swipe. Keyboard and
// screen-reader activation still follow the link straight away.

import { rubberband, project, animateSpring, releaseVelocity } from "./sheet-drag.js";

/** Share of the track the knob (plus its flick) must reach to count. */
export const COMPLETE_AT = 0.6;

/** "complete" or "back" for a knob released at `x` px moving `velocity` px/s. */
export function swipeOutcome(x, velocity, max) {
  if (max <= 0) return "back";
  const landing = x + project(velocity);
  return landing >= max * COMPLETE_AT ? "complete" : "back";
}

function enableSwipe(link) {
  const knob = link.querySelector(".welcome-start-knob");
  const fading = link.querySelectorAll(".welcome-start-text, .welcome-start-chevron");
  if (!knob) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let x = 0;
  let max = 0;
  let start = null; // { pointerX, knobX }
  let samples = [];
  let dragged = false;
  let busy = false; // finishing the trip; ignore input until the page changes
  let cancelSpring = () => {};

  const measure = () => link.clientWidth - knob.offsetLeft * 2 - knob.offsetWidth;

  function render() {
    const grabbed = start ? " scale(0.96)" : "";
    knob.style.transform = `translateX(${x}px)${grabbed}`;
    const progress = max > 0 ? Math.min(Math.max(x / max, 0), 1) : 0;
    const opacity = String(Math.max(1 - progress * 1.6, 0));
    fading.forEach((el) => (el.style.opacity = opacity));
  }

  function springTo(target, velocity, onDone) {
    cancelSpring();
    if (reduce.matches) {
      x = target;
      render();
      onDone?.();
      return;
    }
    cancelSpring = animateSpring(x, target, velocity, (value) => {
      x = value;
      render();
    }, onDone, { response: 0.35 });
  }

  function finish(velocity = 0) {
    busy = true;
    link.classList.add("is-done");
    springTo(max, velocity, () => window.location.assign(link.href));
  }

  link.addEventListener("pointerdown", (e) => {
    if (busy || !e.isPrimary || e.button !== 0) return;
    cancelSpring();
    max = measure();
    start = { pointerX: e.clientX, knobX: x };
    samples = [{ y: e.clientX, t: e.timeStamp }];
    dragged = false;
    link.setPointerCapture(e.pointerId);
    render();
  });

  link.addEventListener("pointermove", (e) => {
    if (!start || !e.isPrimary) return;
    const dx = e.clientX - start.pointerX;
    if (!dragged && Math.abs(dx) < 6) return; // small wobble is still a tap
    dragged = true;
    const raw = start.knobX + dx;
    if (raw < 0) x = rubberband(raw, max);
    else if (raw > max) x = max + rubberband(raw - max, max);
    else x = raw;
    samples.push({ y: e.clientX, t: e.timeStamp });
    if (samples.length > 8) samples.shift();
    render();
  });

  function release(e) {
    if (!start || !e.isPrimary) return;
    start = null;
    if (!dragged) {
      render();
      return; // the click handler deals with taps
    }
    const velocity = releaseVelocity(samples);
    if (swipeOutcome(x, velocity, max) === "complete") finish(Math.max(velocity, 0));
    else springTo(0, velocity);
  }

  link.addEventListener("pointerup", release);
  link.addEventListener("pointercancel", () => {
    if (!start) return;
    start = null;
    springTo(0, 0);
  });

  link.addEventListener("click", (e) => {
    // Keyboard and assistive tech (detail 0) just follow the link.
    if (e.detail === 0) return;
    e.preventDefault();
    if (busy || dragged) return;
    max = measure();
    finish();
  });

  // Stops desktop browsers dragging the link itself around.
  link.addEventListener("dragstart", (e) => e.preventDefault());

  // Coming back with the Back button restores the page from cache with the
  // knob still at the end; put it home again.
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    cancelSpring();
    busy = false;
    start = null;
    x = 0;
    link.classList.remove("is-done");
    render();
  });
}

if (typeof document !== "undefined") {
  const link = document.querySelector(".welcome-start");
  if (link) enableSwipe(link);
}
