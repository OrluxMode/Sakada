// Async mock methods deliberately implement the store/transport Promise contracts.
// deno-lint-ignore-file require-await
import assert from "node:assert/strict";
import { createECDH, randomBytes, verify } from "node:crypto";
import { Buffer } from "node:buffer";
import webpush from "npm:web-push@3.6.7";
import ece from "npm:http_ece@1.2.0";
import { buildAlertText, buildPushPayload } from "./alert-text.ts";
import { createHandler } from "./handler.ts";
import { createPushSender } from "./transport.ts";
import type { PushStore, Subscription } from "./handler.ts";

Deno.test("exact alert copy: all three languages × five statuses, missing driver, short drop-off", () => {
  const statuses = [
    "driver_assigned",
    "picked_up",
    "in_transit",
    "delivered",
    "cancelled",
  ];
  const expected = {
    en: [
      ["Driver found", "Juan accepted your booking."],
      ["Picked up", "The driver has your shipment."],
      ["On the road", "Your shipment is on the way to Davao."],
      ["Delivered", "Your shipment was delivered."],
      ["Cancelled", "This booking was cancelled."],
    ],
    fil: [
      ["May drayber na", "Tinanggap ni Juan ang iyong padala."],
      ["Nakuha na", "Nasa drayber na ang iyong padala."],
      ["Nasa daan na", "Papunta na sa Davao ang iyong padala."],
      ["Naihatid na", "Naihatid na ang iyong padala."],
      ["Kinansela", "Kinansela ang padalang ito."],
    ],
    taglish: [
      ["May driver na", "Na-accept ni Juan ang booking mo."],
      ["Na-pickup na", "Nasa driver na ang shipment mo."],
      ["On the way na", "Papunta na sa Davao ang shipment mo."],
      ["Delivered na", "Na-deliver na ang shipment mo."],
      ["Cancelled", "Na-cancel ang booking na ito."],
    ],
  };
  for (const [language, rows] of Object.entries(expected)) {
    for (const [i, [title, body]] of rows.entries()) {
      assert.deepEqual(
        buildAlertText(
          language,
          statuses[i],
          "SK-00001",
          " Juan ",
          " Davao , Philippines",
        ),
        { title: `SK-00001 · ${title}`, body },
      );
    }
  }
  for (
    const [language, body] of Object.entries({
      en: "A driver accepted your booking.",
      fil: "May drayber nang tumanggap sa iyong padala.",
      taglish: "May driver nang nag-accept ng booking mo.",
    })
  ) {
    for (const driver of [null, "", "   "]) {
      assert.equal(
        buildAlertText(language, "driver_assigned", "SK-1", driver, "Davao")
          ?.body,
        body,
      );
    }
  }
  assert.equal(
    buildAlertText("es", "delivered", "SK-1", null, "Davao")?.body,
    "Your shipment was delivered.",
  );
  assert.equal(buildAlertText("en", "pending", "SK-1", null, "Davao"), null);
  assert.equal(
    buildAlertText("en", "in_transit", "SK-1", null, "Davao")?.body,
    "Your shipment is on the way to Davao.",
  );
});

const notification = {
  id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  user_id: "user-a",
  delivery_id: "delivery",
  message: "Stored message",
};
const delivery = {
  requester_id: "user-a",
  status: "delivered",
  delivery_code: "SK-00001",
  driver_id: "driver",
  dropoff_address: "Davao, Philippines",
};
const subscription = (id: string): Subscription => ({
  id,
  user_id: "user-a",
  endpoint: `https://push.example/${id}`,
  p256dh: "key",
  auth: "auth",
});

Deno.test("requester localization, driver fallback, routing, tag and missing delivery", () => {
  assert.deepEqual(
    buildPushPayload(
      notification,
      { language: "fil", role: "farmer" },
      delivery,
      null,
    ),
    {
      title: "SK-00001 · Naihatid na",
      body: "Naihatid na ang iyong padala.",
      url: "/dashboard/farmer/index.html#track/SK-00001",
      tag: "SK-00001",
    },
  );
  assert.deepEqual(
    buildPushPayload(notification, { language: "fil", role: "driver" }, {
      ...delivery,
      requester_id: "someone-else",
    }, null),
    {
      title: "Sakada",
      body: "Stored message",
      url: "/dashboard/driver/index.html#track/SK-00001",
      tag: "SK-00001",
    },
  );
  assert.deepEqual(
    buildPushPayload(
      notification,
      { language: "en", role: "vendor" },
      null,
      null,
    ),
    {
      title: "Sakada",
      body: "Stored message",
      url: "/dashboard/vendor/index.html",
      tag: notification.id,
    },
  );
});

function fixture(subscriptions: Subscription[] = [subscription("ok")]) {
  const removed: string[] = [],
    stamped: string[] = [],
    sent: string[] = [],
    logs: unknown[][] = [];
  const store: PushStore = {
    notification: async () => notification,
    profile: async () => ({ language: "taglish", role: "vendor" }),
    subscriptions: async () => subscriptions,
    delivery: async () => delivery,
    driverName: async () => "Juan",
    stillOwned: async () => true,
    remove: async (s) => {
      removed.push(s.id);
    },
    markSent: async (s) => {
      stamped.push(s.id);
    },
  };
  const deps = {
    webhookSecret: "test-secret",
    store,
    send: async (s: Subscription) => {
      sent.push(s.id);
      return 201;
    },
    log: (...values: unknown[]) => {
      logs.push(values);
    },
  };
  const request = (
    event: unknown = {
      type: "INSERT",
      schema: "public",
      table: "notifications",
      record: { id: notification.id },
    },
    secret = "test-secret",
  ) =>
    new Request("https://function.example", {
      method: "POST",
      headers: { "x-push-webhook-secret": secret },
      body: JSON.stringify(event),
    });
  return { deps, request, removed, stamped, sent, logs };
}

