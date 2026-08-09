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
// flowType/detectSessionInUrl are spelled out (not just relying on v2 defaults) because
// the app uses a hash router (#/path): PKCE puts its ?code= in the query string, which
// the SDK strips on load before the router ever sees the URL, so the two never collide.
// The implicit flow would instead land the token in the #fragment, which the hash
// router would misread as a route — must never switch to that flow.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true },
});
