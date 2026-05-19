"use client";

import Link from "next/link";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase text-rose-600">
          Temporary Error
        </p>
        <h1 className="mt-4 text-4xl font-black leading-tight">
          잠시 문제가 발생했습니다
        </h1>
        <p className="mt-4 text-base font-bold leading-7 text-slate-700">
          화면을 다시 불러오거나 관리자 홈에서 상태를 확인해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
          >
            다시 시도
          </button>
          <Link
            href="/admin/events"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm"
          >
            관리자 홈으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
