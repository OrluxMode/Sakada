// All reads/writes to the `deliveries` table go through here, so the
// query shape lives in one place instead of being copy-pasted across
// farmer, vendor, and driver dashboards.

import { supabase } from "./supabase-client.js";
import { localDateString } from "./validators.js";

export async function createDelivery(payload) {
  return await supabase.from("deliveries").insert(payload).select().single();
}

/**
 * Requester cancels their own delivery. Only works while it is still
 * pending. The .eq() filters keep a stale screen from cancelling a
 * delivery a driver has just accepted, and RLS plus the 0016 guard
 * trigger enforce the same rule in the database.
 */
export async function cancelMyDelivery(deliveryId, requesterId) {
  return await supabase
    .from("deliveries")
    .update({ status: "cancelled" })
    .eq("id", deliveryId)
    .eq("requester_id", requesterId)
    .eq("status", "pending")
    .select()
    .single();
}

/** Every delivery a farmer/vendor has requested, most recent first. */
export async function getMyDeliveries(userId) {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
}

/**
 * Pending deliveries with no driver yet — what a driver sees to accept.
 * Requests whose pickup date has passed are left out (owner rule 2026-10-20;
 * the database enforces it too). Dates are saved as UTC midnight of the day.
 */
export async function getAvailableDeliveries(today = localDateString()) {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "pending")
    .is("driver_id", null)
    .or(`scheduled_pickup_at.is.null,scheduled_pickup_at.gte.${today}T00:00:00.000Z`)
    .order("created_at", { ascending: false });
}

/**
 * Accept a delivery. The .eq("status", "pending").is("driver_id", null)
 * conditions matter for more than correctness — they're what makes this
 * safe if two drivers tap "Accept" on the same delivery at nearly the same
 * moment. Whoever's update actually matches a still-pending, still-
 * unassigned row wins; the second request matches zero rows and fails
 * cleanly instead of silently overwriting the first driver's assignment.
 */
export async function acceptDelivery(deliveryId, driverId) {
  return await supabase
    .from("deliveries")
    .update({ driver_id: driverId, status: "driver_assigned" })
    .eq("id", deliveryId)
    .eq("status", "pending")
    .is("driver_id", null)
    .select()
    .single();
}

/**
 * Progress a delivery to its next status. Both .eq("driver_id", driverId)
 * and .eq("status", currentStatus) matter here for the same reason they
 * mattered in acceptDelivery: they make this safe against double-clicks
 * and stale UI — the update only succeeds if the delivery is still
 * exactly where this driver's screen thinks it is. The database trigger
 * (0007_valid_status_transitions.sql) is the deeper backstop that also
 * blocks this even for a request that skips the UI entirely.
 */
export async function updateDeliveryStatus(
  deliveryId,
  driverId,
  currentStatus,
  newStatus,
) {
  return await supabase
    .from("deliveries")
    .update({ status: newStatus })
    .eq("id", deliveryId)
    .eq("driver_id", driverId)
    .eq("status", currentStatus)
    .select()
    .single();
}

/**
 * The driver's Delivered step, with whether the receiver paid. The job
 * closes either way (owner rule, 2026-10-15); unpaid ones are flagged for
 * Sakada to follow up. The 0020 guard only lets payment_status be set
 * together with in_transit -> delivered.
 */
export async function markDelivered(deliveryId, driverId, paid) {
  return await supabase
    .from("deliveries")
    .update({ status: "delivered", payment_status: paid ? "paid" : "unpaid" })
    .eq("id", deliveryId)
    .eq("driver_id", driverId)
    .eq("status", "in_transit")
    .select()
    .single();
}

/** Deliveries a driver has accepted, most recent first. */
export async function getMyAssignedDeliveries(driverId) {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
}

/**
 * Driver name + vehicle for the caller's own deliveries (0019). Returns
 * { data: [{ delivery_id, driver_name, vehicle_type, vehicle_plate }], error }.
 */
export async function getMyDeliveryDrivers() {
  return await supabase.rpc("get_my_delivery_drivers");
}

/**
 * Push the driver's current position onto a delivery. No status-column
 * involvement, so the Phase 6 transition trigger doesn't even look at
 * this update — it only validates changes to `status`.
 */
export async function updateDeliveryLocation(deliveryId, driverId, lat, lng) {
  return await supabase
    .from("deliveries")
    .update({ current_lat: lat, current_lng: lng })
    .eq("id", deliveryId)
    .eq("driver_id", driverId);
}

/**
 * Live updates for a single delivery — used on the farmer/vendor side so
 * the tracking map moves without the person manually refreshing. Requires
 * Realtime to be turned on for the `deliveries` table in the Supabase
 * dashboard (Database → Replication) — see docs/SETUP.md.
 */
export function subscribeToDeliveryUpdates(deliveryId, onUpdate) {
  return supabase
    .channel(`delivery-${deliveryId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "deliveries",
        filter: `id=eq.${deliveryId}`,
      },
      (payload) => onUpdate(payload.new),
    )
    .subscribe();
}
