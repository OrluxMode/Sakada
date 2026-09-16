import { supabase } from "./supabase-client.js";
import { getCurrentProfile } from "./auth.js";

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session) {
    const profile = await getCurrentProfile();
    window.location.href =
      DASHBOARD_PATHS[profile?.role] || "../index.html";
  }
});

setTimeout(async () => {
  const profile = await getCurrentProfile();
  if (profile) {
    window.location.href =
      DASHBOARD_PATHS[profile.role] || "../index.html";
  }
}, 2500);
