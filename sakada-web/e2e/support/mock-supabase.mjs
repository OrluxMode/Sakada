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
    goods_description: "Eggplant, 32 crates",
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
  // Mapbox: geocoding echoes the query as a Philippine place, directions
  // returns 118.4 km, and static map images are a 1x1 PNG.
  await page.route("https://api.mapbox.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/geocoding/")) {
      const query = decodeURIComponent(url.pathname.split("/").pop().replace(/\.json$/, ""));
      if (/nowhere/i.test(query)) return route.fulfill({ json: { features: [] } });
      return route.fulfill({ json: { features: [{ center: [121.0, 14.6], place_name: `${query}, Philippines` }] } });
    }
    if (url.pathname.startsWith("/directions/")) {
      return route.fulfill({ json: { routes: [{ distance: 118400 }] } });
    }
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });
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
        // the database defaults a new delivery gets
        ...(path === "deliveries"
          ? { delivery_code: `SK-${String(table.length + i + 1).padStart(5, "0")}`, status: "pending", driver_id: null, updated_at: NOW }
          : {}),
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
