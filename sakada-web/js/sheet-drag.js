// Drag-to-dismiss for the bottom sheets on phones.
// The sheet follows the finger 1:1, resists when pulled up, and on release
// either springs back or carries the finger's speed off-screen.

/** Progressive resistance past a boundary: the further you pull, the less it follows. */
export function rubberband(overshoot, dimension, c = 0.55) {
  return (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));
}

/** Where a flick at `velocity` px/s would come to rest, like scroll deceleration. */
export function project(velocity, decelerationRate = 0.99) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Critically damped spring (no bounce) from `from` to `to`, starting at
 * `velocity` px/s. Solved exactly per frame, so a slow frame can't make it
 * overshoot. Returns a cancel function.
 */
export function animateSpring(from, to, velocity, onFrame, onDone, {
  response = 0.3,
  raf = requestAnimationFrame,
  caf = cancelAnimationFrame,
  now = () => performance.now(),
} = {}) {
  const w = (2 * Math.PI) / response;
  const x0 = from - to;
  const b = velocity + w * x0;
  const start = now();
  let id = raf(function step() {
    const t = (now() - start) / 1000;
    const decay = Math.exp(-w * t);
    const x = (x0 + b * t) * decay;
    const v = (b - w * (x0 + b * t)) * decay;
    if (Math.abs(x) < 0.5 && Math.abs(v) < 5) {
      onFrame(to);
      onDone?.();
      return;
    }
    onFrame(to + x);
    id = raf(step);
  });
  return () => caf(id);
}

/** Speed in px/s over the last 100ms of samples ({ y, t } with t in ms). */
export function releaseVelocity(samples) {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= 100) || last;
  const dt = (last.t - first.t) / 1000;
  return dt > 0 ? (last.y - first.y) / dt : 0;
}

function currentY(el) {
  const t = getComputedStyle(el).transform;
  return t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
}

/**
 * Let the sheet's grab bar and heading drag it. The list inside keeps its own
 * scrolling. `canDrag` decides per gesture (phones only); `onGrab` runs when a
 * finger catches the sheet, so a closing sheet can be caught mid-flight;
 * `onDismiss({ offscreen })` closes it.
 */
export function enableSheetDrag(dialog, { onDismiss, onGrab, canDrag = () => true }) {
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const handles = dialog.querySelectorAll(":scope > .rq-sheet-grab, :scope > .rq-sheet-head, :scope > h2");
  let drag = null;
  let stopSpring = null;

  const moveTo = (y) => (dialog.style.transform = `translateY(${y}px)`);
  const letGo = () => {
    dialog.style.transform = "";
    dialog.style.transition = "";
  };

  function down(e) {
    if (!canDrag() || e.button > 0) return;
    stopSpring?.();
    stopSpring = null;
    onGrab?.();
    // Start from where the sheet is on screen, even mid-animation.
    const y = currentY(dialog);
    dialog.style.transition = "none";
    moveTo(y);
    drag = { id: e.pointerId, offset: e.clientY - y, y, height: dialog.offsetHeight, samples: [{ y, t: e.timeStamp }] };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    let y = e.clientY - drag.offset;
    if (y < 0) y = -rubberband(-y, drag.height);
    drag.y = y;
    drag.samples.push({ y, t: e.timeStamp });
    if (drag.samples.length > 6) drag.samples.shift();
    moveTo(y);
  }

  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { y, height, samples } = drag;
    drag = null;
    const v = e.type === "pointercancel" ? 0 : releaseVelocity(samples);
    const dismiss = y + project(v) > height * 0.35 || v > 600;

    if (reduceMotion()) {
      letGo();
      if (dismiss) onDismiss({ offscreen: false });
      return;
    }
    if (dismiss) {
      stopSpring = animateSpring(y, height, Math.max(v, 0), moveTo, () => {
        stopSpring = null;
        onDismiss({ offscreen: true });
      });
    } else {
      // Pulled down and let go: settle at the top without lifting past it.
      const clamp = y >= 0 ? (x) => moveTo(Math.max(x, 0)) : moveTo;
      stopSpring = animateSpring(y, 0, v, clamp, () => {
        stopSpring = null;
        letGo();
      });
    }
  }

  handles.forEach((h) => {
    h.addEventListener("pointerdown", down);
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  });
  dialog.addEventListener("close", () => {
    stopSpring?.();
    stopSpring = null;
    drag = null;
    letGo();
  });
}
