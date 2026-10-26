// Place suggestions under an address field: while the person types, a short
// list of matching places opens below the field so they can tap one instead
// of typing the whole address. Typing without picking still works; what a
// pick means (fill the field, remember the point) is up to the caller.
//
// The field is an ARIA combobox: arrows move the highlight, Enter picks,
// Escape closes, and the number of places found is announced.
//
// Saved addresses (when the caller has any) come first: all of them when the
// field is empty and focused, the matching ones above the map's places
// while typing.
//
// Book's produce rows use the same list for produce names (js/produce-rows.js):
// a local search, from the first letter, with a "Use … as typed" option last.

const MIN_CHARS = 3;
const PAUSE_MS = 250; // wait for a pause in typing before asking the map service

/**
 * @param {object} o
 * @param {HTMLInputElement} o.input   the address field
 * @param {HTMLElement} o.row          the field's row; the list opens 8px under it
 * @param {HTMLElement} o.host         positioned box the list is placed in (full width)
 * @param {(text: string, opts: {signal: AbortSignal}) => Promise<Array<{name: string, detail: string}>>} o.search
 * @param {() => boolean} [o.canSearch] false while offline: no list, typing carries on
 * @param {(place: object) => void} o.onPick
 * @param {{label: string, run: () => void}} [o.emptyAction] offered when nothing matches
 * @param {(text: string) => Array<object>} [o.saved] saved addresses matching the text (all for "")
 * @param {number} [o.minChars] letters before the list opens
 * @param {number} [o.pauseMs] typing pause before searching
 * @param {string} [o.label] the list's name for screen readers
 * @param {[string, string]} [o.noun] one / many, for "3 places found"
 *
 * A result may carry `icon` ("leaf": the pin's mask) or `typed: true` (a
 * plain last row that keeps what was typed).
 */
