import { redirect } from "next/navigation";
import LoginForm from "@/app/admin/login/LoginForm";
import { getCurrentAdmin } from "@/lib/auth/admin";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();

  if (admin) {
    redirect("/admin/events");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-[color:#0a1a38] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_28rem]">
          <div className="bg-[#0a1a38] p-8 text-white sm:p-10">
            <p className="text-sm font-black uppercase text-cyan-200">
              Dorae Quiz Live
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
              관리자 로그인
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              행사 운영자 콘솔에 접근하려면 Supabase Auth 계정과 활성 관리자
              프로필이 필요합니다.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold leading-6 text-slate-600">
                로그인 후 활성 관리자 권한이 확인되면 이벤트 관리 화면으로
                이동합니다.
              </p>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
