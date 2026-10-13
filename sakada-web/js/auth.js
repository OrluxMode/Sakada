// Shared authentication helpers. Every auth/ and dashboard/ page imports
// from here rather than calling supabase.auth directly, so the logic for
// "what counts as logged in" and "where does each role belong" lives in
// exactly one place.

import { supabase } from "./supabase-client.js";

/**
 * Register a new farmer, vendor, or driver with email/password.
 * The role and name travel as signup metadata; the database trigger
 * (0004_auth_trigger.sql) reads it and creates the profile row —
 * this function never writes to `profiles` directly.
 */
export async function registerWithEmail({ email, password, fullName, role }) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: new URL("../auth/callback.html", window.location.href)
        .href,
    },
  });
}

export async function loginWithEmail({ email, password }) {
  return await supabase.auth.signInWithPassword({ email, password });
}

/**
 * Google sign-in. `role` is only meaningful the first time a given Google
 * account signs in. OAuth can't carry signup metadata, so the role is
 * stored locally as `sakada.pendingRole` and applied by callback.js after
 * sign-in via the `set_initial_role` RPC — the database (0018) confirms it
 * once. Signing in again with an existing account ignores it (the account
 * already has a role, and users aren't allowed to change their own role —
 * see 0006_prevent_role_escalation.sql).
 */
export async function loginWithGoogle(role) {
  if (role === "farmer" || role === "vendor" || role === "driver") {
    localStorage.setItem(
      "sakada.pendingRole",
      JSON.stringify({ role, at: Date.now() }),
    );
  } else {
    localStorage.removeItem("sakada.pendingRole");
  }
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("../auth/callback.html", window.location.href).href,
    },
  });
}

export async function signOut(homePath) {
  localStorage.removeItem("sakada.role");
  await supabase.auth.signOut();
  window.location.href = homePath;
}

/**
 * Update the user's last_login_at timestamp (used by 0011 to only
 * notify active drivers). Safe to call on every page load — it's idempotent.
 * Silently ignores 404 if migration 0011 hasn't been run yet.
 */
export async function updateLastLogin() {
  await supabase.rpc("update_my_last_login");
}

/** Returns the signed-in user's profile row, or null if not logged in. */
export async function getCurrentProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return profile;
}

/**
 * Guards a dashboard page: redirects to login if nobody's signed in,
 * redirects home if they're signed in as the wrong role. Call this at the
 * top of every dashboard page's script and only render content after it
 * resolves.
 */
export async function requireRole(expectedRole, loginPath, homePath) {
  const profile = await getCurrentProfile();
  if (!profile) {
    localStorage.removeItem("sakada.role");
    window.location.href = loginPath;
    return null;
  }
  if (profile.role !== expectedRole) {
    window.location.href = homePath;
    return null;
  }
  localStorage.setItem("sakada.role", profile.role);
  return profile;
}
