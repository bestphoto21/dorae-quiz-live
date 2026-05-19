"use server";

import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LoginActionState = {
  message: string | null;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");

  if (!email) {
    console.error("[admin-login] Missing email after trim.");
  }

  if (!password) {
    console.error("[admin-login] Missing password after trim.", {
      hasPassword: false,
    });
  }

  if (!email || !password) {
    return {
      message: "이메일과 비밀번호를 모두 입력해 주세요.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[admin-login] Supabase signInWithPassword failed.", {
      message: error.message,
      status: error.status,
      name: error.name,
    });

    return {
      message: "이메일 또는 비밀번호를 확인해 주세요.",
    };
  }

  const admin = await getCurrentAdmin();

  if (!admin) {
    console.error("[admin-login] Active admin profile was not found.");

    await supabase.auth.signOut();

    return {
      message: "활성 관리자 권한이 없는 계정입니다.",
    };
  }

  redirect("/admin/events");
}
