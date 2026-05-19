import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  OperatorLink,
  StatusBadge,
} from "@/components/quiz/ui";
import { requireEventAccess } from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type EventDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

type LiveStateSummary = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

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

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-events] Failed to load count.", {
      table,
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getQuestionCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("event_id", eventId);

  if (sessionsError) {
    console.error("[admin-events] Failed to load quiz sessions for count.", {
      eventId,
      message: sessionsError.message,
      code: sessionsError.code,
    });

    return 0;
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);

  if (sessionIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds);

  if (error) {
    console.error("[admin-events] Failed to load question count.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getLiveState(eventId: string): Promise<LiveStateSummary | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("mode, screen_scene, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-events] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as LiveStateSummary | null;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-all text-base font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId);

  const [
    participantCount,
    questionCount,
    answerCount,
    qnaCount,
    winnerCount,
    liveState,
  ] = await Promise.all([
    getExactCount("participants", eventId),
    getQuestionCount(eventId),
    getExactCount("answers", eventId),
    getExactCount("qna_questions", eventId),
    getExactCount("draw_winners", eventId),
    getLiveState(eventId),
  ]);

  return (
    <AdminShell
      title="행사 개요"
      description="행사 기본 정보, 운영 상태, 참가자와 스크린 접속 주소를 한 화면에서 확인합니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <AdminPanel title={event.title} description={event.subtitle ?? undefined}>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={(event.is_active ?? true) ? "green" : "amber"}>
                {(event.is_active ?? true) ? "활성" : "비활성"}
              </StatusBadge>
              <StatusBadge tone="cyan">{event.event_code}</StatusBadge>
              <StatusBadge tone="slate">
                live: {liveState?.mode ?? "waiting"}
              </StatusBadge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailRow label="장소" value={event.venue ?? "미정"} />
              <DetailRow label="대표 색상" value={event.primary_color ?? "#0f172a"} />
              <DetailRow label="시작" value={formatDateTime(event.starts_at)} />
              <DetailRow label="종료" value={formatDateTime(event.ends_at)} />
              <DetailRow label="참가자 URL" value={`/e/${event.event_code}`} />
              <DetailRow label="스크린 URL" value={`/screen/${event.event_code}`} />
            </div>

            {event.screen_notice && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-sm font-black uppercase text-cyan-700">
                  Screen Notice
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-cyan-950">
                  {event.screen_notice}
                </p>
              </div>
            )}
          </AdminPanel>

          <AdminPanel
            title="운영 지표"
            description="아직 기능 연결 전인 영역도 현재 DB에 있는 데이터 기준으로 집계합니다."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="참가자" value={participantCount} />
              <StatCard label="문제" value={questionCount} />
              <StatCard label="응답" value={answerCount} />
              <StatCard label="Q&A" value={qnaCount} />
              <StatCard label="당첨자" value={winnerCount} />
            </div>
          </AdminPanel>

          <div className="grid gap-4 md:grid-cols-2">
            <OperatorLink
              href={`/admin/events/${eventId}/questions`}
              title="문제 관리"
              description="문항과 선택지를 준비하는 화면입니다. CRUD 기능은 다음 단계에서 연결합니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/live`}
              title="라이브 진행"
              description="문제 시작, 정답 공개, 결과 송출을 운영할 화면입니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/draw`}
              title="추첨"
              description="참가자 또는 정답자 기준 추첨을 진행할 화면입니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/qna`}
              title="Q&A"
              description="참가자 질문을 승인하고 송출 후보로 관리할 화면입니다."
            />
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <AdminPanel title="설정">
            <Link
              href={`/admin/events/${eventId}/settings`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              행사 설정 수정
            </Link>
          </AdminPanel>

          <AdminPanel title="라이브 상태">
            <div className="grid gap-3 text-sm font-bold text-slate-700">
              <DetailRow label="Mode" value={liveState?.mode ?? "waiting"} />
              <DetailRow
                label="Screen Scene"
                value={liveState?.screen_scene ?? "미지정"}
              />
              <DetailRow
                label="Updated"
                value={formatDateTime(liveState?.updated_at ?? null)}
              />
            </div>
          </AdminPanel>

          <AdminPanel
            title="주소 안내"
            description="복사 버튼은 아직 더미 단계입니다. 현재는 주소를 직접 선택해서 사용할 수 있습니다."
          >
            <div className="grid gap-3">
              <DetailRow
                label="참가자 QR URL"
                value={`/e/${event.event_code}`}
              />
              <DetailRow
                label="참가자 등록 URL"
                value={`/e/${event.event_code}/join`}
              />
              <DetailRow
                label="참가자 참여 URL"
                value={`/e/${event.event_code}/play`}
              />
              <DetailRow
                label="스크린 URL"
                value={`/screen/${event.event_code}`}
              />
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-950">
                실제 전체 주소는 배포 후 Vercel 도메인을 기준으로 결정됩니다.
              </p>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}
