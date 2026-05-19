import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "slate" | "cyan" | "green" | "amber" | "rose";

const badgeTone: Record<Tone, string> = {
  slate: "border-slate-200 bg-slate-100 text-slate-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
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
  variant?: "dark" | "light" | "outline";
}) {
  const classes = {
    dark: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
    light: "border-white bg-white text-slate-950 hover:bg-slate-100",
    outline:
      "border-slate-300 bg-white text-slate-800 hover:border-slate-950 hover:text-slate-950",
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
      <p className="mt-2 break-all text-sm font-bold text-slate-500">
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
      <p className="mt-4 text-lg leading-8 text-slate-600">{description}</p>
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
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
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
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
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
    cyan: "border-cyan-600 bg-cyan-600 text-white",
    amber: "border-amber-500 bg-amber-500 text-slate-950",
    rose: "border-rose-600 bg-rose-600 text-white",
  };

  return (
    <button
      type="button"
      disabled
      className={`min-h-14 rounded-2xl border px-5 py-3 text-base font-black shadow-sm opacity-70 ${classes[tone]}`}
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
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
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
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
        {description}
      </p>
      <span className="mt-5 inline-flex w-fit rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2.5 text-sm font-black text-white">
        열기
      </span>
    </Link>
  );
}
