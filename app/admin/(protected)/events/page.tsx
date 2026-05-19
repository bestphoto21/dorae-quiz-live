import Link from "next/link";
import { AdminPanel, AdminShell, EmptyState, StatusBadge } from "@/components/quiz/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminAccessibleEvents, type EventRecord } from "@/lib/auth/events";

function formatDateTime(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function EventCard({ event }: { event: EventRecord }) {
  const active = event.is_active ?? true;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <StatusBadge tone={active ? "green" : "amber"}>
            {active ? "활성" : "비활성"}
          </StatusBadge>
          <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950">
            {event.title}
          </h2>
          {event.subtitle && (
            <p className="mt-2 text-sm font-bold text-slate-500">
              {event.subtitle}
            </p>
          )}
        </div>
        <Link
          href={`/admin/events/${event.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          관리하기
        </Link>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black uppercase text-slate-500">Event Code</p>
          <p className="mt-1 break-all font-black text-slate-950">
            {event.event_code}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black uppercase text-slate-500">Venue</p>
          <p className="mt-1 font-bold text-slate-950">
            {event.venue ?? "미정"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black uppercase text-slate-500">Start</p>
          <p className="mt-1 font-bold text-slate-950">
            {formatDateTime(event.starts_at)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-black uppercase text-slate-500">End</p>
          <p className="mt-1 font-bold text-slate-950">
            {formatDateTime(event.ends_at)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs font-bold text-slate-500">
        생성일: {formatDate(event.created_at)}
      </p>
    </article>
  );
}

export default async function AdminEventsPage() {
  const admin = await requireAdmin();
  const events = await getAdminAccessibleEvents(admin);

  return (
    <AdminShell
      title="행사 관리"
      description="운영 권한이 있는 행사를 만들고, 현장 송출과 참가자 입장에 필요한 기본 정보를 관리합니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-950">
                행사 목록
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                super_admin은 전체 행사를, 행사별 관리자는 배정된 행사만 볼 수
                있습니다.
              </p>
            </div>
            <Link
              href="/admin/events/new"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              새 행사 만들기
            </Link>
          </div>

          {events.length > 0 ? (
            <div className="grid gap-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <AdminPanel title="행사 목록">
              <EmptyState
                title="접근 가능한 행사가 없습니다."
                description="새 행사를 만들거나, 기존 행사에 관리자 권한을 배정하면 이곳에 표시됩니다."
              />
            </AdminPanel>
          )}
        </section>

        <AdminPanel
          title="운영 안내"
          description="행사 생성 후 개요 화면에서 참가자 URL, 스크린 URL, 하위 운영 메뉴로 이동할 수 있습니다."
        >
          <div className="grid gap-3 text-sm leading-6 text-slate-600">
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              행사 삭제는 아직 제공하지 않습니다. 운영 중 실수를 줄이기 위해
              비활성 상태로 전환하는 방식부터 사용합니다.
            </p>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              참가자 등록, 문제 CRUD, 라이브 진행, Q&A, 추첨 기능은 다음
              단계에서 연결합니다.
            </p>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
