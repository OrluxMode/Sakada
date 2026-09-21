const TOAST_DURATION = 4000;
const MAX_VISIBLE = 3;

let container = null;
let visibleCount = 0;

function ensureContainer() {
  if (container) return;
  container = document.createElement("div");
  container.className = "toast-container";
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-relevant", "additions");
  document.body.appendChild(container);
}

function iconForType(type) {
  if (type === "success") return "✓";
  if (type === "error") return "✕";
  if (type === "warning") return "⚠";
  return "ℹ";
}

export function showToast(message, type = "info") {
  ensureContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.textContent = iconForType(type);

  const msg = document.createElement("span");
  msg.className = "toast__msg";
  msg.textContent = message;

  const close = document.createElement("button");
  close.className = "toast__close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss");
  close.textContent = "×";

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(close);

  container.appendChild(toast);
  visibleCount++;

  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });

  const dismiss = () => {
    toast.classList.remove("toast--visible");
    toast.classList.add("toast--hiding");
    toast.addEventListener("transitionend", () => {
      toast.remove();
      visibleCount--;
    }, { once: true });
  };

  toast.querySelector(".toast__close").addEventListener("click", dismiss);
  setTimeout(dismiss, TOAST_DURATION);

  if (visibleCount > MAX_VISIBLE) {
    const oldest = container.querySelector(".toast--visible");
    if (oldest) oldest.querySelector(".toast__close").click();
  }
}

export function toastSuccess(msg) { showToast(msg, "success"); }
export function toastError(msg) { showToast(msg, "error"); }
export function toastWarning(msg) { showToast(msg, "warning"); }
export function toastInfo(msg) { showToast(msg, "info"); }
