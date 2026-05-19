"use client";

import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase text-rose-600">
          Admin Error
        </p>
        <h1 className="mt-4 text-4xl font-black leading-tight">
          관리자 화면을 불러오지 못했습니다
        </h1>
        <p className="mt-4 text-base font-bold leading-7 text-slate-700">
          내부 오류 내용은 화면에 표시하지 않습니다. 잠시 후 다시 시도하거나
          헬스체크에서 기본 연결 상태를 확인해 주세요.
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
          <Link
            href="/admin/health"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm"
          >
            헬스체크 열기
          </Link>
        </div>
      </section>
    </main>
  );
}
