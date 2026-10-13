// All reads/writes to the `deliveries` table go through here, so the
// query shape lives in one place instead of being copy-pasted across
// farmer, vendor, and driver dashboards.

import { supabase } from "./supabase-client.js";

export async function createDelivery(payload) {
  return await supabase.from("deliveries").insert(payload).select().single();
}

/** Every delivery a farmer/vendor has requested, most recent first. */
export async function getMyDeliveries(userId) {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
}

/** Pending deliveries with no driver yet — what a driver sees to accept. */
export async function getAvailableDeliveries() {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("status", "pending")
    .is("driver_id", null)
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

/** Deliveries a driver has accepted, most recent first. */
export async function getMyAssignedDeliveries(driverId) {
  return await supabase
    .from("deliveries")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
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
