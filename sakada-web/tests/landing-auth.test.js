import { describe, it, expect } from "vitest";
import { getLandingState, applyLandingState, ROLE_HOME } from "../js/landing-auth.js";

/** Minimal Storage-like object backed by a Map (same shape the module uses). */
function makeStorage(entries = []) {
  const map = new Map(entries);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

const SESSION = ["sb-abc-auth-token", '{"access_token":"x"}'];

describe("getLandingState", () => {
  it("returns null with no sakada.role", () => {
    expect(getLandingState(makeStorage())).toBeNull();
  });

  it("returns null and clears sakada.role when the session key is missing", () => {
    const storage = makeStorage([["sakada.role", "farmer"]]);
    expect(getLandingState(storage)).toBeNull();
    expect(storage.getItem("sakada.role")).toBeNull();
  });

  it("returns the farmer home when role + session are present", () => {
    const storage = makeStorage([["sakada.role", "farmer"], SESSION]);
    const state = getLandingState(storage);
    expect(state).toMatchObject({
      role: "farmer",
      book: "dashboard/farmer/index.html#deliveryForm",
      cta: "Book a Delivery",
      dashboard: "dashboard/farmer/index.html",
      label: "a farmer",
    });
  });

  it("returns the driver home with the Find Deliveries CTA", () => {
    const storage = makeStorage([["sakada.role", "driver"], SESSION]);
    const state = getLandingState(storage);
    expect(state.cta).toBe("Find Deliveries");
    expect(state.book).toBe("dashboard/driver/index.html");
  });

  it("returns null for an unknown role even with a session", () => {
    const storage = makeStorage([["sakada.role", "superuser"], SESSION]);
    expect(getLandingState(storage)).toBeNull();
  });
});

describe("applyLandingState", () => {
  const fixture = `
    <p data-auth="guest">Guest</p>
    <p data-auth="member" hidden>Member</p>
    <a data-book-link href="auth/register.html"><span data-book-label>Book a Delivery</span></a>
    <a data-dashboard-link href="auth/login.html">My Dashboard</a>
    <span data-role-label>a farmer</span>
  `;

  it("swaps guest elements for the vendor signed-in state", () => {
    document.body.innerHTML = fixture;
    const storage = makeStorage([["sakada.role", "vendor"], SESSION]);
    applyLandingState(document, getLandingState(storage));

    const guest = document.querySelector('[data-auth="guest"]');
    const member = document.querySelector('[data-auth="member"]');
    expect(guest.hidden).toBe(true);
    expect(member.hidden).toBe(false);

    expect(document.querySelector("[data-book-link]").getAttribute("href")).toBe(
      ROLE_HOME.vendor.book,
    );
    expect(document.querySelector("[data-book-label]").textContent).toBe(
      ROLE_HOME.vendor.cta,
    );
    expect(
      document.querySelector("[data-dashboard-link]").getAttribute("href"),
    ).toBe("dashboard/vendor/index.html");
    expect(document.querySelector("[data-role-label]").textContent).toBe(
      "a vendor",
    );
    document.body.innerHTML = "";
  });

  it("changes nothing when state is null", () => {
    document.body.innerHTML = fixture;
    const before = document.body.innerHTML;
    applyLandingState(document, null);
    expect(document.body.innerHTML).toBe(before);
    document.body.innerHTML = "";
  });
});
