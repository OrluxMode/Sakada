// Worst-case data for the farmer/vendor dashboard (break-ui). Each dataset is
// a set of overrides for fixtures(), signed in as the farmer. Values are what
// real users type, or the longest the booking form accepts (js/validators.js):
// address 200, goods 120, notes 500, name 120, recipient 80, kg 100,000,
// vehicle 40, plate 15, saved-address label 40 (10 addresses at most).
import { IDS, delivery, fixtures } from "./mock-supabase.mjs";

const NOW = "2026-10-14T09:00:00.000Z";
const DRIVER_LONG = "00000000-0000-4000-8000-00000000d002";
const DRIVER_SHORT = "00000000-0000-4000-8000-00000000d003";

function profile(id, role, full_name) {
  return { id, role, full_name, phone: null, avatar_url: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: NOW };
}

function people(farmerName) {
  return [
    profile(IDS.farmer, "farmer", farmerName),
    profile(IDS.vendor, "vendor", "Ben Cruz"),
    profile(IDS.driver, "driver", "Carlo Santos"),
    profile(DRIVER_LONG, "driver", "Bartolome Fitzgerald Macapagal-Arroyo Jr."),
    profile(DRIVER_SHORT, "driver", "Jo"),
    profile(IDS.admin, "admin", "Dina Admin"),
  ];
}

const vehicles = [
  { id: IDS.driver, vehicle_type: "6-wheeler truck", vehicle_plate: "NBC 1234", is_available: true },
  // 40 and 15 characters: the most the driver profile form accepts.
  { id: DRIVER_LONG, vehicle_type: "Isuzu Forward 10-wheeler wing van, blue", vehicle_plate: "CONDUCTION 7Q89", is_available: true },
  { id: DRIVER_SHORT, vehicle_type: null, vehicle_plate: null, is_available: true },
];

const LONG_PICKUP =
  "Purok 7, Sitio Malipayon, Barangay San Isidro Labrador, Municipality of Santo Niño, South Cotabato, across the barangay hall beside the Petron station, Philippines 9509, Mindanao";
const LONG_DROPOFF =
  "Balintawak Market (Cloverleaf), EDSA corner A. Bonifacio Avenue, Barangay Balingasa, Quezon City, Metro Manila, Stall 214-B Vegetable Section";
const NO_SPACES = "Blk12Lot34PhaseIIIGreenmeadowsSubd.Brgy.Maliwalo,TarlacCity";

