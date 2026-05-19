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
    return null;
  }

  return user;
}

export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  assertServerOnly();

  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase
    .from("admin_profiles")
    .select("id, email, name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
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
