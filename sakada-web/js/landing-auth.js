// Landing page: if the visitor is already signed in, point the nav and the
// hero button at their own dashboard instead of sign-up.
//
// This deliberately does NOT load the Supabase SDK on page load (it's heavy
// and the landing page is tuned for speed). It reads two things from
// localStorage instead:
//   - "sakada.role", saved by requireRole() in auth.js when a dashboard loads
//   - the session key supabase-js keeps ("sb-<project>-auth-token")
// It's a display hint only. The dashboards still verify the real role.

const ROLE_KEY = "sakada.role";
const SESSION_KEY = /^sb-.+-auth-token$/;

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
export function getLandingState(storage) {
  const role = storage.getItem(ROLE_KEY);
  if (!Object.hasOwn(ROLE_HOME, role)) return null;
  if (!hasSession(storage)) {
    storage.removeItem(ROLE_KEY);
    return null;
  }
  return { role, dashboard: `dashboard/${role}/index.html`, ...ROLE_HOME[role] };
}

/** Swaps the guest elements for the signed-in ones. */
export function applyLandingState(doc, state) {
  if (!state) return;
  doc.querySelectorAll('[data-auth="guest"]').forEach((el) => (el.hidden = true));
  doc.querySelectorAll('[data-auth="member"]').forEach((el) => (el.hidden = false));

  const dash = doc.querySelector("[data-dashboard-link]");
  if (dash) dash.href = state.dashboard;

  const book = doc.querySelector("[data-book-link]");
  if (book) book.href = state.book;
  const bookLabel = doc.querySelector("[data-book-label]");
  if (bookLabel) bookLabel.textContent = state.cta;

  const roleLabel = doc.querySelector("[data-role-label]");
  if (roleLabel) roleLabel.textContent = state.label;
}

async function handleSignOut(btn) {
  const buttons = document.querySelectorAll("[data-signout]");
  buttons.forEach((b) => (b.disabled = true));
  try {
    localStorage.removeItem(ROLE_KEY);
    const { signOut } = await import("./auth.js");
    await signOut("index.html");
  } catch {
    buttons.forEach((b) => (b.disabled = false));
    btn.textContent = "Log Out failed, try again";
  }
}

if (typeof document !== "undefined" && document.querySelector("[data-auth]")) {
  applyLandingState(document, getLandingState(localStorage));
  document.querySelectorAll("[data-signout]").forEach((btn) =>
    btn.addEventListener("click", () => handleSignOut(btn)),
  );
}
