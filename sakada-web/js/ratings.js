// All reads/writes to the `ratings` table.

import { supabase } from "./supabase-client.js";

/**
 * Ratings this user has already given, across a set of delivery ids —
 * fetched in one batched call rather than one query per delivery card.
 * Returns a Map keyed by delivery_id for easy lookup while rendering.
 */
export async function getMyRatingsForDeliveries(deliveryIds, ratedBy) {
  if (deliveryIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("ratings")
    .select("*")
    .in("delivery_id", deliveryIds)
    .eq("rated_by", ratedBy);

  if (error) return new Map();
  return new Map(data.map((r) => [r.delivery_id, r]));
}

/**
 * Submit a rating. The unique (delivery_id, rated_by) constraint plus the
 * RLS policy (only after status = 'delivered', only an involved party)
 * are what actually enforce "one rating per delivery per side" — this
 * function just attempts the insert and lets the database reject an
 * invalid or duplicate attempt.
 */
export async function submitRating(
  deliveryId,
  ratedBy,
  ratedUserId,
  rating,
  comment,
) {
  return await supabase
    .from("ratings")
    .insert({
      delivery_id: deliveryId,
      rated_by: ratedBy,
      rated_user_id: ratedUserId,
      rating,
      comment: comment || null,
    })
    .select()
    .single();
}
