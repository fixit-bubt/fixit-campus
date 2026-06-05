import { createClient } from "@supabase/supabase-js";

// Single shared Supabase client for the whole app.
// Values come from .env (VITE_ vars are exposed to the browser at build time).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast with a clear message instead of letting createClient(undefined,…)
  // produce a cryptic runtime error deep in the app.
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// Session persistence (localStorage) is left to the supabase-js SDK defaults by design.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
