"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ko">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10 text-white">
          <section className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white p-8 text-center text-slate-950 shadow-sm">
            <p className="text-sm font-black uppercase text-rose-600">
              System Error
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight">
              화면을 안전하게 표시하지 못했습니다
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              잠시 후 다시 시도해 주세요. 내부 오류 정보는 화면에 표시하지
              않습니다.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 min-h-12 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
            >
              다시 시도
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
