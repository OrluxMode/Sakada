// Dev-only: open the farmer dashboard with fake data and a "Demo / Worst case /
// Empty / One / Huge" switch at the bottom, to see how it handles bad data.
// Nothing here ships: it drives a local browser with the e2e Supabase mock.
//
//   npm run break-ui                    opens a browser you can click around in
//   npm run break-ui -- --shots <dir>   saves screenshots of every state instead
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { mockSupabase } from "./support/mock-supabase.mjs";
import { DATASETS, useDataset } from "./support/worst-case.mjs";

const BASE = process.env.BASE_URL || "http://localhost:4400";
const PAGE = "/dashboard/farmer/index.html";
const shotsAt = process.argv.includes("--shots") ? process.argv[process.argv.indexOf("--shots") + 1] : null;

async function ensureServer() {
  try {
    await fetch(BASE);
    return null;
  } catch {
    const server = spawn("npx", ["serve", ".", "-l", new URL(BASE).port], { stdio: "ignore" });
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        await fetch(BASE);
        return server;
      } catch {
        /* still starting */
      }
    }
    throw new Error(`No server at ${BASE}`);
  }
}

/** The switch: plain browser chrome, not part of the design under test. */
function injectToggle(names) {
  // Read before the app's own scripts tidy the URL.
  const current = new URLSearchParams(location.search).get("data") || "demo";
  addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.setAttribute("style", "position:fixed;left:50%;bottom:100px;transform:translateX(-50%);z-index:9999;display:flex;gap:2px;padding:3px;border-radius:10px;background:#d4d4d4;font:13px system-ui,sans-serif;box-shadow:0 2px 8px rgb(0 0 0/.3)");
    for (const name of names) {
      const b = document.createElement("button");
      b.textContent = { demo: "Demo data", worst: "Worst case", empty: "Empty", one: "One", huge: "Huge" }[name];
      b.setAttribute("style", `border:0;border-radius:7px;padding:6px 10px;cursor:pointer;font:inherit;color:#111;background:${name === current ? "#fff" : "transparent"};font-weight:${name === current ? 600 : 400}`);
      b.onclick = () => {
        const url = new URL(location.href);
        url.searchParams.set("data", name);
        localStorage.removeItem("sakada.ratingDismissed");
        location.href = url.toString();
      };
      bar.append(b);
    }
    document.body.append(bar);
  });
}

async function openDashboard(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const db = await mockSupabase(page, "farmer");
  // Pick the dataset from ?data= each time the page itself loads.
  await page.route("**/dashboard/farmer/**", (route) => {
    useDataset(db, new URL(route.request().url()).searchParams.get("data") || "demo");
    return route.continue();
  });
  await page.addInitScript(injectToggle, Object.keys(DATASETS));
  return page;
}

const server = await ensureServer();
if (shotsAt) {
  const browser = await chromium.launch();
  const widths = { phone320: 320, phone390: 390, desktop1440: 1440 };
  // Every tab, plus the busiest booking's Track page and the Profile pages.
  const views = ["home", "track", "track/first", "history", "profile", "profile/addresses", "book"];
  for (const name of Object.keys(DATASETS)) {
    for (const [label, width] of Object.entries(widths)) {
      const page = await openDashboard(browser, { width, height: 900 });
      for (const view of views) {
        const first = (DATASETS[name]().deliveries || [])[0]?.delivery_code || "SK-00001";
        await page.goto(`${BASE}${PAGE}?data=${name}#${view.replace("first", first)}`);
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${shotsAt}/${name}-${view.replace(/\//g, "-")}-${label}.png`, fullPage: true });
      }
      await page.close();
    }
  }
  await browser.close();
  server?.kill();
} else {
  const browser = await chromium.launch({ headless: false });
  const page = await openDashboard(browser, { width: 1280, height: 860 });
  await page.goto(`${BASE}${PAGE}?data=worst`);
  console.log("Flip the switch at the bottom of the page. Close the browser to stop.");
  browser.on("disconnected", () => server?.kill());
}
