import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// SERVER ONLY: this helper reads admin_profiles through the service-role client.
// Never import this module from Client Components.

export type AdminRole =
  | "super_admin"
  | "event_admin"
  | "operator"
  | "screen_operator"
  | "qna_moderator";

export type AdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Admin auth helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

export async function getCurrentUser(): Promise<User | null> {
  assertServerOnly();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("[admin-auth] Current auth user lookup failed.", {
      message: error?.message,
      status: error?.status,
      name: error?.name,
      hasUser: Boolean(user),
    });

    return null;
  }

  return user;
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  assertServerOnly();

  const user = await getCurrentUser();

  if (!user) {
    console.error("[admin-auth] Cannot load admin profile without auth user.");

    return null;
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase
    .from("admin_profiles")
    .select("id, email, name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin-auth] admin_profiles lookup failed.", {
      userId: user.id,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  if (!data) {
    console.error("[admin-auth] No admin_profiles row found.", {
      userId: user.id,
      email: user.email,
    });

    return null;
  }

  if (!data.is_active) {
    console.error("[admin-auth] Admin profile is inactive.", {
      userId: user.id,
      email: data.email,
    });

    return null;
  }

  return data as AdminProfile;
}

export async function requireAdmin(): Promise<AdminProfile> {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}
