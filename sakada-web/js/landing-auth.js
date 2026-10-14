// Every public page (landing, pages/*, 404): if the visitor is already
// signed in, point the nav and the hero button at their own dashboard
// instead of sign-up.
//
// This deliberately does NOT load the Supabase SDK on page load (it's heavy
// and the landing page is tuned for speed). It reads two things from
// localStorage instead:
//   - "sakada.role", saved by requireRole() in auth.js when a dashboard loads
//   - the session key supabase-js keeps ("sb-<project>-auth-token")
// It's a display hint only. The dashboards still verify the real role.

const ROLE_KEY = "sakada.role";
const SESSION_KEY = /^sb-.+-auth-token$/;

// Site root, worked out from this file's URL (js/landing-auth.js → /), so
// links work from index.html, pages/*.html and 404.html alike.
const ROOT = typeof document !== "undefined" ? new URL("../", import.meta.url).href : "";

export const ROLE_HOME = {
  farmer: { book: "dashboard/farmer/index.html#deliveryForm", cta: "Book a Delivery", label: "a farmer" },
  vendor: { book: "dashboard/vendor/index.html#deliveryForm", cta: "Book a Delivery", label: "a vendor" },
  driver: { book: "dashboard/driver/index.html", cta: "Find Deliveries", label: "a driver" },
  admin: { book: "dashboard/admin/index.html", cta: "Open Admin", label: "an admin" },
};

function hasSession(storage) {
  for (let i = 0; i < storage.length; i++) {
    if (SESSION_KEY.test(storage.key(i) || "")) return true;
  }
  return false;
}

/** Returns what the landing page should show, or null for a guest. */
export function getLandingState(storage, root = "") {
  const role = storage.getItem(ROLE_KEY);
  if (!Object.hasOwn(ROLE_HOME, role)) return null;
  if (!hasSession(storage)) {
    storage.removeItem(ROLE_KEY);
    return null;
  }
  const home = ROLE_HOME[role];
  return {
    role,
    dashboard: `${root}dashboard/${role}/index.html`,
    book: `${root}${home.book}`,
    cta: home.cta,
    label: home.label,
  };
}

/** Swaps the guest elements for the signed-in ones. */
export function applyLandingState(doc, state) {
  if (!state) return;
  doc.querySelectorAll('[data-auth="guest"]').forEach((el) => (el.hidden = true));
  doc.querySelectorAll('[data-auth="member"]').forEach((el) => (el.hidden = false));

  doc.querySelectorAll("[data-dashboard-link]").forEach((el) => (el.href = state.dashboard));

  const book = doc.querySelector("[data-book-link]");
  if (book) book.href = state.book;
  const bookLabel = doc.querySelector("[data-book-label]");
  if (bookLabel) bookLabel.textContent = state.cta;

  const roleLabel = doc.querySelector("[data-role-label]");
  if (roleLabel) roleLabel.textContent = state.label;

  // Page call-to-action buttons (How It Works). "book" buttons are for
  // farmers/vendors; "drive" buttons are for drivers. Anyone else gets
  // the button hidden rather than a link back to sign-up.
  const isSender = state.role === "farmer" || state.role === "vendor";
  doc.querySelectorAll('[data-auth-cta="book"]').forEach((el) => {
    if (isSender) el.href = state.book;
    else el.hidden = true;
  });
  doc.querySelectorAll('[data-auth-cta="drive"]').forEach((el) => {
    if (state.role === "driver") {
      el.href = state.dashboard;
      el.textContent = "Find Deliveries";
    } else {
      el.hidden = true;
    }
  });
}

async function handleSignOut(btn) {
  const buttons = document.querySelectorAll("[data-signout]");
  buttons.forEach((b) => (b.disabled = true));
  try {
    localStorage.removeItem(ROLE_KEY);
    const { signOut } = await import("./auth.js");
    await signOut(`${ROOT}index.html`);
  } catch {
    buttons.forEach((b) => (b.disabled = false));
    btn.textContent = "Log Out failed, try again";
  }
}

if (typeof document !== "undefined" && document.querySelector("[data-auth]")) {
  applyLandingState(document, getLandingState(localStorage, ROOT));
  document.querySelectorAll("[data-signout]").forEach((btn) =>
    btn.addEventListener("click", () => handleSignOut(btn)),
  );
}
