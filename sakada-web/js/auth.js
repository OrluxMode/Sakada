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
 * account signs in — it's passed as signup metadata the same way the
 * email/password path does, so 0004_auth_trigger.sql can set the correct
 * role at account-creation time. Signing in again with an existing
 * account ignores it (the account already has a role, and users aren't
 * allowed to change their own role — see 0006_prevent_role_escalation.sql).
 */
export async function loginWithGoogle(role) {
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      data: role ? { role } : undefined,
      redirectTo: new URL("../auth/callback.html", window.location.href).href,
    },
  });
}

export async function signOut(homePath) {
  await supabase.auth.signOut();
  window.location.href = homePath;
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
    window.location.href = loginPath;
    return null;
  }
  if (profile.role !== expectedRole) {
    window.location.href = homePath;
    return null;
  }
  return profile;
}
