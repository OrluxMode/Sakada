// Finds the English strings the translated pages show (tests/i18n.test.js).
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Vitest runs from sakada-web/ (under jsdom import.meta.url isn't a file path).
const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// Scripts that run on the translated pages.
const SCRIPTS = [
  "requester-dashboard", "dashboard-shared", "profile-pages", "settings-pages", "contact-sheet", "produce-rows",
  "kg-wheel", "produce", "place-suggest", "pin-map", "saved-addresses", "offline", "toast", "validators", "field-errors",
  "mapbox-client", "signup-result", "login", "register", "reset-password", "password-toggle",
].map((f) => `js/${f}.js`);
const PAGES = ["dashboard/farmer/index.html", "dashboard/vendor/index.html", "auth/login.html", "auth/register.html", "auth/reset-password.html"];

/** The English text inside each t(…) call's first argument (ternaries and nested t() included). */
export function keysInScript(src) {
  const keys = new Set();
  const call = /(?<![\w$.])t\(/g;
  for (let m = call.exec(src); m; m = call.exec(src)) {
    let i = m.index + 2;
    let depth = 0;
    let arg = "";
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '"' || c === "`") {
        const end = src.indexOf(c, i + 1);
        arg += src.slice(i, end + 1);
        i = end;
        continue;
      }
      if (c === "(" || c === "{" || c === "[") depth++;
      if (c === ")" || c === "}" || c === "]") {
        if (depth === 0) break;
        depth--;
      }
      if (c === "," && depth === 0) break; // the values object starts here
      arg += c;
    }
    for (const s of arg.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      if (/[=!]==\s*$/.test(arg.slice(0, s.index))) continue; // a value compared against, not shown
      keys.add(s[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"));
    }
  }
  return keys;
}

/** Words written in the page itself: text between tags, placeholders, aria-labels, titles. */
function keysInPage(html) {
  const keys = new Set();
  const body = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<svg[\s\S]*?<\/svg>/g, "")
    .replace(/<([a-z]+)[^>]*data-i18n-skip[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  for (const m of body.matchAll(/>([^<>]+)</g)) {
    const text = m[1].replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
    if (/[A-Za-z]{2}/.test(text) && !/^(SAKA|DA|kg|SK-\d+)$/.test(text)) keys.add(text);
  }
  for (const m of body.matchAll(/(?:placeholder|aria-label|title)="([^"]+)"/g)) {
    if (/[A-Za-z]{2}/.test(m[1]) && !/^SK-\d+$/.test(m[1])) keys.add(m[1]);
  }
  return keys;
}

// Built from data rather than written inside t("…").
const DYNAMIC = [
  "Book shipment", "Book a shipment", "Route & schedule · 1 of 3", "Shipment details", "Recipient & cargo · 2 of 3",
  "Review booking", "Check your booking", "Review your details · 3 of 3", "Booking request", "Request sent.",
  "Waiting for a driver to accept your booking.", "Track",
  "Driver assigned", "Picked up", "In transit", "Waiting", "Delivered",
  "Pending", "Driver Assigned", "Picked Up", "In Transit", "Cancelled",
  "Province", "District", "City or town", "Area", "Street",
  "Pickup date\nhas passed.", "Waiting for\na driver.", "Driver\nassigned.", "Goods\npicked up.",
  "Your shipment\nis on the road.", "Your shipment\narrived.", "Booking\ncancelled.", "Your\nshipment.",
  "Your\nshipments.", "Nothing on\nthe road.", "Not\nfound.",
  "All", "Location isn't available here. Move the map to your spot.",
  "Location is off for this site. Move the map to your spot, or turn location on in your browser settings.",
  "Couldn't find your location. Move the map to your spot.", "Move the map so the pin sits on the exact spot.",
  "Book your first truck from your dashboard. You see the fare before you confirm.",
  "Add your vehicle in your dashboard so senders know which truck to look for.",
  "No connection. Check your signal and try again. Your details are still here.",
  "A driver accepted your delivery {code}.", "Your delivery {code} has been picked up.", "Your delivery {code} is in transit.",
  "Your delivery {code} has been delivered.", "Your delivery {code} was cancelled.",
  "On", "Off", "Blocked by the browser", "Needs the Home Screen app", "Not available in this browser", "Not ready yet",
  "A driver accepts your booking", "It's picked up", "It's on the road", "It's delivered", "It's cancelled",
  "Alerts are blocked for Sakada",
  "Your browser said no to alerts earlier. To turn them on: open the browser's site settings for Sakada, set Notifications to Allow, then come back here.",
  "This browser can't show alerts", "Try Chrome on Android, or the Home Screen app on iPhone.",
  "Vegetable", "Fruit",
  "Phone alerts are almost ready", "We're still setting them up. Your updates are in Profile → Notifications until then.",
];

export function allKeys() {
  const keys = new Set(DYNAMIC);
  for (const f of SCRIPTS) for (const k of keysInScript(read(f))) keys.add(k);
  for (const p of PAGES) for (const k of keysInPage(read(p))) keys.add(k);
  return [...keys].filter((k) => /[A-Za-z]{2}/.test(k));
}
