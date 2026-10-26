import webpush from "npm:web-push@3.6.7";
import type { Subscription } from "./handler.ts";
import type { PushPayload } from "./alert-text.ts";

type VapidDetails = { publicKey: string; privateKey: string; subject: string };
export function createPushSender(
  vapidDetails: VapidDetails,
  fetchPush: typeof fetch = fetch,
) {
  // Validate without logging library errors, which may contain supplied values.
  try {
    if (!vapidDetails.subject.startsWith("mailto:")) throw new Error();
    webpush.setVapidDetails(
      vapidDetails.subject,
      vapidDetails.publicKey,
      vapidDetails.privateKey,
    );
  } catch {
    throw new Error("Invalid VAPID configuration");
  }
  return async (
    subscription: Subscription,
    payload: PushPayload,
  ): Promise<number> => {
    const endpoint = new URL(subscription.endpoint);
    if (
      endpoint.protocol !== "https:" || endpoint.username || endpoint.password
    ) throw new Error("Invalid push URL");
    // web-push handles RFC 8291 encryption and VAPID signing; native fetch avoids
    // depending on Node's HTTPS transport in the Supabase Edge runtime.
    const details = webpush.generateRequestDetails(
      {
        endpoint: endpoint.href,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { vapidDetails, TTL: 12 * 60 * 60, contentEncoding: "aes128gcm" },
    );
    const response = await fetchPush(details.endpoint, {
      method: details.method,
      headers: details.headers,
      body: new Uint8Array(details.body),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    return response.status;
  };
}
