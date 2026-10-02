// Centralized configuration for Sakada.
//
// In development, values come from the defaults below.
// In production, inject via hosting platform env vars:
//   Netlify:  Set env vars in Site Settings → Environment Variables
//   Vercel:   Set env vars in Project Settings → Environment Variables
//   Custom:   Inject a <script> that sets window.__SAKADA_CONFIG__ before app loads
//
// To use in any JS file:
//   import { config } from "./config.js";
//   console.log(config.supabaseUrl);

const overrides = typeof window !== "undefined" && window.__SAKADA_CONFIG__
  ? window.__SAKADA_CONFIG__
  : {};

export const config = {
  supabaseUrl: overrides.supabaseUrl || "https://aeeniueayubeugvooyqj.supabase.co",
  supabaseKey: overrides.supabaseKey || "sb_publishable_1Y6nsjO_nS0j2Vz6xKqfmA_VpCpPs82",
  mapboxToken: overrides.mapboxToken || "pk.eyJ1IjoicWFkcmlhbmNhcmxvIiwiYSI6ImNtdTJpMW5iYzA3MHMyeXNlcW1oYnpsODkifQ.eIvugh9G7UAa-sTCkJmZ7g",
};
