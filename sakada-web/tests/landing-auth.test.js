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

describe("getLandingState with a root prefix", () => {
  it("prefixes dashboard and book links with the root", () => {
    const storage = makeStorage([["sakada.role", "farmer"], SESSION]);
    const state = getLandingState(storage, "https://x.test/");
    expect(state.dashboard).toBe("https://x.test/dashboard/farmer/index.html");
    expect(state.book).toBe(
      "https://x.test/dashboard/farmer/index.html#deliveryForm",
    );
  });
});

describe("applyLandingState with page CTA buttons", () => {
  const ctaFixture = `
    <a data-auth-cta="book" href="auth/register.html">Book a Delivery</a>
    <a data-auth-cta="drive" href="auth/register.html?role=driver">Sign up to drive</a>
  `;

  it("farmer: rewires the book button and hides the drive button", () => {
    document.body.innerHTML = ctaFixture;
    const storage = makeStorage([["sakada.role", "farmer"], SESSION]);
    applyLandingState(document, getLandingState(storage));

    const book = document.querySelector('[data-auth-cta="book"]');
    const drive = document.querySelector('[data-auth-cta="drive"]');
    expect(book.getAttribute("href")).toBe(
      "dashboard/farmer/index.html#deliveryForm",
    );
    expect(book.hidden).toBe(false);
    expect(drive.hidden).toBe(true);
    document.body.innerHTML = "";
  });

  it("driver: hides the book button and turns drive into Find Deliveries", () => {
    document.body.innerHTML = ctaFixture;
    const storage = makeStorage([["sakada.role", "driver"], SESSION]);
    applyLandingState(document, getLandingState(storage));

    const book = document.querySelector('[data-auth-cta="book"]');
    const drive = document.querySelector('[data-auth-cta="drive"]');
    expect(book.hidden).toBe(true);
    expect(drive.hidden).toBe(false);
    expect(drive.textContent).toBe("Find Deliveries");
    expect(drive.getAttribute("href")).toBe("dashboard/driver/index.html");
    document.body.innerHTML = "";
  });
});
