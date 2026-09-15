// Shared Supabase client for the whole site.
//
// The key below is the PUBLISHABLE key (Supabase's current name for what
// used to be called the "anon" key). It's safe to expose in browser code —
// Row Level Security (sakada-backend/supabase/migrations/0005 and 0006)
// is what actually controls access, not keeping this key secret.
//
// If you ever create a new Supabase project, update these two values —
// see sakada-backend/docs/SETUP.md step 3.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://aeeniueayubeugvooyqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_1Y6nsjO_nS0j2Vz6xKqfmA_VpCpPs82";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
