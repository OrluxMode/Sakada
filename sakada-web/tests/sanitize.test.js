import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

const dom = new JSDOM("");
const purify = DOMPurify(dom.window);

// Inject into global so sanitize.js can use it
globalThis.DOMPurify = purify;

const { sanitizeHTML, sanitizeText } = await import("../js/sanitize.js");

describe("sanitizeHTML", () => {
  it("allows safe tags", () => {
    expect(sanitizeHTML("<b>bold</b>")).toBe("<b>bold</b>");
    expect(sanitizeHTML("<i>italic</i>")).toBe("<i>italic</i>");
    expect(sanitizeHTML("<strong>strong</strong>")).toBe(
      "<strong>strong</strong>",
    );
  });

  it("strips script tags completely (including content)", () => {
    // DOMPurify removes script tags AND their content
    expect(sanitizeHTML('<script>alert("xss")</script>')).toBe("");
  });

  it("strips event handlers", () => {
    expect(sanitizeHTML('<img src=x onerror=alert(1)>')).toBe(
      '<img src="x">',
    );
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeHTML(null)).toBe("");
    expect(sanitizeHTML(undefined)).toBe("");
    expect(sanitizeHTML(123)).toBe("");
  });

  it("allows links", () => {
    expect(sanitizeHTML('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>',
    );
  });

  it("strips disallowed tags but keeps their text content", () => {
    // DOMPurify strips <script> tags and their content entirely
    const result = sanitizeHTML("<div>hello</div><script>bad</script>");
    expect(result).toContain("<div>hello</div>");
    expect(result).not.toContain("bad");
  });
});

describe("sanitizeText", () => {
  it("strips all HTML tags", () => {
    expect(sanitizeText("<b>bold</b>")).toBe("bold");
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe("");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(42)).toBe("");
  });

  it("preserves plain text", () => {
    expect(sanitizeText("Hello World")).toBe("Hello World");
    expect(sanitizeText("Barangay San Roque, La Trinidad")).toBe(
      "Barangay San Roque, La Trinidad",
    );
  });

  it("handles XSS attempts", () => {
    expect(sanitizeText('<svg onload=alert(1)>')).toBe("");
    // DOMPurify HTML-encodes special chars in text mode
    const result = sanitizeText('"><script>alert(1)</script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });
});
