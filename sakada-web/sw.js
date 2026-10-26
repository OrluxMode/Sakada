// Sakada's service worker: phone alerts only (no offline caching).
// The backend (Edge Function send-push) sends { title, body, url, tag };
// tapping the alert opens that shipment's Track page.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() || "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Sakada", {
      body: data.body || "",
      icon: "/assets/icons/app/app-192.png",
      badge: "/assets/icons/app/badge-96.png",
      tag: data.tag || undefined, // a newer alert for the same booking replaces the older one
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // The dashboard is already open: bring it forward on that shipment.
    const tab = open.find((c) => c.url.split("#")[0] === url.split("#")[0]);
    if (tab) {
      await tab.focus();
      return tab.navigate(url).catch(() => {});
    }
    return self.clients.openWindow(url);
  })());
});
