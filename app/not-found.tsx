import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10 text-slate-950">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase text-slate-500">404</p>
        <h1 className="mt-4 text-4xl font-black leading-tight">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          주소를 다시 확인하거나 관리자 홈으로 이동해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/admin/events"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
          >
            관리자 홈으로 이동
          </Link>
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