export function attachPlaceSuggest({
  input, row, host, search, canSearch = () => true, onPick, emptyAction, saved = () => [],
  minChars = MIN_CHARS, pauseMs = PAUSE_MS, label = "Suggested places", noun = ["place", "places"],
}) {
  const id = `${input.id}Places`;
  const box = document.createElement("div");
  box.className = "rq-places";
  box.innerHTML = `
    <p class="rq-places-head" id="${id}Head" hidden>Saved addresses</p>
    <ul class="rq-places-list" role="listbox" id="${id}" aria-label="${label}"></ul>
    <div class="rq-places-empty" hidden>
      <p><strong></strong><span>Check the spelling, or add the town and province.</span></p>
      <button type="button" class="rq-places-action" hidden></button>
    </div>`;
  const status = document.createElement("p");
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  host.append(box, status);
  const list = box.querySelector("ul");
  const empty = box.querySelector(".rq-places-empty");
  const action = box.querySelector(".rq-places-action");
  if (emptyAction) {
    action.textContent = emptyAction.label;
    action.hidden = false;
    action.addEventListener("click", () => {
      close();
      emptyAction.run();
    });
  }

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id);

  const cache = new Map();
  let places = [];
  let active = -1;
  let timer = 0;
  let controller = null;
  const isOpen = () => box.hasAttribute("data-open");

  function open() {
    box.style.top = `${row.offsetTop + row.offsetHeight + 8}px`;
    if (isOpen()) return;
    box.setAttribute("data-open", "");
    input.setAttribute("aria-expanded", "true");
    keepAboveKeyboard();
  }

  function close() {
    clearTimeout(timer);
    controller?.abort();
    if (!isOpen()) return;
    box.removeAttribute("data-open");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
    status.textContent = "";
  }

  const head = box.querySelector(".rq-places-head");
  /** Saved addresses first, then the map's places that aren't the same address. */
  function withSaved(text, results) {
    const mine = saved(text);
    const known = new Set(mine.map((p) => p.address.toLowerCase()));
    return [...mine, ...results.filter((p) => !p.address || !known.has(p.address.toLowerCase()))];
  }

  function show(text, results, { savedOnly = false } = {}) {
    places = results;
    head.hidden = !savedOnly;
    list.setAttribute("aria-label", savedOnly ? "Saved addresses" : label);
    active = -1;
    input.removeAttribute("aria-activedescendant");
    list.replaceChildren(...results.map((p, i) => {
      const li = document.createElement("li");
      li.id = `${id}-${i}`;
      li.className = "rq-place";
      li.dataset.i = i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      if (p.typed) {
        li.classList.add("rq-place--typed");
        li.textContent = p.name;
        return li;
      }
      const pin = document.createElement("span");
      pin.className = p.saved ? "rq-place-pin rq-place-pin--saved" : p.icon ? `rq-place-pin rq-place-pin--${p.icon}` : "rq-place-pin";
      pin.setAttribute("aria-hidden", "true");
      const words = document.createElement("span");
      words.className = "rq-place-words";
      const name = document.createElement("span");
      name.className = "rq-place-name";
      name.textContent = p.name;
      const detail = document.createElement("span");
      detail.className = "rq-place-detail";
      detail.textContent = p.detail;
      words.append(name, detail);
      li.append(pin, words);
      return li;
    }));
    list.hidden = !results.length;
    empty.hidden = results.length > 0;
    empty.querySelector("strong").textContent = `No places match “${text}”`;
    const found = results.filter((p) => !p.typed).length;
    status.textContent = found
      ? `${found} ${savedOnly ? (found === 1 ? "saved address" : "saved addresses") : noun[found === 1 ? 0 : 1]} found`
      : `No ${noun[1]} match ${text}`;
    open();
  }

  function highlight(i) {
    list.querySelector('[aria-selected="true"]')?.setAttribute("aria-selected", "false");
    active = i;
    const li = list.children[i];
    if (!li) return input.removeAttribute("aria-activedescendant");
    li.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", li.id);
    li.scrollIntoView({ block: "nearest" });
  }

  function pick(i) {
    const place = places[i];
    if (!place) return;
    close();
    onPick(place);
  }

  async function lookup(text) {
    controller?.abort();
    controller = new AbortController();
    try {
      const results = await search(text, { signal: controller.signal });
      cache.set(text.toLowerCase(), results);
      // Only show it if they're still on this field and haven't typed on.
      if (document.activeElement === input && input.value.trim() === text) show(text, withSaved(text, results));
    } catch (err) {
      // Map service down: saved matches stay; otherwise no list, typing carries on.
      if (err.name !== "AbortError" && !saved(text).length) close();
    }
  }

  input.addEventListener("input", (e) => {
    if (!e.isTrusted) return; // filled in by code (a pick, Book again), not typed
    const text = input.value.trim();
    clearTimeout(timer);
    if (!text) return showAllSaved();
    if (text.length < minChars || !canSearch()) {
      // Too short for the map (or offline): saved addresses can still match.
      const mine = saved(text);
      return mine.length ? show(text, mine) : close();
    }
    const known = cache.get(text.toLowerCase());
    if (known) return show(text, withSaved(text, known));
    const mine = saved(text);
    if (mine.length) show(text, mine); // right away; the map's places join after the pause
    timer = setTimeout(() => lookup(text), pauseMs);
  });

  /** An empty field: every saved address, so one tap fills it. */
  function showAllSaved() {
    const mine = saved("");
    if (mine.length) show("", mine, { savedOnly: true });
    else close();
  }
  input.addEventListener("focus", () => {
    if (!input.value.trim()) showAllSaved();
  });

  input.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && places.length) {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      highlight(active < 0 ? (down ? 0 : places.length - 1) : Math.min(places.length - 1, Math.max(0, active + (down ? 1 : -1))));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick, don't move the step forward
      pick(active);
    }
  });

  input.addEventListener("blur", close);
  // Keep focus (and the phone keyboard) on the field while a place is tapped.
  box.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const li = e.target.closest('[role="option"]');
    if (li) pick(Number(li.dataset.i));
  });
  list.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const li = e.target.closest('[role="option"]');
    if (li && Number(li.dataset.i) !== active) highlight(Number(li.dataset.i));
  });

  // On a phone the keyboard covers the lower half: scroll just enough that
  // the whole list sits above it, never past the field itself.
  function keepAboveKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    requestAnimationFrame(() => {
      const over = box.getBoundingClientRect().bottom - (vv.offsetTop + vv.height) + 12;
      const room = row.getBoundingClientRect().top - vv.offsetTop - 12;
      if (over > 0 && room > 0) window.scrollBy({ top: Math.min(over, room), behavior: "smooth" });
    });
  }

  return {
    close,
    /** The field is going away (a produce row removed): take the list with it. */
    destroy() {
      close();
      box.remove();
      status.remove();
    },
    /** Saved addresses changed (they just loaded): show them if this empty field has focus. */
    refresh() {
      if (document.activeElement === input && !input.value.trim()) showAllSaved();
    },
  };
}
