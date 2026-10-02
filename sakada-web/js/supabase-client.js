// Shared Supabase client for the whole site.
//
// The key is the PUBLISHABLE key (Supabase's current name for what
// used to be called the "anon" key). It's safe to expose in browser code —
// Row Level Security (sakada-backend/supabase/migrations/0005 and 0006)
// is what actually controls access, not keeping this key secret.
//
// The URL and key live in config.js — the single source of truth for all
// credentials. If you ever create a new Supabase project, update them
// there; see sakada-backend/docs/SETUP.md step 3.
//
// CDN pinned: @supabase/supabase-js@2.45.4 (last checked 2026-09-16)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    lock: false,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
