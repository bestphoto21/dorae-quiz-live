"use client";

import Link from "next/link";

export default function ParticipantEventError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-black uppercase text-rose-600">Error</p>
        <h1 className="mt-4 text-3xl font-black leading-tight">
          잠시 후 다시 시도해 주세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          참가 화면을 안전하게 불러오지 못했습니다. 진행자의 안내를 기다려
          주세요.
        </p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-800 shadow-sm"
          >
            첫 화면으로 이동
          </Link>
        </div>
      </section>
    </main>
  );
}
