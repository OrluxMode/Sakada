import { supabase } from "./supabase-client.js";
import { getCurrentProfile } from "./auth.js";

const DASHBOARD_PATHS = {
  farmer: "../dashboard/farmer/index.html",
  vendor: "../dashboard/vendor/index.html",
  driver: "../dashboard/driver/index.html",
  admin: "../dashboard/admin/index.html",
};

const PENDING_ROLE_KEY = "sakada.pendingRole";
const PENDING_ROLE_MAX_AGE = 15 * 60 * 1000;

// finish() may be triggered by onAuthStateChange (SIGNED_IN) or by the
// 2.5s timeout, whichever comes first — `done` makes sure only one of
// them ever redirects, and `running` stops the second one from starting
// while the first is still waiting on the network.
let done = false;
let running = false;

/** Read the role auth.js stored before the OAuth redirect, always clearing it. */
function takePendingRole() {
  try {
    const raw = localStorage.getItem(PENDING_ROLE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  } finally {
    localStorage.removeItem(PENDING_ROLE_KEY);
  }
}

async function finish() {
  if (done || running) return;
  running = true;

  let profile = await getCurrentProfile();
  // No profile yet: the next trigger or the 10s fallback will handle it.
  if (!profile) {
    running = false;
    return;
  }

  const pending = takePendingRole();
  const role = pending?.role;
  const isFresh =
    typeof pending?.at === "number" && Date.now() - pending.at < PENDING_ROLE_MAX_AGE;
  const isValid = role === "farmer" || role === "vendor" || role === "driver";

  if (isValid && isFresh && profile.role_confirmed_at == null) {
    if (role !== profile.role) {
      const { error } = await supabase.rpc("set_initial_role", { p_role: role });
      if (!error) {
        const reloaded = await getCurrentProfile();
        if (reloaded) profile = reloaded;
      }
      // Error (e.g. the account is too old to pick a role): ignore it
      // and continue with the current profile.
    } else {
      // Same role: the RPC call still confirms it so it can't change later.
      await supabase.rpc("set_initial_role", { p_role: role });
    }
  }

  done = true;
  window.location.href = DASHBOARD_PATHS[profile.role] || "../index.html";
}

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session) {
    await finish();
  }
});

setTimeout(async () => {
  await finish();
}, 2500);

// N16: if nothing has redirected after 10s, tell the user instead of
// leaving "Signing you in…" on screen forever.
setTimeout(() => {
  if (done) return;
  const status = document.getElementById("callbackStatus");
  if (!status) return;
  status.textContent = "We couldn't finish signing you in. ";
  const link = document.createElement("a");
  link.href = "login.html";
  link.textContent = "Try logging in again";
  status.appendChild(link);
}, 10000);
