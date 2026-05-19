import { createClient } from "@supabase/supabase-js";

// SERVER ONLY: this client uses SUPABASE_SERVICE_ROLE_KEY.
// Never import this file from Client Components or browser-executed modules.
// Use only in trusted server code after authorization checks are implemented.

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminSupabaseClient must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

function getAdminSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local before creating the Supabase admin client."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This server-only key is required for the Supabase admin client and must never be exposed to browser code."
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

export function createAdminSupabaseClient() {
  assertServerOnly();

  const { supabaseUrl, serviceRoleKey } = getAdminSupabaseEnv();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
