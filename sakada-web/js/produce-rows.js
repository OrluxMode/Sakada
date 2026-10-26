// Book step 2's "What are you shipping?" card (Figma 345:2174–345:2398):
// one row per produce with its own kg, the total under them, and always one
// empty "Add produce" row at the end (up to MAX_PRODUCE).
//
// The rows write the booking's two hidden fields, goodsDescription and
// quantityKg, so the fare, Review and Request booking read them as before.

import { t } from "./i18n.js";
import { attachPlaceSuggest } from "./place-suggest.js";
import {
  MAX_PRODUCE, matchProduce, knownProduce, namedItems, totalKg, formatGoods, parseGoods, checkProduce, kgLabel,
} from "./produce.js";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {object} o
 * @param {HTMLElement} o.card          .rq-produce (positioned: the lists open inside it)
 * @param {HTMLElement} o.list          the <ul> the rows go in
 * @param {HTMLElement} o.total         where "350 kg" is shown
 * @param {HTMLElement} o.error         the line under the card
 * @param {HTMLElement} o.hint          the hint under the card
 * @param {HTMLInputElement} o.goods    hidden goods_description
 * @param {HTMLInputElement} o.kg       hidden quantity_kg
 * @param {(o: {name: string, kg: number|null}) => Promise<number|null>} o.chooseKg  the kg wheel
 */
