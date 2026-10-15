# OpenCode task: dashboard e2e tests with a fake Supabase (Phase 0)

First step of the dashboard redesign. No e2e test can open a dashboard today, because `requireRole` needs a real Supabase session. This adds a fake Supabase for Playwright:
- a signed-in user per role
- in-memory tables with deliveries in every status
- writes (Cancel, Accept) change those tables
- realtime and map images are silenced

Plus 6 dashboard tests. CI then covers the dashboards before we change them.

**No app code changes.** Two new test files only. Claude ran them on a copy of the site: lint clean, **e2e 53/53** (was 47), and the new file passed 3 runs in a row. **Copy both files exactly.** Don't commit.

## 1. New file `sakada-web/e2e/support/mock-supabase.mjs`
```js
// A fake Supabase for e2e tests, so the dashboards can load without a real
// account. It signs a fixture user in (the session supabase-js reads from
// localStorage) and answers auth, PostgREST and RPC calls from in-memory
// tables. Writes (PATCH/POST) change those tables, so a test can click
// Cancel or Accept and see the result. Realtime is silenced.
//
// Supports only the PostgREST bits the app uses: eq., neq., is.null and
// in.(...) filters, plus .single() / .maybeSingle().

const PROJECT_REF = "aeeniueayubeugvooyqj"; // must match js/config.js
const NOW = "2026-10-14T09:00:00.000Z";

export const IDS = {
  farmer: "00000000-0000-4000-8000-00000000f001",
  vendor: "00000000-0000-4000-8000-00000000f002",
  driver: "00000000-0000-4000-8000-00000000d001",
  admin: "00000000-0000-4000-8000-00000000a001",
};

const NAMES = {
  farmer: "Ana Reyes",
  vendor: "Ben Cruz",
  driver: "Carlo Santos",
  admin: "Dina Admin",
};

function delivery(n, status, extra = {}) {
  return {
    id: `00000000-0000-4000-8000-0000000de${String(n).padStart(3, "0")}`,
    delivery_code: `SK-${String(n).padStart(5, "0")}`,
    requester_id: IDS.farmer,
    driver_id: status === "pending" ? null : IDS.driver,
    pickup_address: "Cabanatuan City, Nueva Ecija",
    pickup_lat: 15.4865,
    pickup_lng: 120.9667,
    dropoff_address: "Marikina Public Market, Marikina",
    dropoff_lat: 14.6507,
    dropoff_lng: 121.1029,
    goods_description: "Rice, 16 sacks",
    quantity_kg: 800,
    scheduled_pickup_at: "2026-10-15T00:00:00.000Z",
    notes: null,
    estimated_cost: 3550,
    distance_km: 120,
    status,
    current_lat: status === "in_transit" || status === "picked_up" ? 15.1 : null,
    current_lng: status === "in_transit" || status === "picked_up" ? 121.0 : null,
    created_at: `2026-10-${String(10 + (n % 5)).padStart(2, "0")}T0${n % 9}:00:00.000Z`,
    updated_at: NOW,
    ...extra,
  };
}

/** Fresh tables for one test. Pass overrides to change any table. */
export function fixtures(overrides = {}) {
  const profiles = Object.entries(IDS).map(([role, id]) => ({
    id,
    role,
    full_name: NAMES[role],
    phone: null,
    avatar_url: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: NOW,
  }));
  const deliveries = [
    delivery(1, "pending"),
    delivery(2, "driver_assigned"),
    delivery(3, "in_transit"),
    delivery(4, "delivered"),
    delivery(5, "cancelled", { driver_id: null }),
    delivery(6, "pending", { requester_id: IDS.vendor, goods_description: "Tomatoes, 40 crates", quantity_kg: 600, estimated_cost: 2550 }),
  ];
  return {
    profiles,
    deliveries,
    driver_profiles: [{ id: IDS.driver, vehicle_type: "6-wheeler truck", vehicle_plate: "NBC 1234", is_available: true }],
    notifications: [
      {
        id: "00000000-0000-4000-8000-0000000c0001",
        user_id: IDS.farmer,
        delivery_id: deliveries[2].id,
        message: "Your delivery SK-00003 is now In Transit.",
        is_read: false,
        created_at: NOW,
      },
    ],
    ratings: [],
    contact_submissions: [],
    ...overrides,
  };
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "columns", "on_conflict"].includes(key)) continue;
    const value = row[key];
    if (raw.startsWith("eq.")) {
      if (String(value) !== raw.slice(3)) return false;
    } else if (raw.startsWith("neq.")) {
      if (String(value) === raw.slice(4)) return false;
    } else if (raw === "is.null") {
      if (value !== null && value !== undefined) return false;
    } else if (raw.startsWith("in.(")) {
      const list = raw.slice(4, -1).split(",").map((s) => s.replace(/^"|"$/g, ""));
      if (!list.includes(String(value))) return false;
    }
  }
  return true;
}

function rpcResult(name, db, userId) {
  if (name === "get_my_delivery_drivers") {
    return db.deliveries
      .filter((d) => d.requester_id === userId && d.driver_id)
      .map((d) => ({
        delivery_id: d.id,
        driver_name: NAMES.driver,
        vehicle_type: db.driver_profiles[0]?.vehicle_type ?? null,
        vehicle_plate: db.driver_profiles[0]?.vehicle_plate ?? null,
      }));
  }
  return null; // update_my_last_login and anything else: no content
}

/**
 * Sign `role` in and fake Supabase for this page. Returns the live tables
 * (`db`) so a test can inspect them after a write.
 */
export async function mockSupabase(page, role, overrides = {}) {
  const db = fixtures(overrides);
  const userId = IDS[role];
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: `${role}@example.com`,
    app_metadata: { provider: "email" },
    user_metadata: { full_name: NAMES[role], role },
    identities: [],
    created_at: "2026-09-01T00:00:00.000Z",
  };
  const session = {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
  await page.addInitScript(
    ([key, value, r]) => {
      localStorage.setItem(key, value);
      localStorage.setItem("sakada.role", r);
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session), role],
  );

  await page.routeWebSocket(/\/realtime\/v1\//, () => {}); // never connects, never errors
  await page.route("https://api.mapbox.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    }),
  );
  await page.route(`https://${PROJECT_REF}.supabase.co/auth/v1/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user")) return route.fulfill({ json: user });
    if (url.pathname.endsWith("/logout")) return route.fulfill({ status: 204, body: "" });
    return route.fulfill({ json: session });
  });
  await page.route(`https://${PROJECT_REF}.supabase.co/rest/v1/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/rest\/v1\//, "");
    const params = [...url.searchParams.entries()];
    const wantsOne = (req.headers()["accept"] || "").includes("vnd.pgrst.object");

    if (path.startsWith("rpc/")) {
      const result = rpcResult(path.slice(4), db, userId);
      return result === null ? route.fulfill({ status: 204, body: "" }) : route.fulfill({ json: result });
    }

    const table = db[path];
    if (!table) return route.fulfill({ status: 404, json: { message: `no table ${path}` } });

    let rows;
    if (req.method() === "GET" || req.method() === "HEAD") {
      rows = table.filter((r) => matches(r, params));
    } else if (req.method() === "PATCH") {
      const patch = req.postDataJSON();
      rows = table.filter((r) => matches(r, params));
      rows.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
    } else if (req.method() === "POST") {
      const body = req.postDataJSON();
      rows = (Array.isArray(body) ? body : [body]).map((r, i) => ({
        id: `00000000-0000-4000-8000-0000000e${String(table.length + i).padStart(4, "0")}`,
        created_at: new Date().toISOString(),
        ...r,
      }));
      table.push(...rows);
    } else {
      rows = [];
    }

    const headers = { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
    if (wantsOne) {
      if (rows.length !== 1) {
        return route.fulfill({ status: 406, headers, json: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } });
      }
      return route.fulfill({ headers, json: rows[0] });
    }
    return route.fulfill({ headers, json: rows });
  });

  return db;
}
```

## 2. New file `sakada-web/e2e/dashboards.spec.mjs`
```js
// Dashboards load with a fake signed-in user (e2e/support/mock-supabase.mjs).
// These are the safety net for the dashboard redesign: each page loads with
// no errors and shows its real data.
import { test, expect } from "@playwright/test";
import { mockSupabase } from "./support/mock-supabase.mjs";

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

test.describe("dashboards (fake sign-in)", () => {
  test("farmer sees their active and past deliveries", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    await expect(page.locator("#userName")).toHaveText("Ana Reyes");
    await expect(page.locator("#activeDeliveryList")).toContainText("SK-00001");
    await expect(page.locator("#activeDeliveryList")).toContainText("SK-00003");
    await expect(page.locator("#historyDeliveryList")).toContainText("SK-00004");
    await expect(page.locator("#activeDeliveryList")).not.toContainText("SK-00006"); // the vendor's
    expect(errors).toEqual([]);
  });

  test("farmer can cancel a pending delivery", async ({ page }) => {
    const db = await mockSupabase(page, "farmer");
    await page.goto("/dashboard/farmer/index.html");
    const card = page.locator("#activeDeliveryList .delivery-card", { hasText: "SK-00001" });
    page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: /cancel/i }).click();
    await expect.poll(() => db.deliveries.find((d) => d.delivery_code === "SK-00001").status).toBe("cancelled");
  });

  test("vendor sees only their own deliveries", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "vendor");
    await page.goto("/dashboard/vendor/index.html");
    await expect(page.locator("#userName")).toHaveText("Ben Cruz");
    await expect(page.locator("#activeDeliveryList")).toContainText("SK-00006");
    await expect(page.locator("#activeDeliveryList")).not.toContainText("SK-00001");
    expect(errors).toEqual([]);
  });

  test("driver sees available jobs, their own jobs and their vehicle", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "driver");
    await page.goto("/dashboard/driver/index.html");
    await expect(page.locator("#userName")).toHaveText("Carlo Santos");
    await expect(page.getByText("SK-00001")).toBeVisible(); // available (pending, no driver)
    await expect(page.getByText("SK-00003")).toBeVisible(); // assigned to them, in transit
    await expect(page.locator("#vehicleType")).toHaveValue("6-wheeler truck");
    expect(errors).toEqual([]);
  });

  test("admin sees the stats and the deliveries table", async ({ page }) => {
    const errors = trackErrors(page);
    await mockSupabase(page, "admin");
    await page.goto("/dashboard/admin/index.html");
    await expect(page.locator("#userName")).toHaveText("Dina Admin");
    await expect(page.getByRole("cell", { name: "SK-00001" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a farmer opening the driver dashboard is sent home", async ({ page }) => {
    await mockSupabase(page, "farmer");
    await page.goto("/dashboard/driver/index.html");
    await expect(page).toHaveURL(/\/index(\.html)?$|\/$/);
  });
});
```

## 3. Checks (from `sakada-web/`)
- `npm run lint` → no errors
- `npm test` → 118 passed (unchanged)
- `npm run test:e2e` → **53 passed** (was 47, plus 6 new)
- `git status` should show only the two new files.

Don't commit. Claude will review.
