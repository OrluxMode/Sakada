# OpenCode task: show the driver to the farmer/vendor, add "Book again", add a vehicle form for drivers

The new For Farmers page promises two things that don't exist yet:
1. "When a driver accepts, you see their name and vehicle."
2. "Book the same run again" from your delivery history.

Build both. There's a catch: **drivers currently have no way to enter their vehicle.** `driver_profiles.vehicle_type` and `vehicle_plate` exist but nothing writes them, so this also adds a small vehicle form to the driver dashboard.

Since the security work, a requester **cannot** read the driver's `profiles` or `driver_profiles` row (RLS: own row + admin only), and that must stay. The driver's name and vehicle are exposed to the requester of **their own** deliveries only, through one `SECURITY DEFINER` function that returns 3 harmless fields. No phone, licence number or location.

## Files you may touch
- `sakada-backend/supabase/migrations/0019_requester_sees_driver.sql` (new; **write it only, don't run it**)
- `sakada-backend/supabase/migrations/Readme.md` (add the 0019 line, if that file lists migrations)
- `sakada-web/js/deliveries.js`
- `sakada-web/js/driver-profile.js` (new)
- `sakada-web/js/dashboard-shared.js` (add 2 helpers)
- `sakada-web/js/requester-dashboard.js`
- `sakada-web/js/driver-dashboard.js`
- `sakada-web/dashboard/driver/index.html`
- `sakada-web/css/dashboard.css`
- `sakada-web/tests/dashboard-shared.test.js`

Nothing else. Don't commit. CI runs ESLint, so `npm run lint` must pass.

---

## 1. Migration `0019_requester_sees_driver.sql` (exactly this)
```sql
-- 0019: let a farmer/vendor see who is driving THEIR delivery.
--
-- profiles and driver_profiles stay private (0016: own row + admin only).
-- This function is the one narrow exception: for deliveries the caller
-- requested, it returns the assigned driver's name, vehicle type and plate.
-- Nothing else (no phone, licence number or live location).

create or replace function get_my_delivery_drivers()
returns table (
  delivery_id uuid,
  driver_name text,
  vehicle_type text,
  vehicle_plate text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, p.full_name, dp.vehicle_type, dp.vehicle_plate
  from deliveries d
  join profiles p on p.id = d.driver_id
  left join driver_profiles dp on dp.id = d.driver_id
  where d.requester_id = auth.uid()
    and d.driver_id is not null;
$$;

revoke all on function get_my_delivery_drivers() from public, anon;
grant execute on function get_my_delivery_drivers() to authenticated;

-- Drivers can already edit their own driver_profiles row (0005). Keep the
-- new vehicle fields short so they can't be abused for long text.
alter table driver_profiles
  drop constraint if exists driver_profiles_vehicle_type_len,
  drop constraint if exists driver_profiles_vehicle_plate_len;
alter table driver_profiles
  add constraint driver_profiles_vehicle_type_len
    check (vehicle_type is null or char_length(vehicle_type) <= 40),
  add constraint driver_profiles_vehicle_plate_len
    check (vehicle_plate is null or char_length(vehicle_plate) <= 15);
```

## 2. `js/deliveries.js`
Add:
```js
/**
 * Driver name + vehicle for the caller's own deliveries (0019). Returns
 * { data: [{ delivery_id, driver_name, vehicle_type, vehicle_plate }], error }.
 */
export async function getMyDeliveryDrivers() {
  return await supabase.rpc("get_my_delivery_drivers");
}
```

## 3. `js/driver-profile.js` (new, exactly this)
```js
// The signed-in driver's own vehicle details. RLS (0005) lets a driver read
// and update only their own driver_profiles row.
import { supabase } from "./supabase-client.js";

export async function getMyVehicle(driverId) {
  return await supabase
    .from("driver_profiles")
    .select("vehicle_type, vehicle_plate")
    .eq("id", driverId)
    .maybeSingle();
}

export async function saveMyVehicle(driverId, vehicleType, vehiclePlate) {
  return await supabase
    .from("driver_profiles")
    .update({
      vehicle_type: vehicleType.trim().slice(0, 40) || null,
      vehicle_plate: vehiclePlate.trim().toUpperCase().slice(0, 15) || null,
    })
    .eq("id", driverId);
}
```

## 4. `js/dashboard-shared.js`: two pure helpers (exported)
```js
/**
 * "Driver: Juan Dela Cruz · Isuzu Elf · NBC 1234" for a requester's delivery
 * card. `row` comes from getMyDeliveryDrivers(); returns "" when no driver
 * is assigned yet. Everything is sanitized.
 */
export function renderDriverLine(row) {
  if (!row || !row.driver_name) return "";
  const parts = [sanitizeText(row.vehicle_type), sanitizeText(row.vehicle_plate)].filter(Boolean);
  const vehicle = parts.length ? ` · ${parts.join(" · ")}` : " · Vehicle not added yet";
  return `<div class="delivery-driver">Driver: <strong>${sanitizeText(row.driver_name)}</strong>${vehicle}</div>`;
}

/** Form values for "Book again": same route, goods and weight; new date. */
export function rebookValues(d) {
  return {
    pickupAddress: d.pickup_address || "",
    dropoffAddress: d.dropoff_address || "",
    goodsDescription: d.goods_description || "",
    quantityKg: d.quantity_kg != null ? String(d.quantity_kg) : "",
  };
}
```

## 5. `js/requester-dashboard.js`
- Import `getMyDeliveryDrivers` from `./deliveries.js`, and `renderDriverLine` and `rebookValues` from `./dashboard-shared.js`.
- In `loadDeliveries`, after `getMyDeliveries` succeeds, call `getMyDeliveryDrivers()` and build `const driversById = new Map((drivers || []).map((r) => [r.delivery_id, r]));`. **If the call errors, use an empty Map and carry on.** The lists must still render, for example before 0019 has been run.
- In **both** the active and history card templates, add `${renderDriverLine(driversById.get(d.id))}` right after the `delivery-meta` line.
- In the **history** card template, after the rating block, add:
  ```js
  <div class="delivery-card-actions">
    <button type="button" class="btn-small" data-rebook-id="${sanitizeText(d.id)}">Book again</button>
  </div>
  ```
- After `wireRatingControls(...)`, wire the buttons:
  ```js
  const historyById = new Map(history.map((d) => [d.id, d]));
  historyEl.querySelectorAll("[data-rebook-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = historyById.get(btn.dataset.rebookId);
      if (!d) return;
      const values = rebookValues(d);
      for (const [id, value] of Object.entries(values)) {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const date = document.getElementById("scheduledPickup");
      date.value = "";
      pendingQuote = null;
      costPreview.classList.remove("visible");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      date.focus({ preventScroll: true });
      toastInfo("Details copied. Pick a pickup date, then get a new estimate.");
    });
  });
  ```
  (`form`, `costPreview`, `pendingQuote` and `toastInfo` already exist in this file.)

## 6. Driver dashboard: "Your vehicle" form
**`dashboard/driver/index.html`:** add this section right **before** the "Available Deliveries" `dash-section`, after `<div id="formMessage" …>`:
```html
<div class="dash-section vehicle-section">
  <h2>Your vehicle</h2>
  <p class="dash-hint">
    Farmers and vendors see this once you accept their delivery, so they know
    which truck to look for.
  </p>
  <form id="vehicleForm" class="vehicle-form">
    <div class="field">
      <label for="vehicleType">Vehicle type</label>
      <input id="vehicleType" type="text" maxlength="40" placeholder="e.g. Isuzu Elf, 6-wheeler" autocomplete="off" />
    </div>
    <div class="field">
      <label for="vehiclePlate">Plate number</label>
      <input id="vehiclePlate" type="text" maxlength="15" placeholder="e.g. NBC 1234" autocomplete="off" />
    </div>
    <button class="btn-primary" type="submit" id="vehicleSaveBtn">Save vehicle</button>
  </form>
</div>
```

**`js/driver-dashboard.js`:**
- `import { getMyVehicle, saveMyVehicle } from "./driver-profile.js";`
- After the profile/greeting setup, load the current values: `const { data: vehicle } = await getMyVehicle(profile.id);`. If it returns data, fill `#vehicleType` and `#vehiclePlate`. Ignore errors.
- On `#vehicleForm` submit: `preventDefault`; if `getIsOffline()`, toast an error and stop. Disable the button and set its text to "Saving…", then call `saveMyVehicle(profile.id, typeValue, plateValue)`.
  - On error: `toastError("Couldn't save your vehicle: " + error.message)`.
  - On success: `toastSuccess("Vehicle saved")`, and show the plate uppercased in the input.
  - Re-enable the button and restore "Save vehicle" either way.

## 7. `css/dashboard.css`: add at the end
```css
/* Driver line on a requester's delivery card */
.delivery-driver {
  margin-top: 6px;
  font-size: 14px;
  color: var(--text-muted);
}
.delivery-driver strong {
  color: var(--text-cream);
  font-weight: 600;
}

/* Driver dashboard: vehicle form */
.vehicle-section .dash-hint {
  margin: 0 0 20px;
  max-width: 60ch;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-muted);
}
.vehicle-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  gap: 16px;
  align-items: end;
  max-width: 760px;
}
.vehicle-form .field {
  margin-bottom: 0;
}
@media (max-width: 600px) {
  .vehicle-form {
    grid-template-columns: 1fr;
  }
  .vehicle-form .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
```
Use the existing `.btn-small` style for "Book again". Don't create a new button style.

## 8. Tests: add to `tests/dashboard-shared.test.js`
Import `renderDriverLine` and `rebookValues`:
1. `renderDriverLine(undefined)` and `renderDriverLine({ driver_name: null })` both return `""`.
2. Full row (`"Juan Dela Cruz"`, `"Isuzu Elf"`, `"NBC 1234"`): the output contains `Juan Dela Cruz`, `Isuzu Elf · NBC 1234` and `class="delivery-driver"`.
3. No vehicle: contains `Vehicle not added yet`.
4. Sanitizing: `driver_name: '<img src=x onerror=alert(1)>Ana'` must not produce an `<img` tag in the output.
5. `rebookValues({ pickup_address: "A", dropoff_address: "B", goods_description: "Rice", quantity_kg: 500 })` returns `{ pickupAddress: "A", dropoffAddress: "B", goodsDescription: "Rice", quantityKg: "500" }`. Missing fields become `""`.

## Checks before you finish
1. `cd sakada-web && npm run lint && npx vitest run` pass (66 + the new tests).
2. `npm run test:e2e` still passes. It doesn't touch the dashboards, but run it anyway.
3. `node --check` each changed JS file through a `.mjs` copy.
4. In your summary, remind the user: **run `0019_requester_sees_driver.sql` in the Supabase SQL editor before pushing.** Until then the driver line simply doesn't show; nothing breaks.
