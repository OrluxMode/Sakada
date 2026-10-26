import { timingSafeEqual } from "node:crypto";
import { buildPushPayload } from "./alert-text.ts";
import type {
  Delivery,
  Notification,
  Profile,
  PushPayload,
} from "./alert-text.ts";

export type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type PushStore = {
  notification(id: string): Promise<Notification | null>;
  profile(id: string): Promise<Profile | null>;
  subscriptions(userId: string): Promise<Subscription[]>;
  delivery(id: string): Promise<Delivery | null>;
  driverName(id: string): Promise<string | null>;
  stillOwned(subscription: Subscription): Promise<boolean>;
  remove(subscription: Subscription): Promise<void>;
  markSent(subscription: Subscription): Promise<void>;
};
type Dependencies = {
  webhookSecret: string;
  store: PushStore;
  send(subscription: Subscription, payload: PushPayload): Promise<number>;
  log(event: string, subscriptionId?: string, status?: number): void;
};

// No user JWT or public API key can invoke the sender. Only the configured
// database webhook has this separate, high-entropy credential.
export function createHandler(
  { webhookSecret, store, send, log }: Dependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const supplied = new TextEncoder().encode(
      request.headers.get("x-push-webhook-secret") ?? "",
    );
    const expected = new TextEncoder().encode(webhookSecret);
    if (
      !expected.length || supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    let event;
    try {
      event = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (
      event?.type !== "INSERT" || event?.schema !== "public" ||
      event?.table !== "notifications" ||
      typeof event?.record?.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        event.record.id,
      )
    ) {
      return new Response("Invalid notification event", { status: 400 });
    }
    try {
      // Re-read trusted rows; the webhook body supplies only the notification ID.
      const notification = await store.notification(event.record.id);
      if (!notification) return new Response(null, { status: 204 });
      const [profile, subscriptions] = await Promise.all([
        store.profile(notification.user_id),
        store.subscriptions(notification.user_id),
      ]);
      if (!profile || !subscriptions.length) {
        return new Response(null, { status: 204 });
      }
      const delivery = notification.delivery_id
        ? await store.delivery(notification.delivery_id)
        : null;
      const driverName =
        delivery?.requester_id === notification.user_id && delivery.driver_id
          ? await store.driverName(delivery.driver_id)
          : null;
      const payload = buildPushPayload(
        notification,
        profile,
        delivery,
        driverName,
      );
      const results = await Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            // A shared phone may have logged out or switched accounts since load.
            if (!await store.stillOwned(subscription)) return "skipped";
            const status = await send(subscription, payload);
            if (status === 404 || status === 410) {
              await store.remove(subscription);
              return "expired";
            }
            if (status >= 200 && status < 300) {
              await store.markSent(subscription);
              return "sent";
            }
            log("push_service_rejected", subscription.id, status);
            return "failed";
          } catch {
            // Never log exceptions: library/network errors may contain endpoints,
            // encrypted bodies or VAPID authorization headers.
            log("push_delivery_failed", subscription.id);
            return "failed";
          }
        }),
      );
      return Response.json({
        sent: results.filter((x) => x === "sent").length,
        failed: results.filter((x) => x === "failed").length,
      }, { status: results.includes("failed") ? 502 : 200 });
    } catch {
      log("push_processing_failed");
      return new Response("Push processing failed", { status: 500 });
    }
  };
}
