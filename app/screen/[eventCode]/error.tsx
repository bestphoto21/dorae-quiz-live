"use client";

export default function ScreenError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1a38] p-8 text-white">
      <section className="w-full rounded-3xl bg-white p-12 text-center text-[color:#0a1a38] shadow-2xl">
        <p className="text-3xl font-black uppercase text-rose-600">
          Screen Standby
        </p>
        <h1 className="mt-6 text-6xl font-black leading-tight sm:text-8xl">
          송출 화면을 준비 중입니다
        </h1>
        <p className="mt-6 text-3xl font-bold leading-tight text-slate-700">
          잠시 후 다시 시도하거나 운영자에게 알려 주세요
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-10 min-h-14 rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-6 py-4 text-xl font-black text-white shadow-sm hover:bg-[#10284f]"
        >
          다시 시도
        </button>
      </section>
    </main>
  );
}
