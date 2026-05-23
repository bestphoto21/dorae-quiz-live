import Link from "next/link";
import type { ReactNode } from "react";
import { requireEventAccess } from "@/lib/auth/events";

type AdminEventLayoutProps = {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventLayout({
  children,
  params,
}: AdminEventLayoutProps) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId);
  const links = [
    { href: `/admin/events/${eventId}`, label: "개요" },
    { href: `/admin/events/${eventId}/settings`, label: "설정" },
    { href: `/admin/events/${eventId}/questions`, label: "문제" },
    { href: `/admin/events/${eventId}/surveys`, label: "설문" },
    { href: `/admin/events/${eventId}/live`, label: "라이브" },
    { href: `/admin/events/${eventId}/operations`, label: "통합 운영 콘솔" },
    { href: `/admin/events/${eventId}/draw`, label: "추첨" },
    { href: `/admin/events/${eventId}/qna`, label: "Q&A" },
    { href: `/admin/events/${eventId}/checklist`, label: "운영 체크리스트" },
    { href: `/admin/events/${eventId}/rehearsal`, label: "리허설" },
    { href: `/admin/events/${eventId}/exports`, label: "결과 다운로드" },
    { href: `/admin/events/${eventId}/clone`, label: "행사 복제" },
  ];

  return (
    <div>
      <nav className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/admin/events" className="font-black text-slate-700">
            행사 목록
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[color:#0a1a38]">
              {event.title}
            </p>
            <p className="text-xs font-bold text-slate-700">
              /e/{event.event_code}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] transition hover:border-[#0a1a38] hover:bg-slate-50"
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
