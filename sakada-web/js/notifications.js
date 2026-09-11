// All reads/writes to the `notifications` table. Rows here are created
// entirely by the database trigger in 0008_notifications_trigger.sql —
// there's no createNotification() here on purpose, because the front end
// is never supposed to write to this table, only read from it.

import { supabase } from "./supabase-client.js";

/** Most recent notifications for a user, newest first. */
export async function getMyNotifications(userId, limit = 20) {
  return await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function markNotificationRead(notificationId) {
  return await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

/** Live updates the moment a new notification is inserted for this user. */
export function subscribeToNotifications(userId, onInsert) {
  return supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
}
