import { t } from "./i18n.js";
// Show / Hide inside a password field (Figma 338:2083): the button says what
// it does in words, which is easier to spot than the eye icon it replaced.

export function wirePasswordToggle(button, input) {
  const paint = () => {
    const shown = input.type === "text";
    button.innerHTML = `${t(shown ? "Hide" : "Show")}<span class="visually-hidden"> ${t("password")}</span>`;
  };
  button.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    paint();
  });
  paint();
}
