import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "slate" | "cyan" | "green" | "amber" | "rose";

const badgeTone: Record<Tone, string> = {
  slate: "border-slate-300 bg-slate-100 text-slate-900",
  cyan: "border-cyan-300 bg-cyan-100 text-cyan-950",
  green: "border-emerald-300 bg-emerald-100 text-emerald-950",
  amber: "border-amber-300 bg-amber-100 text-amber-950",
  rose: "border-rose-300 bg-rose-100 text-rose-950",
};

export function StatusBadge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black uppercase ${badgeTone[tone]}`}
    >
      {children}
    </span>
  );
}

export function PrimaryLink({
  href,
  children,
  variant = "dark",
}: {
  href: string;
  children: ReactNode;
  variant?: "dark" | "light" | "outline" | "accent";
}) {
  const classes = {
    dark:
      "border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500",
    light:
      "border-white bg-white text-slate-950 shadow-sm hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
    outline:
      "border-slate-400 bg-white text-slate-950 shadow-sm hover:border-slate-950 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500",
    accent:
      "border-cyan-300 bg-cyan-300 text-slate-950 shadow-sm hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
  };

  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-5 py-3 text-base font-black transition ${classes[variant]}`}
    >
      {children}
    </Link>
  );
}

export function SectionShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-200 p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

export function DemoCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-950 hover:shadow-md"
    >
      <p className="text-lg font-black text-slate-950">{title}</p>
      <p className="mt-2 break-all text-sm font-bold text-slate-700">
        {children}
      </p>
    </Link>
  );
}

export function AudienceLayout({
  eventCode,
  children,
}: {
  eventCode: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href={`/e/${eventCode}`} className="font-black">
            Dorae Quiz
          </Link>
          <StatusBadge tone="cyan">{eventCode.toUpperCase()}</StatusBadge>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-5 py-6">{children}</div>
    </main>
  );
}

export function AudienceHero({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <StatusBadge tone="cyan">{label}</StatusBadge>
      <h1 className="mt-5 text-4xl font-black leading-tight text-slate-950 sm:text-6xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-8 text-slate-700">{description}</p>
      {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
    </section>
  );
}

export function MobileCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {children}
    </section>
  );
}

export function AdminShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:py-10">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <StatusBadge tone="green">Operator Console</StatusBadge>
          <h1 className="mt-4 text-3xl font-black leading-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-700">
            {description}
          </p>
        </section>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function AdminPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-2xl font-black text-slate-950">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

export function AdminActionButton({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "cyan" | "amber" | "rose";
}) {
  const classes = {
    dark: "border-slate-950 bg-slate-950 text-white",
    cyan: "border-cyan-700 bg-cyan-700 text-white",
    amber: "border-amber-500 bg-amber-400 text-slate-950",
    rose: "border-rose-700 bg-rose-700 text-white",
  };

  return (
    <button
      type="button"
      disabled
      className={`min-h-14 rounded-2xl border px-5 py-3 text-base font-black shadow-sm disabled:cursor-not-allowed ${classes[tone]}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-xl font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
    </div>
  );
}

export function OperatorLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-950 hover:shadow-md"
    >
      <p className="text-2xl font-black text-slate-950">{title}</p>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-700">
        {description}
      </p>
      <span className="mt-5 inline-flex w-fit rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-black text-white">
        열기
      </span>
    </Link>
  );
}
