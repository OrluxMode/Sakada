// Place suggestions under an address field: while the person types, a short
// list of matching places opens below the field so they can tap one instead
// of typing the whole address. Typing without picking still works; what a
// pick means (fill the field, remember the point) is up to the caller.
//
// The field is an ARIA combobox: arrows move the highlight, Enter picks,
// Escape closes, and the number of places found is announced.

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
 */
export function attachPlaceSuggest({ input, row, host, search, canSearch = () => true, onPick, emptyAction }) {
  const id = `${input.id}Places`;
  const box = document.createElement("div");
  box.className = "rq-places";
  box.innerHTML = `
    <ul class="rq-places-list" role="listbox" id="${id}" aria-label="Suggested places"></ul>
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

  function show(text, results) {
    places = results;
    active = -1;
    input.removeAttribute("aria-activedescendant");
    list.replaceChildren(...results.map((p, i) => {
      const li = document.createElement("li");
      li.id = `${id}-${i}`;
      li.className = "rq-place";
      li.dataset.i = i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      const pin = document.createElement("span");
      pin.className = "rq-place-pin";
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
    status.textContent = results.length
      ? `${results.length} ${results.length === 1 ? "place" : "places"} found`
      : `No places match ${text}`;
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
      if (document.activeElement === input && input.value.trim() === text) show(text, results);
    } catch (err) {
      if (err.name !== "AbortError") close(); // map service down: no list, typing carries on
    }
  }

  input.addEventListener("input", (e) => {
    if (!e.isTrusted) return; // filled in by code (a pick, Book again), not typed
    const text = input.value.trim();
    clearTimeout(timer);
    if (text.length < MIN_CHARS || !canSearch()) return close();
    const known = cache.get(text.toLowerCase());
    if (known) return show(text, known);
    timer = setTimeout(() => lookup(text), PAUSE_MS);
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

  return { close };
}
