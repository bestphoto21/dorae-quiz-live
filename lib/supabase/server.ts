import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getServerSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local before creating the Supabase server client."
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. The server client uses the browser-safe publishable or anon public key, not the service role key."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function createServerSupabaseClient() {
  // Use this helper from Server Components, Server Actions, and Route Handlers.
  // It intentionally does not use SUPABASE_SERVICE_ROLE_KEY.
  const { supabaseUrl, supabaseAnonKey } = getServerSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. Server Actions and Route
          // Handlers can, so auth flows should perform mutations there.
        }
      },
    },
  });
}
