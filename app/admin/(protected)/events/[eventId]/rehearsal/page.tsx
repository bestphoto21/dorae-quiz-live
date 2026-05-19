import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminPanel, AdminShell, StatusBadge } from "@/components/quiz/ui";
import {
  canViewRehearsalByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import ChecklistClient from "./ChecklistClient";

type RehearsalPageProps = {
  params: Promise<{ eventId: string }>;
};

type QuizSessionRow = {
  id: string;
  title: string;
  status: string;
};

type LiveStateRow = {
  mode: string;
  screen_scene: string | null;
  current_question_id: string | null;
  reveal_answer: boolean;
  show_results: boolean;
  updated_at: string | null;
};

type QnaStatus = "pending" | "approved" | "hidden" | "deleted";

type RehearsalStatus = "ok" | "warn" | "danger";

function formatDateTime(value: string | null) {
  if (!value) {
    return "없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function statusTone(status: RehearsalStatus) {
  if (status === "ok") {
    return "green";
  }

  if (status === "danger") {
    return "rose";
  }

  return "amber";
}

function statusLabel(status: RehearsalStatus) {
  if (status === "ok") {
    return "정상";
  }

  if (status === "danger") {
    return "위험";
  }

  return "주의";
}

function CheckCard({
  title,
  status,
  summary,
  children,
}: {
  title: string;
  status: RehearsalStatus;
  summary: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-950">{title}</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            {summary}
          </p>
        </div>
        <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>
      </div>
      {children && <div className="mt-5 grid gap-3">{children}</div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-all text-base font-black text-slate-950">
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
    </div>
  );
}

async function getParticipantSummary(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const [{ count, error: countError }, { data: recent, error: recentError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId),
      supabase
        .from("participants")
        .select("joined_at")
        .eq("event_id", eventId)
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (countError) {
    console.error("[rehearsal] Failed to count participants.", {
      eventId,
      message: countError.message,
      code: countError.code,
    });
  }

  if (recentError) {
    console.error("[rehearsal] Failed to load recent participant.", {
      eventId,
      message: recentError.message,
      code: recentError.code,
    });
  }

  return {
    count: count ?? 0,
    recentJoinedAt: (recent?.joined_at as string | null | undefined) ?? null,
  };
}

async function getQuizSummary(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("id, title, status")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (sessionsError) {
    console.error("[rehearsal] Failed to load quiz sessions.", {
      eventId,
      message: sessionsError.message,
      code: sessionsError.code,
    });
  }

  const sessions = (sessionsData ?? []) as QuizSessionRow[];
  const sessionIds = sessions.map((session) => session.id);

  if (sessionIds.length === 0) {
    return {
      sessionCount: 0,
      questionCount: 0,
      hasReadySession: false,
      emptySessionCount: 0,
    };
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select("id, session_id")
    .in("session_id", sessionIds);

  if (questionsError) {
    console.error("[rehearsal] Failed to load question summary.", {
      eventId,
      message: questionsError.message,
      code: questionsError.code,
    });
  }

  const questionCounts = new Map<string, number>();

  for (const question of questionsData ?? []) {
    const sessionId = question.session_id as string;
    questionCounts.set(sessionId, (questionCounts.get(sessionId) ?? 0) + 1);
  }

  return {
    sessionCount: sessions.length,
    questionCount: questionsData?.length ?? 0,
    hasReadySession: sessions.some((session) =>
      ["ready", "live"].includes(session.status)
    ),
    emptySessionCount: sessions.filter(
      (session) => (questionCounts.get(session.id) ?? 0) === 0
    ).length,
  };
}

async function getQnaSummary(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qna_questions")
    .select("status")
    .eq("event_id", eventId);

  if (error) {
    console.error("[rehearsal] Failed to load Q&A summary.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  const counts: Record<QnaStatus, number> = {
    pending: 0,
    approved: 0,
    hidden: 0,
    deleted: 0,
  };

  for (const item of data ?? []) {
    const status = item.status as QnaStatus;

    if (status in counts) {
      counts[status] += 1;
    }
  }

  return {
    total: data?.length ?? 0,
    ...counts,
  };
}

async function getDrawSummary(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const [prizesResult, winnersResult] = await Promise.all([
    supabase
      .from("prizes")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("draw_winners")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);

  if (prizesResult.error) {
    console.error("[rehearsal] Failed to count prizes.", {
      eventId,
      message: prizesResult.error.message,
      code: prizesResult.error.code,
    });
  }

  if (winnersResult.error) {
    console.error("[rehearsal] Failed to count draw winners.", {
      eventId,
      message: winnersResult.error.message,
      code: winnersResult.error.code,
    });
  }

  return {
    prizeCount: prizesResult.count ?? 0,
    winnerCount: winnersResult.count ?? 0,
  };
}

async function getLiveState(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select(
      "mode, screen_scene, current_question_id, reveal_answer, show_results, updated_at"
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[rehearsal] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as LiveStateRow | null;
}

export default async function RehearsalPage({ params }: RehearsalPageProps) {
  const { eventId } = await params;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canViewRehearsalByRole(role)) {
    redirect("/admin/events");
  }

  const [participants, quiz, qna, draw, liveState] = await Promise.all([
    getParticipantSummary(eventId),
    getQuizSummary(eventId),
    getQnaSummary(eventId),
    getDrawSummary(eventId),
    getLiveState(eventId),
  ]);
  const participantUrl = `/e/${event.event_code}`;
  const screenUrl = `/screen/${event.event_code}`;
  const liveUrl = `/admin/events/${eventId}/live`;

  return (
    <AdminShell
      title="리허설 체크"
      description="행사 전날 또는 당일 아침에 운영 준비 상태를 한 화면에서 확인합니다."
    >
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CheckCard
            title="행사 기본 상태"
            status={event.event_code && event.is_active !== false ? "ok" : "warn"}
            summary={
              event.is_active === false
                ? "행사가 비활성 상태입니다. 참가자 입장을 막을 예정인 상태입니다."
                : "행사 코드와 활성 상태를 확인했습니다."
            }
          >
            <Metric label="행사명" value={event.title} />
            <Metric label="event_code" value={event.event_code || "없음"} />
            <Metric
              label="활성 상태"
              value={event.is_active === false ? "비활성" : "활성"}
            />
          </CheckCard>

          <CheckCard
            title="참가자 등록 상태"
            status={participants.count > 0 ? "ok" : "warn"}
            summary={
              participants.count > 0
                ? "등록된 참가자가 있습니다."
                : "아직 등록된 참가자가 없습니다."
            }
          >
            <Metric label="전체 참가자" value={participants.count} />
            <Metric
              label="최근 등록"
              value={formatDateTime(participants.recentJoinedAt)}
            />
          </CheckCard>

          <CheckCard
            title="퀴즈 준비 상태"
            status={
              quiz.questionCount === 0 || quiz.emptySessionCount > 0
                ? "warn"
                : "ok"
            }
            summary={
              quiz.questionCount === 0
                ? "등록된 문제가 없습니다."
                : quiz.emptySessionCount > 0
                  ? "문제가 없는 세션이 있습니다."
                  : "퀴즈 세션과 문제가 준비되어 있습니다."
            }
          >
            <Metric label="세션 수" value={quiz.sessionCount} />
            <Metric label="문제 수" value={quiz.questionCount} />
            <Metric
              label="준비/라이브 세션"
              value={quiz.hasReadySession ? "있음" : "없음"}
            />
          </CheckCard>

          <CheckCard
            title="Q&A 준비 상태"
            status={qna.pending > 0 ? "warn" : "ok"}
            summary={
              qna.pending > 0
                ? "검수해야 할 질문이 있습니다."
                : "검수 대기 질문이 없습니다."
            }
          >
            <Metric label="전체 질문" value={qna.total} />
            <Metric label="검수 대기" value={qna.pending} />
            <Metric label="승인됨" value={qna.approved} />
            <Metric label="숨김/삭제" value={qna.hidden + qna.deleted} />
            <Link
              href={`/admin/events/${eventId}/qna`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-cyan-600 bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm"
            >
              Q&A 검수하기
            </Link>
          </CheckCard>

          <CheckCard
            title="럭키드로우 준비 상태"
            status={draw.prizeCount > 0 ? "ok" : "warn"}
            summary={
              draw.prizeCount > 0
                ? "경품이 등록되어 있습니다."
                : "등록된 경품이 없습니다."
            }
          >
            <Metric label="경품 수" value={draw.prizeCount} />
            <Metric label="당첨자 수" value={draw.winnerCount} />
            <Metric
              label="기존 당첨 이력"
              value={draw.winnerCount > 0 ? "있음" : "없음"}
            />
            <Link
              href={`/admin/events/${eventId}/draw`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm"
            >
              럭키드로우 관리
            </Link>
          </CheckCard>

          <CheckCard
            title="스크린 송출 상태"
            status={liveState ? "ok" : "warn"}
            summary="원본 payload는 표시하지 않고 안전한 상태 요약만 보여줍니다."
          >
            <Metric label="mode" value={liveState?.mode ?? "waiting"} />
            <Metric
              label="screen_scene"
              value={liveState?.screen_scene ?? "미지정"}
            />
            <Metric
              label="현재 문제"
              value={liveState?.current_question_id ? "선택됨" : "없음"}
            />
            <Metric
              label="정답 공개"
              value={liveState?.reveal_answer ? "공개" : "비공개"}
            />
            <Metric
              label="결과 표시"
              value={liveState?.show_results ? "표시" : "숨김"}
            />
          </CheckCard>
        </div>

        <AdminPanel
          title="현장 바로가기"
          description="리허설 중 가장 자주 여는 화면입니다."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href={screenUrl}
              target="_blank"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
            >
              스크린 열기
            </Link>
            <Link
              href={liveUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-cyan-600 bg-cyan-600 px-5 py-3 text-base font-black text-white shadow-sm"
            >
              라이브 콘솔로 이동
            </Link>
            <Link
              href={participantUrl}
              target="_blank"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-800 shadow-sm"
            >
              참가자 입장 확인
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="참가자 입장 URL" value={participantUrl} />
            <Metric label="스크린 URL" value={screenUrl} />
            <Metric label="라이브 콘솔 URL" value={liveUrl} />
          </div>
        </AdminPanel>

        <ChecklistClient eventId={eventId} />
      </div>
    </AdminShell>
  );
}
