import { createBrowserClient } from "@supabase/ssr";

function getPublicSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local before creating the Supabase browser client."
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Add the Supabase publishable or anon public key to .env.local."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createBrowserSupabaseClient() {
  // Use this helper only from Client Components or browser-only modules.
  // It must use NEXT_PUBLIC_ values only.
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
