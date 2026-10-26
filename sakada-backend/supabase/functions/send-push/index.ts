import { createClient } from "npm:@supabase/supabase-js@2.99.1";
import { createHandler } from "./handler.ts";
import { createPushSender } from "./transport.ts";
import type { PushStore, Subscription } from "./handler.ts";

function secret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing secret: ${name}`);
  return value;
}
const db = createClient(
  secret("SUPABASE_URL"),
  secret("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const vapidDetails = {
  publicKey: secret("VAPID_PUBLIC_KEY"),
  privateKey: secret("VAPID_PRIVATE_KEY"),
  subject: secret("VAPID_SUBJECT"),
};

function checked<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw new Error("Push database operation failed");
  return data;
}
// Match ownership AND keys when maintaining an endpoint, so an in-flight send
// cannot remove or stamp a subscription subsequently moved to another account.
function matching(subscription: Subscription) {
  return `id,user_id,endpoint,p256dh,auth`.split(",").map((key) =>
    [key, subscription[key as keyof Subscription]] as const
  );
}
const store: PushStore = {
  async notification(id) {
    return checked(
      await db.from("notifications").select("id,user_id,delivery_id,message")
        .eq("id", id).maybeSingle(),
    );
  },
  async profile(id) {
    return checked(
      await db.from("profiles").select("language,role").eq("id", id)
        .maybeSingle(),
    );
  },
  async subscriptions(userId) {
    return checked(
      await db.from("push_subscriptions").select(
        "id,user_id,endpoint,p256dh,auth",
      ).eq("user_id", userId),
    ) ?? [];
  },
  async delivery(id) {
    return checked(
      await db.from("deliveries")
        .select("requester_id,status,delivery_code,driver_id,dropoff_address")
        .eq("id", id).maybeSingle(),
    );
  },
  async driverName(id) {
    return checked(
      await db.from("profiles").select("full_name").eq("id", id).maybeSingle(),
    )?.full_name ?? null;
  },
  async stillOwned(subscription) {
    let query = db.from("push_subscriptions").select("id");
    for (const [key, value] of matching(subscription)) {
      query = query.eq(key, value);
    }
    return checked(await query.maybeSingle()) !== null;
  },
  async remove(subscription) {
    let query = db.from("push_subscriptions").delete();
    for (const [key, value] of matching(subscription)) {
      query = query.eq(key, value);
    }
    checked(await query);
  },
  async markSent(subscription) {
    let query = db.from("push_subscriptions").update({
      last_sent_at: new Date().toISOString(),
    });
    for (const [key, value] of matching(subscription)) {
      query = query.eq(key, value);
    }
    checked(await query);
  },
};

Deno.serve(
  createHandler({
    webhookSecret: secret("PUSH_WEBHOOK_SECRET"),
    store,
    send: createPushSender(vapidDetails),
    log: (event, subscriptionId, status) =>
      console.warn(JSON.stringify({ event, subscriptionId, status })),
  }),
);
