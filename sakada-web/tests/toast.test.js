import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../js/notifications.js", () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  subscribeToNotifications: vi.fn(),
}));

let showToast, toastSuccess, toastError, toastWarning, toastInfo;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  const mod = await import("../js/toast.js");
  showToast = mod.showToast;
  toastSuccess = mod.toastSuccess;
  toastError = mod.toastError;
  toastWarning = mod.toastWarning;
  toastInfo = mod.toastInfo;
});

describe("showToast", () => {
  it("creates a toast container if none exists", () => {
    showToast("test");
    expect(document.querySelector(".toast-container")).toBeTruthy();
  });

  it("creates a toast with the message", () => {
    showToast("Hello world");
    const msg = document.querySelector(".toast__msg");
    expect(msg.textContent).toBe("Hello world");
  });

  it("applies the correct type class", () => {
    showToast("test", "error");
    expect(document.querySelector(".toast--error")).toBeTruthy();
  });

  it("defaults to info type", () => {
    showToast("test");
    expect(document.querySelector(".toast--info")).toBeTruthy();
  });

  it("sanitizes message (no HTML injection)", () => {
    showToast('<img src=x onerror=alert(1)>');
    const msg = document.querySelector(".toast__msg");
    expect(msg.innerHTML).not.toContain("<img");
    expect(msg.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it("displays the correct icon for each type", () => {
    showToast("s", "success");
    expect(document.querySelector(".toast__icon").textContent).toBe("✓");

    showToast("e", "error");
    const icons = document.querySelectorAll(".toast__icon");
    expect(icons[1].textContent).toBe("✕");

    showToast("w", "warning");
    const icons2 = document.querySelectorAll(".toast__icon");
    expect(icons2[2].textContent).toBe("⚠");

    showToast("i", "info");
    const icons3 = document.querySelectorAll(".toast__icon");
    expect(icons3[3].textContent).toBe("ℹ");
  });
});

describe("toast convenience functions", () => {
  it("toastSuccess creates a success toast", () => {
    toastSuccess("done");
    expect(document.querySelector(".toast--success")).toBeTruthy();
  });

  it("toastError creates an error toast", () => {
    toastError("fail");
    expect(document.querySelector(".toast--error")).toBeTruthy();
  });

  it("toastWarning creates a warning toast", () => {
    toastWarning("careful");
    expect(document.querySelector(".toast--warning")).toBeTruthy();
  });

  it("toastInfo creates an info toast", () => {
    toastInfo("fyi");
    expect(document.querySelector(".toast--info")).toBeTruthy();
  });
});

describe("toast close button", () => {
  it("removes toast on close click", async () => {
    showToast("dismiss me");
    const toast = document.querySelector(".toast");
    const closeBtn = document.querySelector(".toast__close");
    closeBtn.click();
    // jsdom doesn't fire CSS transitions — manually dispatch
    toast.dispatchEvent(new Event("transitionend"));
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector(".toast")).toBeFalsy();
  });
});