export function createProduceRows({ card, list, total, error, hint, goods, kg, chooseKg }) {
  const hintText = hint.textContent;
  let nextId = 1;
  let showingError = false;

  const rows = () => [...list.children].filter((li) => !li.dataset.leaving);
  const valueOf = (li) => ({ name: li._name.value, kg: li._kg });

  function makeRow({ name = "", kg: rowKg = null } = {}) {
    const n = nextId++;
    const li = document.createElement("li");
    li.className = "rq-prow";
    li.innerHTML = `
      <input class="rq-pname" id="produce${n}" type="text" placeholder="${t("Add produce")}" autocomplete="off"
        autocapitalize="words" enterkeyhint="next" maxlength="40" spellcheck="false" />
      <button type="button" class="rq-kgchip"></button>
      <button type="button" class="rq-premove"></button>`;
    li._name = li.querySelector("input");
    li._chip = li.querySelector(".rq-kgchip");
    li._remove = li.querySelector(".rq-premove");
    li._name.value = name;
    li._kg = rowKg;

    li._suggest = attachPlaceSuggest({
      input: li._name,
      row: li,
      host: card,
      minChars: 1,
      pauseMs: 0,
      label: t("Produce"),
      noun: [t("produce"), t("produce")],
      search: async (text) => {
        const found = matchProduce(text);
        const exact = found.some((p) => p.name.toLowerCase() === text.toLowerCase());
        return exact ? found : [...found, { name: t("Use “{text}” as typed", { text }), typed: true, value: text }];
      },
      onPick: (p) => picked(li, p.typed ? p.value : p.name),
    });
    li._name.addEventListener("input", () => {
      // The next row arrives with the first letter, not on leaving the field:
      // a row added on blur would push Review booking down mid-tap.
      if (li._name.value.trim() && rows().at(-1) === li) addEmptyRow();
      paint(li);
      sync();
    });
    // "tomatoes" typed in full and left: the list's own spelling.
    li._name.addEventListener("change", () => {
      const known = knownProduce(li._name.value);
      if (known && known.toLowerCase() === li._name.value.trim().toLowerCase()) li._name.value = known;
      sync();
    });
    li._chip.addEventListener("click", () => openKg(li));
    li._remove.addEventListener("click", () => removeRow(li));
    paint(li);
    return li;
  }

  /** Labels and states for one row (numbers count from 1 for screen readers). */
  function paint(li) {
    const i = rows().indexOf(li) + 1 || rows().length + 1;
    const name = li._name.value.trim();
    li._name.setAttribute("aria-label", t("Produce {n}", { n: i }));
    const state = li._kg ? "set" : name && "missing" in li.dataset ? "error" : "empty";
    li._chip.dataset.state = state;
    li._chip.textContent = li._kg ? kgLabel(li._kg) : state === "error" ? t("Set kg") : "kg";
    li._chip.disabled = !name && !li._kg;
    li._chip.setAttribute("aria-label", li._kg
      ? t("{name}: {kg}. Change the kg", { name: name || t("Produce"), kg: kgLabel(li._kg) })
      : t("Set the kg for {name}", { name: name || t("produce {n}", { n: i }) }));
    const last = rows().at(-1) === li;
    li._remove.hidden = last && !name && !li._kg;
    li._remove.setAttribute("aria-label", t("Remove {name}", { name: name || t("produce {n}", { n: i }) }));
  }

  /** Write the hidden fields and the total. */
  function sync() {
    const items = namedItems(rows().map(valueOf));
    const sum = totalKg(items);
    total.textContent = kgLabel(sum);
    const complete = items.length && items.every((r) => r.kg);
    goods.value = complete ? formatGoods(items) : "";
    kg.value = complete ? String(sum) : "";
    const full = rows().length >= MAX_PRODUCE && rows().every((li) => li._name.value.trim());
    hint.textContent = full ? t("That's {n} produce, the most for one booking.", { n: MAX_PRODUCE }) : hintText;
    if (showingError) validate({ focus: false, quiet: true });
  }

  /** Keep one empty row at the end while there's room. */
  function addEmptyRow({ animate = true } = {}) {
    const all = rows();
    const last = all.at(-1);
    if (last && !last._name.value.trim() && !last._kg) return;
    if (all.length >= MAX_PRODUCE) return;
    const li = makeRow();
    list.append(li);
    rows().forEach(paint);
    if (animate && !reduceMotion()) {
      li.style.overflow = "hidden"; // only while it grows, so focus rings aren't cut later
      const grow = li.animate([{ height: "0px", opacity: 0 }, { height: `${li.offsetHeight}px`, opacity: 1 }], { duration: 200, easing: EASE_OUT });
      grow.finished.then(() => (li.style.overflow = ""), () => (li.style.overflow = ""));
    }
  }

  function removeRow(li) {
    const all = rows();
    const at = all.indexOf(li);
    li.dataset.leaving = "";
    li._suggest.destroy();
    const done = () => {
      li.remove();
      if (!rows().length) list.append(makeRow());
      addEmptyRow({ animate: false });
      rows().forEach(paint);
      sync();
      const next = rows()[Math.min(at, rows().length - 1)];
      next?._name.focus({ preventScroll: true });
    };
    if (reduceMotion()) return done();
    li.style.overflow = "hidden";
    li.animate([{ height: `${li.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 150, easing: EASE_OUT }).finished.then(done, done);
  }

  /** A produce from the list (or kept as typed): fill the row, add the next, ask for its kg. */
  function picked(li, name) {
    li._name.value = name;
    paint(li);
    addEmptyRow();
    sync();
    if (!li._kg) openKg(li);
  }

  async function openKg(li) {
    const name = li._name.value.trim();
    if (!name && !li._kg) return;
    li._chip.focus({ preventScroll: true }); // the sheet hands focus back here, not to the keyboard
    li._chip.dataset.open = "";
    const chosen = await chooseKg({ name: name || t("Produce"), kg: li._kg });
    delete li._chip.dataset.open;
    if (chosen == null) return;
    li._kg = chosen;
    delete li.dataset.missing;
    paint(li);
    addEmptyRow();
    sync();
  }

  /**
   * Show the first problem under the card. Returns true when the rows can be
   * booked. `focus` moves to the row at fault; `quiet` only clears or
   * updates an error that's already showing.
   */
  function validate({ focus = true, quiet = false } = {}) {
    const all = rows();
    const problem = checkProduce(all.map(valueOf));
    all.forEach((li) => {
      const missing = problem && li._name.value.trim() && !li._kg;
      if (missing && !quiet) li.dataset.missing = "";
      if (!missing) delete li.dataset.missing;
      paint(li);
    });
    showingError = Boolean(problem);
    error.textContent = problem?.message || "";
    error.hidden = !problem;
    card.toggleAttribute("data-invalid", Boolean(problem));
    if (problem && focus) {
      const li = all[Math.max(0, problem.row)] || all[0];
      if (li._name.value.trim() && !li._kg) li._chip.focus();
      else li._name.focus();
    }
    return !problem;
  }

  /** Start over with these rows (Book again, a new booking). */
  function load(goodsText = "", kgValue = "") {
    rows().forEach((li) => li._suggest.destroy());
    list.replaceChildren(...parseGoods(goodsText, kgValue).slice(0, MAX_PRODUCE).map(makeRow));
    if (!list.children.length) list.append(makeRow());
    addEmptyRow({ animate: false });
    rows().forEach(paint);
    showingError = false;
    error.hidden = true;
    card.removeAttribute("data-invalid");
    sync();
  }

  load();
  return {
    load,
    clear: () => load(),
    validate,
    ok: () => !checkProduce(rows().map(valueOf)),
    /** Named rows with their kg, for Review. */
    items: () => namedItems(rows().map(valueOf)),
  };
}