Deno.test("webhook authentication, method and payload validation precede database access", async () => {
  const f = fixture();
  f.deps.store.notification = () => {
    throw new Error("must not query");
  };
  const handler = createHandler(f.deps);
  assert.equal(
    (await handler(new Request("https://function.example"))).status,
    405,
  );
  assert.equal((await handler(f.request(undefined, ""))).status, 401);
  assert.equal(
    (await handler(f.request(undefined, "wrong-secret"))).status,
    401,
  );
  assert.equal((await handler(f.request({ type: "UPDATE" }))).status, 400);
  assert.equal((await handler(f.request(null))).status, 400);
  assert.equal(
    (await handler(
      new Request("https://function.example", {
        method: "POST",
        headers: { "x-push-webhook-secret": "test-secret" },
        body: "{",
      }),
    )).status,
    400,
  );
});

Deno.test("no subscription, deleted notification or missing profile is a no-op", async () => {
  for (const kind of ["subscriptions", "notification", "profile"]) {
    const f = fixture(kind === "subscriptions" ? [] : undefined);
    if (kind === "notification") f.deps.store.notification = async () => null;
    if (kind === "profile") f.deps.store.profile = async () => null;
    assert.equal((await createHandler(f.deps)(f.request())).status, 204);
    assert.deepEqual(f.sent, []);
  }
});

Deno.test("success stamps, 404/410 delete, failures isolated, moved phone skipped, safe logs", async () => {
  const f = fixture(
    ["ok", "404", "410", "503", "throws", "moved"].map(subscription),
  );
  f.deps.store.stillOwned = async (s) => s.id !== "moved";
  f.deps.send = async (s) => {
    f.sent.push(s.id);
    if (s.id === "throws") {
      throw new Error(`secret endpoint ${s.endpoint} private key`);
    }
    return s.id === "ok" ? 201 : Number(s.id);
  };
  const response = await createHandler(f.deps)(f.request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { sent: 1, failed: 2 });
  assert.deepEqual(f.removed.sort(), ["404", "410"]);
  assert.deepEqual(f.stamped, ["ok"]);
  assert(!f.sent.includes("moved"));
  assert(!JSON.stringify(f.logs).includes("https://"));
  assert(!JSON.stringify(f.logs).includes("private key"));
  const good = fixture();
  assert.equal((await createHandler(good.deps)(good.request())).status, 200);
  const failed = fixture();
  failed.deps.store.notification = async () => {
    throw new Error("sensitive database response");
  };
  assert.equal(
    (await createHandler(failed.deps)(failed.request())).status,
    500,
  );
  assert.deepEqual(failed.logs, [["push_processing_failed"]]);
});

Deno.test("Deno Web Push encryption round-trip, valid VAPID signature, TTL and native-fetch options", async () => {
  const keys = webpush.generateVAPIDKeys();
  const browserKey = createECDH("prime256v1");
  browserKey.generateKeys();
  const auth = randomBytes(16);
  const phone = {
    ...subscription("browser"),
    p256dh: browserKey.getPublicKey().toString("base64url"),
    auth: auth.toString("base64url"),
  };
  const payload = buildPushPayload(
    notification,
    { language: "fil", role: "farmer" },
    delivery,
    null,
  );
  let calls = 0;
  const mockFetch: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, phone.endpoint);
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    assert(options?.signal);
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("ttl"), "43200");
    assert.equal(headers.get("content-encoding"), "aes128gcm");
    const authorization = headers.get("authorization")!;
    const token = authorization.match(/t=([^,]+)/)![1];
    const [header, claims, signature] = token.split(".");
    assert.equal(
      JSON.parse(Buffer.from(header, "base64url").toString()).alg,
      "ES256",
    );
    const decoded = JSON.parse(Buffer.from(claims, "base64url").toString());
    assert.equal(decoded.aud, "https://push.example");
    assert.equal(decoded.sub, "mailto:owner@example.com");
    assert(decoded.exp > Date.now() / 1000);
    const rawPublic = Buffer.from(keys.publicKey, "base64url");
    assert(verify("sha256", Buffer.from(`${header}.${claims}`), {
      key: {
        kty: "EC",
        crv: "P-256",
        x: rawPublic.subarray(1, 33).toString("base64url"),
        y: rawPublic.subarray(33).toString("base64url"),
      },
      format: "jwk",
      dsaEncoding: "ieee-p1363",
    }, Buffer.from(signature, "base64url")));
    const decrypted = ece.decrypt(Buffer.from(options!.body as Uint8Array), {
      privateKey: browserKey,
      authSecret: auth,
      version: "aes128gcm",
    });
    assert.deepEqual(JSON.parse(decrypted.toString()), payload);
    return new Response(null, { status: 201 });
  };
  const send = createPushSender({
    ...keys,
    subject: "mailto:owner@example.com",
  }, mockFetch);
  assert.equal(await send(phone, payload), 201);
  assert.equal(calls, 1);
  await assert.rejects(() =>
    send({ ...phone, endpoint: "http://push.example/bad" }, payload)
  );
  await assert.rejects(() =>
    send({ ...phone, endpoint: "https://user:pass@push.example/bad" }, payload)
  );
  assert.equal(calls, 1);
});
