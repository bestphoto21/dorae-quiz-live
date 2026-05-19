import Link from "next/link";
import {
  DemoCard,
  PrimaryLink,
  SectionShell,
  StatusBadge,
} from "@/components/quiz/ui";

const routes = [
  { href: "/e/dorae2026", label: "참가자 홈" },
  { href: "/e/dorae2026/join", label: "참가 등록" },
  { href: "/e/dorae2026/play", label: "문제 풀이" },
  { href: "/screen/dorae2026", label: "송출 화면" },
  { href: "/admin", label: "운영자 홈" },
  { href: "/admin/events", label: "이벤트 관리" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-between px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black">
            Dorae Quiz Live
          </Link>
          <StatusBadge tone="cyan">Stage 1 Dummy UI</StatusBadge>
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
              참가자 모바일 화면, 대형 송출 화면, 운영자 콘솔의 기본 라우팅과
              더미 UI를 갖춘 1단계 프로젝트입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/e/dorae2026">참가자 화면 보기</PrimaryLink>
              <PrimaryLink href="/admin" variant="light">
                운영자 화면 보기
              </PrimaryLink>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white p-5 text-slate-950 shadow-2xl">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-bold uppercase text-slate-500">
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

        <SectionShell className="bg-white text-slate-950">
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
