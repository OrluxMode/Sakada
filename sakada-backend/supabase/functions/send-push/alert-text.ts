export type Profile = { language: string; role: string };
export type Notification = {
  id: string;
  user_id: string;
  delivery_id: string | null;
  message: string;
};
export type Delivery = {
  requester_id: string;
  status: string;
  delivery_code: string;
  driver_id: string | null;
  dropoff_address: string;
};
export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export function buildAlertText(
  language: string,
  status: string,
  code: string,
  driverName: string | null,
  dropoffAddress: string,
): { title: string; body: string } | null {
  const driver = driverName?.trim();
  const to = dropoffAddress.split(",")[0].trim();
  const texts: Record<string, Record<string, [string, string]>> = {
    en: {
      driver_assigned: [
        "Driver found",
        driver
          ? `${driver} accepted your booking.`
          : "A driver accepted your booking.",
      ],
      picked_up: ["Picked up", "The driver has your shipment."],
      in_transit: ["On the road", `Your shipment is on the way to ${to}.`],
      delivered: ["Delivered", "Your shipment was delivered."],
      cancelled: ["Cancelled", "This booking was cancelled."],
    },
    fil: {
      driver_assigned: [
        "May drayber na",
        driver
          ? `Tinanggap ni ${driver} ang iyong padala.`
          : "May drayber nang tumanggap sa iyong padala.",
      ],
      picked_up: ["Nakuha na", "Nasa drayber na ang iyong padala."],
      in_transit: ["Nasa daan na", `Papunta na sa ${to} ang iyong padala.`],
      delivered: ["Naihatid na", "Naihatid na ang iyong padala."],
      cancelled: ["Kinansela", "Kinansela ang padalang ito."],
    },
    taglish: {
      driver_assigned: [
        "May driver na",
        driver
          ? `Na-accept ni ${driver} ang booking mo.`
          : "May driver nang nag-accept ng booking mo.",
      ],
      picked_up: ["Na-pickup na", "Nasa driver na ang shipment mo."],
      in_transit: ["On the way na", `Papunta na sa ${to} ang shipment mo.`],
      delivered: ["Delivered na", "Na-deliver na ang shipment mo."],
      cancelled: ["Cancelled", "Na-cancel ang booking na ito."],
    },
  };
  const text = (texts[language] ?? texts.en)[status];
  return text ? { title: `${code} · ${text[0]}`, body: text[1] } : null;
}

export function buildPushPayload(
  notification: Notification,
  profile: Profile,
  delivery: Delivery | null,
  driverName: string | null,
): PushPayload {
  const text = delivery?.requester_id === notification.user_id
    ? buildAlertText(
      profile.language,
      delivery.status,
      delivery.delivery_code,
      driverName,
      delivery.dropoff_address,
    )
    : null;
  const dashboard = `/dashboard/${encodeURIComponent(profile.role)}/index.html`;
  return {
    ...(text ?? { title: "Sakada", body: notification.message }),
    url: delivery
      ? `${dashboard}#track/${encodeURIComponent(delivery.delivery_code)}`
      : dashboard,
    tag: delivery?.delivery_code ?? notification.id,
  };
}
