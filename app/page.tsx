import Link from "next/link";
import {
  DemoCard,
  PrimaryLink,
  SectionShell,
  StatusBadge,
} from "@/components/quiz/ui";

const routes = [
  { href: "/admin", label: "운영자 홈" },
  { href: "/admin/events", label: "이벤트 관리" },
  { href: "/admin/health", label: "운영 점검" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a1a38] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black text-white">
            Dorae Quiz Live
          </Link>
          <StatusBadge tone="cyan">운영 점검용</StatusBadge>
        </header>

        <div className="grid gap-8 py-12 lg:grid-cols-[1fr_28rem] lg:items-center">
          <div>
            <p className="text-base font-bold uppercase text-cyan-200">
              Live Event Quiz Platform
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-none sm:text-7xl lg:text-8xl">
              현장 퀴즈를 크게, 빠르게, 실수 없이.
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-300">
              참가자 등록, 퀴즈 진행, Q&A, 럭키드로우, 대형 스크린 송출을
              행사별 운영 콘솔에서 관리합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/admin" variant="accent">
                운영자 홈 열기
              </PrimaryLink>
              <PrimaryLink href="/admin/events" variant="light">
                이벤트 관리 열기
              </PrimaryLink>
            </div>
            <p className="mt-5 max-w-2xl rounded-2xl border border-white/15 bg-white/10 p-4 text-base font-bold leading-7 text-slate-100">
              참가자 등록 URL과 스크린 URL은 행사별로 다릅니다. 관리자 이벤트
              관리에서 해당 행사 상세 화면에 들어가 복사해 주세요.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white p-5 text-[color:#0a1a38] shadow-2xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold uppercase text-slate-700">
                Now On Screen
              </p>
              <p className="mt-4 text-5xl font-black">Q1</p>
              <p className="mt-4 text-2xl font-black leading-tight">
                오늘 행사의 첫 번째 퀴즈가 곧 시작됩니다.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {["A", "B", "C", "D"].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-2xl font-black"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <SectionShell className="bg-white text-[color:#0a1a38]">
          <div className="mb-5">
            <StatusBadge tone="slate">운영자 바로가기</StatusBadge>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-700">
              공개 메인 화면에는 특정 행사 코드의 참가자 링크를 고정하지
              않습니다.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {routes.map((route) => (
              <DemoCard key={route.href} href={route.href} title={route.label}>
                {route.href}
              </DemoCard>
            ))}
          </div>
        </SectionShell>
      </section>
    </main>
  );
}
