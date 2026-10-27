# Sakada Logistics — Demo Guide

A step-by-step script for presenting the farmer/vendor dashboard, with the
driver side running beside it. Plan for about 10–12 minutes.

---

## 1. The day before

- [ ] Commit, push, and open the **live Vercel site** once. Test there, not on localhost.
- [ ] Prepare **two accounts**:
  - **Vendor** (or farmer). Add 1–2 saved addresses (Profile → Saved addresses) so booking is quick.
  - **Driver**. Add a vehicle (type + plate) so they can accept jobs.
- [ ] Have **1–2 past deliveries** already done, so History and ratings aren't empty.
- [ ] Driver side on a **phone with location on**. A phone's GPS puts the truck on the
      road; a laptop can be hundreds of metres off.
- [ ] Vendor side on the **laptop/projector**, and optionally on a second phone.
- [ ] **Phone alerts**: turn them on in Profile → Phone alerts on the vendor's phone
      (on iPhone, add Sakada to the Home Screen first).
- [ ] Record a **backup screen video** of the whole flow, in case the Wi-Fi is bad.
- [ ] Don't rely on **reset-password emails** during the demo. Supabase's built-in email
      only sends a few per hour. Show the screen, but don't wait for the email.

---

## 2. Opening (1 min)

> "Sakada connects farmers and vendors with truck drivers. You book a truck,
> see the fare before you confirm, and follow your harvest live until it's delivered.
> The receiver pays the driver in cash at drop-off."

Show the **landing page** for a few seconds, then **Log in** as the vendor.

---

## 3. Home (1 min)

- Point out the **Delivery status** tiles: Waiting, On the road, Delivered.
- **Active shipments**: each card has the real route map. On a phone you swipe
  between them; on desktop they show two per row.
- The **search bar** finds a booking by code (SK-00142) or by produce.

---

## 4. Book a truck (2–3 min)

1. **Book** → **Route & schedule**
   - **From**: start typing. Saved addresses come first, then real places from Mapbox.
     Mention **Pin on the map** for farms with no street address.
   - **To**: the market or warehouse.
   - Pick a **date** and **pickup time** → **Continue**.
2. **Shipment details**
   - Type a produce in English or Tagalog (e.g. "kamatis" → Tomatoes). Set the **kg** with the wheel.
   - Add a second produce row to show several produce in one booking.
   - Receiver name and phone → **Review booking**.
3. **Review**: the **fare is shown before booking**
   (₱150 base + ₱15/km + ₱2/kg, tolls included) → **Request booking**.
4. **Request sent**: show the booking code with **Copy** and **Track this shipment**.

> Talking point: "Every form checks its fields, even typos like gmail.co."

---

## 5. The driver accepts (1 min) — switch to the driver phone

1. The new request appears in the driver's **available jobs** → **Accept job** → confirm.
2. Back on the vendor screen: the status changes to **Driver assigned**. If phone alerts
   are on, the vendor's phone gets a notification.

---

## 6. Live tracking: the highlight (3 min)

1. Driver: **I've picked up the load**, then **I'm driving to drop-off**.
   The phone starts sharing its location every 20 seconds.
2. Vendor: open the shipment (**View details** or the Track tab):
   - The big status headline and the **5-step bar**, with "Next: …".
   - The driver's name, vehicle, plate and **rating**.
   - The map: the **amber line starts at the truck** and runs to the drop-off (B).
3. Tap **Maximize** (top right of the map):
   - The real map: pinch/scroll to zoom, drag around.
   - "Truck here just now" with a **green dot** (position under 2 minutes old).
   - Walk a few steps with the driver phone. The **truck glides** and the line follows it.
   - Drag the map away, then tap **Center on the truck**.

> Talking point: "The line isn't a fixed picture. It always starts where the truck
> really is, and if the driver leaves the road we ask for a new route from there."

---

## 7. Delivered + rating (1 min)

1. Driver: **I've delivered it** → **Yes, delivered and paid** (the cash check).
2. Vendor: status becomes **Delivered** → rate the driver with stars and an optional comment.
3. **History**: filters (All / Delivered / Cancelled), **Book again**, and pages of 25.

---

## 8. Quick extras (1–2 min, pick what fits)

- **Language**: Profile → Language → **Filipino** or **Taglish**. The whole dashboard
  switches, and the choice follows the account to a new phone.
- **Phone alerts**: show a notification arriving on the lock screen.
- **Late booking**: a booking whose pickup date passed shows **Book a new date** right in its status card.
- **Profile**: photo, saved addresses, Contact Support, How it works.
- **Show password** / **Forgot password?** on Log in.
- **Phone + desktop**: resize the browser or show both side by side.

---

## 9. If they ask "What's next?"

- **Receiver tracking link**: the receiver follows the truck without an account.
- **GCash payment**: today it's cash on delivery.
- **Driver dashboard redesign**: it works today, with the older look.
- **Own email sender** (custom SMTP) so password-reset emails always arrive.

---

## 10. If something goes wrong

| Problem | What to do |
| --- | --- |
| The truck doesn't move | Check the driver phone's location permission and signal. Positions come every 20 s. |
| The truck is off the road | That device's GPS is weak (common on laptops). Use a phone outdoors or near a window. |
| The map doesn't load | Check the Wi-Fi. Then play the backup video. |
| No phone alert | Check Profile → Phone alerts is **On** on that phone. Alerts are per phone. |
| Reset email doesn't arrive | Expected under the email limit. Move on; show the screen only. |