/** Every realistic failure at once, spread across the cards. */
export function worst() {
  const deliveries = [
    // Longest goods, max kg, longest addresses, biggest fare, late pickup, 6-digit code.
    delivery(1, "pending", {
      delivery_code: "SK-104857",
      goods_description: "Lakatan bananas, 120 bundles, mixed ripeness, please keep away from direct sun and do not stack more than 3 high",
      quantity_kg: 100000,
      pickup_address: LONG_PICKUP,
      dropoff_address: LONG_DROPOFF,
      estimated_cost: 230150,
      distance_km: 2000,
      scheduled_pickup_at: "2026-10-01T00:00:00.000Z",
      // 80 characters: the most the recipient field takes.
      recipient_name: "Ma. Teresita Concepcion Villanueva-Dela Cruz de los Santos y Macaraeg-Fernandez",
      pickup_window: "13-15",
    }),
    // Smallest booking: 1 kg, short goods, long driver name and longest vehicle.
    delivery(2, "driver_assigned", {
      driver_id: DRIVER_LONG,
      goods_description: "Mangoes",
      quantity_kg: 1,
      estimated_cost: 152,
      pickup_address: NO_SPACES,
    }),
    // On the road, location not shared, emoji in goods, driver with no vehicle.
    delivery(3, "in_transit", {
      driver_id: DRIVER_SHORT,
      goods_description: "Calamansi 🍋 50 sacks (Oriental Mindoro)",
      quantity_kg: 2500,
      current_lat: null,
      current_lng: null,
    }),
    // On the road with a map, five produce rows (the 120-character goods line) and the longest notes.
    delivery(7, "picked_up", {
      goods_description: "Sweet potatoes 1050 kg, Chinese cabbage 2500 kg, Saba bananas 850 kg, Bitter gourd 95 kg, Bell peppers 10000 kg",
      quantity_kg: 14495,
      notes: "Receiver is Aling Bebeng at stall 14. ".repeat(13).trim(),
    }),
    // To rate: driver called Jo.
    delivery(4, "delivered", { driver_id: DRIVER_SHORT, goods_description: "Eggplant, 32 crates" }),
    // Old rows from before kg and fare were required (columns are nullable).
    delivery(5, "cancelled", { driver_id: null, quantity_kg: null, estimated_cost: null, goods_description: "Sitaw" }),
    delivery(8, "delivered", { estimated_cost: 230150, quantity_kg: 100000, goods_description: "Repolyo (cabbage), 1,000 sacks" }),
  ];
  const notifications = Array.from({ length: 12 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000c${String(i + 1).padStart(4, "0")}`,
    user_id: IDS.farmer,
    delivery_id: deliveries[i % 4].id,
    message:
      i === 0
        ? `Bartolome Fitzgerald Macapagal-Arroyo Jr. accepted ${deliveries[1].delivery_code}: Mangoes from ${NO_SPACES}.`
        : `Your delivery ${deliveries[i % 4].delivery_code} is in transit.`,
    is_read: false,
    created_at: NOW,
  }));
  // Ten saved addresses (the most allowed), 40-character labels and 200-character addresses mixed in.
  const saved = [
    ["Bodega ni Lola Pacing sa may Barangay Hall", LONG_PICKUP.slice(0, 200)],
    ["My farm", "Brgy. Sapang, Jaen, Nueva Ecija"],
    ["Divisoria stall", "Divisoria Market, Tondo, Manila"],
    ["Balintawak Market (Cloverleaf) Stall 214B", LONG_DROPOFF],
    ["Jo", NO_SPACES],
    ["Warehouse", "EDSA, Balintawak, Quezon City"],
    ["Bagsakan sa Urdaneta", "Urdaneta City Public Market, Pangasinan"],
    ["La Trinidad trading post", "La Trinidad Vegetable Trading Post, Benguet"],
    ["Kamias", "Kamias Road, Quezon City"],
    ["Farm 2", "Purok 3, Brgy. Bantug, Science City of Muñoz, Nueva Ecija"],
  ].map(([label, address], i) => ({
    id: `00000000-0000-4000-8000-0000000a${String(i).padStart(4, "0")}`,
    user_id: IDS.farmer,
    label,
    address,
    lat: 15.4 + i / 100,
    lng: 120.9 + i / 100,
    city: null,
    created_at: NOW,
    updated_at: NOW,
  }));
  const ratings = [5, 4, 5, 3, 5].map((rating, i) => ({ id: `r${i}`, rated_user_id: DRIVER_LONG, rating }));
  return {
    profiles: people("Maria Concepcion Villanueva-Dela Cruz III"),
    driver_profiles: vehicles,
    deliveries,
    notifications,
    saved_addresses: saved,
    ratings,
  };
}

/** A brand-new account: nothing booked, no notifications. */
export function empty() {
  return { profiles: people("Jo"), deliveries: [], notifications: [] };
}

/** Exactly one of everything, so every count is 1. */
export function one() {
  const d = delivery(1, "pending");
  return {
    profiles: people("Ana Reyes"),
    deliveries: [d, delivery(4, "delivered", { driver_id: IDS.driver })],
    notifications: [{ id: "00000000-0000-4000-8000-0000000c0001", user_id: IDS.farmer, delivery_id: d.id, message: "Your delivery SK-00001 is waiting for a driver.", is_read: false, created_at: NOW }],
  };
}

/** A busy trader: 12 active bookings and 400 past ones (History isn't paginated). */
export function huge() {
  const statuses = ["pending", "driver_assigned", "in_transit", "picked_up"];
  const active = Array.from({ length: 12 }, (_, i) => delivery(100 + i, statuses[i % 4]));
  const past = Array.from({ length: 400 }, (_, i) =>
    delivery(200 + i, i % 5 === 0 ? "cancelled" : "delivered", { driver_id: i % 5 === 0 ? null : IDS.driver }),
  );
  return { profiles: people("Ana Reyes"), deliveries: [...active, ...past] };
}

export const DATASETS = { demo: () => ({}), worst, empty, one, huge };

/** Swap the live mock tables in place (the mock's route handlers read `db` on every request). */
export function useDataset(db, name) {
  Object.assign(db, fixtures((DATASETS[name] || DATASETS.demo)()));
}
