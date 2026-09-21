/**
 * HTML sanitization utility wrapping DOMPurify.
 * Prevents stored XSS when injecting user-provided data via innerHTML.
 *
 * Usage:
 *   import { sanitizeHTML, sanitizeText } from "./sanitize.js";
 *   el.innerHTML = sanitizeHTML(userInput);
 *   el.textContent = sanitizeText(userInput); // for plain text, no HTML allowed
 */

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "b", "i", "em", "strong", "br", "span", "div",
    "p", "a", "ul", "ol", "li", "img",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "class", "id"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize a string for safe innerHTML injection.
 * Strips all tags except a safe allowlist.
 */
export function sanitizeHTML(dirty) {
  if (typeof dirty !== "string") return "";
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG);
}

/**
 * Sanitize plain text — strips ALL HTML tags.
 * Use for fields that should never contain markup (addresses, names, etc.)
 */
export function sanitizeText(dirty) {
  if (typeof dirty !== "string") return "";
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
