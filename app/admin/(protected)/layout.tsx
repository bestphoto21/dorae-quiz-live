import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth/admin";

type ProtectedAdminLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedAdminLayout({
  children,
}: ProtectedAdminLayoutProps) {
  const admin = await requireAdmin();
  const displayName = admin.name?.trim() || admin.email;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link href="/admin/events" className="text-lg font-black text-slate-950">
            Dorae Quiz Admin
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs font-black uppercase text-slate-500">Admin</p>
              <p className="text-sm font-black text-slate-950">{displayName}</p>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950 hover:text-slate-950"
              >
                로그아웃
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
