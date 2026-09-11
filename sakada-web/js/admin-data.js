// Admin-only reads. Every query here returns data across ALL users, not
// just the caller's own — that only works because of the "admins can view
// all deliveries" / "admins can update any profile" RLS policies written
// back in 0005_rls_policies.sql. If an admin account somehow didn't have
// role = 'admin', every one of these would silently return nothing (or
// fail), not accidentally leak data — RLS fails closed.

import { supabase } from "./supabase-client.js";

export async function getAllProfiles() {
  return await supabase
    .from("profiles")
    .select("id, role, full_name, phone, created_at")
    .order("created_at", { ascending: false });
}

export async function getAllDeliveries() {
  return await supabase
    .from("deliveries")
    .select("*")
    .order("created_at", { ascending: false });
}

export async function getAllRatings() {
  return await supabase
    .from("ratings")
    .select("*")
    .order("created_at", { ascending: false });
}

/**
 * Admin override to cancel a delivery. Note this still goes through the
 * same validate_status_transition trigger as everyone else (Phase 6) —
 * it only succeeds from `pending` or `driver_assigned`, same as a
 * requester's own cancellation. An admin isn't exempt from the lifecycle
 * rules; "admin can manage all deliveries" (Phase 3 RLS) means admin can
 * *reach* any delivery regardless of whose it is, not that the delivery
 * lifecycle stops applying once they touch it.
 */
export async function adminCancelDelivery(deliveryId) {
  return await supabase
    .from("deliveries")
    .update({ status: "cancelled" })
    .eq("id", deliveryId)
    .select()
    .single();
}
