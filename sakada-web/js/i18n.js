// Language: English, Filipino or Taglish (Figma 349:2721). Chosen in
// Profile, saved on the phone and on the account (profiles.language).
//
// Strings are keyed by their English text, so code reads as before:
// t("Review booking") gives "Suriin ang padala" in Filipino. A string with
// no translation stays English. Values in braces are filled in:
// t("Set the kg for {name}.", { name }).
//
// Only pages that call useLanguage() switch: the farmer/vendor app and
// log in / sign up. The public website and the driver app stay English.

import FIL from "./i18n-fil.js";
import TAGLISH from "./i18n-taglish.js";

export const LANGUAGES = [
  { id: "en", name: "English", sample: "A driver accepted your booking SK-00007." },
  { id: "fil", name: "Filipino", sample: "Tinanggap na ng drayber ang iyong padala SK-00007." },
  { id: "taglish", name: "Taglish", sample: "May driver na! Na-accept na ang booking mo SK-00007." },
];
const TABLES = { fil: FIL, taglish: TAGLISH };
const STORE = "sakada.lang";
const isLang = (id) => LANGUAGES.some((l) => l.id === id);

let lang = "en";

/** The language saved on this phone ("en" when none, or storage is off). */
export function savedLanguage() {
  try {
    const id = localStorage.getItem(STORE);
    return isLang(id) ? id : "en";
  } catch {
    return "en";
  }
}

/** This page follows the chosen language. `account` (profiles.language) wins over the phone's. */
export function useLanguage(account) {
  lang = isLang(account) ? account : savedLanguage();
  remember(lang);
  document.documentElement.lang = lang === "en" ? "en" : "fil";
  return lang;
}

export const currentLanguage = () => lang;

function remember(id) {
  try {
    localStorage.setItem(STORE, id);
  } catch { /* private mode: the account still has it */ }
}

/** Choose a language on this phone (the caller saves it to the account). */
export function chooseLanguage(id) {
  if (!isLang(id)) return;
  remember(id);
}

/** The string in the current language, with {name} parts filled in. */
export function t(english, values) {
  const text = (lang !== "en" && TABLES[lang][english]) || english;
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole));
}

/** Dates: Filipino month and day names in Filipino; Taglish reads English dates. */
export const dateLocale = () => (lang === "fil" ? "fil-PH" : "en-GB");

const ATTRS = ["placeholder", "aria-label", "title"];

/**
 * Translate the page's own words (headings, labels, buttons) once, at load.
 * Text that code fills in later uses t() itself. `[data-i18n-skip]` keeps
 * a part as it is (names, codes).
 */
export function translatePage(root = document.body) {
  if (lang === "en") return;
  const table = TABLES[lang];
  if (root === document.body && table[document.title]) document.title = table[document.title];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === 1) {
        if (node.matches("script, style, svg, [data-i18n-skip]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const raw = node.nodeValue;
    const key = raw.trim();
    if (key && table[key]) node.nodeValue = raw.replace(key, table[key]);
  }
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))) {
    if (el.closest("[data-i18n-skip]")) continue;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && table[v]) el.setAttribute(a, table[v]);
    }
  }
}
