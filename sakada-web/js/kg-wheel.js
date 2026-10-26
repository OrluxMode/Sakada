// The kg wheel (Figma 346:2376, 346:2444): a bottom sheet with a column of
// weights that scrolls and snaps into the amber band, like a phone's own
// picker. The scrolling is the browser's, so a flick keeps its momentum and
// always lands on a stop. Tap the number in the band (or "type an exact
// weight") to type any whole kg instead.
//
// For keyboards and screen readers the wheel is a spin button: ↑ ↓ one stop,
// Page Up / Page Down ten, Home / End the ends.

import { kgStepsWith, kgLabel } from "./produce.js";
import { checkKg } from "./validators.js";
import { showFieldError } from "./field-errors.js";
import { liftAboveKeyboard } from "./contact-sheet.js";

const ROW = 48; // px per stop; the band is the middle row of five
const START_KG = 100;
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createKgWheel({ dialog, openSheet, closeSheet }) {
  const $ = (id) => dialog.querySelector(`#${id}`);
  const wheel = $("kgWheel");
  const listEl = $("kgWheelList");
  const exact = $("kgExact");
  const useBtn = $("useKg");
  liftAboveKeyboard(dialog);

  let steps = [];
  let index = 0;
  let typing = false;
  let resolve = null;
  let frame = 0;
  let aim = null; // the stop the keys are heading for while the wheel glides there

  function render(kg) {
    const next = kgStepsWith(kg);
    if (next === steps) return;
    steps = next;
    listEl.replaceChildren(...steps.map((value, i) => {
      const li = document.createElement("li");
      li.textContent = value.toLocaleString("en-PH");
      li.dataset.i = i;
      return li;
    }));
  }

  /** Values shrink and fade with distance from the band (transform and opacity only). */
  function paint() {
    frame = 0;
    const centre = wheel.scrollTop / ROW;
    const from = Math.max(0, Math.floor(centre) - 3);
    const to = Math.min(steps.length - 1, Math.ceil(centre) + 3);
    for (let i = from; i <= to; i++) {
      const li = listEl.children[i];
      const d = Math.min(Math.abs(i - centre), 2.5);
      li.style.transform = `scale(${1 - d * 0.14})`;
      li.style.opacity = String(1 - d * 0.3);
      li.toggleAttribute("data-on", d < 0.5);
    }
    const i = Math.min(steps.length - 1, Math.max(0, Math.round(centre)));
    if (aim !== null) {
      if (Math.abs(centre - aim) < 0.02) aim = null; // arrived
      return;
    }
    if (i !== index) setIndex(i);
  }
  wheel.addEventListener("scroll", () => {
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  // A finger or mouse wheel takes over from the keys.
  for (const type of ["pointerdown", "wheel", "touchstart"]) wheel.addEventListener(type, () => (aim = null), { passive: true });

  function setIndex(i) {
    index = i;
    const kg = steps[i];
    wheel.setAttribute("aria-valuenow", String(kg));
    wheel.setAttribute("aria-valuetext", `${kg.toLocaleString("en-PH")} kilograms`);
    if (!typing) useBtn.textContent = `Use ${kgLabel(kg)}`;
  }

  /** Glide to a stop. The value changes now, so quick key presses add up. */
  function scrollToIndex(i, { smooth = true } = {}) {
    const to = Math.min(steps.length - 1, Math.max(0, i));
    const glide = smooth && !reduceMotion();
    aim = glide ? to : null;
    setIndex(to);
    wheel.scrollTo({ top: to * ROW, behavior: glide ? "smooth" : "auto" });
    if (!glide) paint();
  }

  wheel.addEventListener("keydown", (e) => {
    const move = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }[e.key];
    if (move) scrollToIndex(index + move);
    else if (e.key === "Home") scrollToIndex(0);
    else if (e.key === "End") scrollToIndex(steps.length - 1);
    else if (e.key === "Enter") use();
    else return;
    e.preventDefault();
  });
  // Tap a value to bring it to the band; tap the one in the band to type.
  listEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const i = Number(li.dataset.i);
    if (i === index) setTyping(true);
    else scrollToIndex(i);
  });

  function setTyping(on) {
    typing = on;
    $("kgPick").hidden = on;
    $("kgType").hidden = !on;
    showFieldError(exact, "");
    if (on) {
      exact.value = String(steps[index]);
      useBtn.textContent = `Use ${kgLabel(steps[index])}`;
      exact.focus();
      exact.select();
    } else {
      const kg = Number(exact.value);
      if (!checkKg(exact.value)) {
        render(kg);
        scrollToIndex(steps.indexOf(kg), { smooth: false });
      }
      setIndex(index);
      wheel.focus();
    }
  }
  $("kgTypeBtn").addEventListener("click", () => setTyping(true));
  $("kgWheelBtn").addEventListener("click", () => setTyping(false));
  exact.addEventListener("input", () => {
    exact.value = exact.value.replace(/\D/g, "");
    const ok = !checkKg(exact.value);
    useBtn.textContent = ok ? `Use ${kgLabel(Number(exact.value))}` : "Use this weight";
    if (exact.getAttribute("aria-invalid") === "true" && ok) showFieldError(exact, "");
  });
  exact.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      use();
    }
  });

  function use() {
    let kg = steps[index];
    if (typing) {
      const problem = checkKg(exact.value);
      if (problem) {
        showFieldError(exact, problem);
        exact.focus();
        return;
      }
      kg = Number(exact.value);
    }
    finish(kg);
    closeSheet(dialog);
  }
  useBtn.addEventListener("click", use);

  function finish(kg) {
    resolve?.(kg);
    resolve = null;
  }
  dialog.addEventListener("close", () => finish(null)); // Close, the scrim, Escape, a drag down

  /** Ask for a kg. Resolves with the number, or null when the sheet is closed without one. */
  function choose({ name, kg }) {
    finish(null);
    $("kgSheetTitle").textContent = name;
    render(kg || START_KG);
    typing = false;
    $("kgPick").hidden = false;
    $("kgType").hidden = true;
    showFieldError(exact, "");
    openSheet(dialog);
    // The sheet is on screen now (showModal), so the wheel can be placed before it slides up.
    const at = steps.indexOf(kg || START_KG);
    index = -1;
    scrollToIndex(at < 0 ? steps.indexOf(START_KG) : at, { smooth: false });
    wheel.focus({ preventScroll: true, focusVisible: false }); // keys work at once; no ring after a tap
    return new Promise((r) => (resolve = r));
  }

  return { choose };
}
