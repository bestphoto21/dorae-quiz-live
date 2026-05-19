import Link from "next/link";
import type { ReactNode } from "react";

type AdminEventLayoutProps = {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventLayout({
  children,
  params,
}: AdminEventLayoutProps) {
  const { eventId } = await params;
  const links = [
    { href: `/admin/events/${eventId}`, label: "개요" },
    { href: `/admin/events/${eventId}/questions`, label: "문제" },
    { href: `/admin/events/${eventId}/live`, label: "라이브" },
    { href: `/admin/events/${eventId}/draw`, label: "추첨" },
    { href: `/admin/events/${eventId}/qna`, label: "Q&A" },
  ];

  return (
    <div>
      <nav className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/events" className="font-black text-slate-700">
            이벤트 목록
          </Link>
          <div className="flex gap-2 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:border-slate-950"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
