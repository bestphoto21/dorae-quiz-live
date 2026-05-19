import Link from "next/link";
import { AdminPanel, AdminShell, EmptyState, StatusBadge } from "@/components/quiz/ui";
import {
  canOperateLiveScreenByRole,
  canOperateLiveByRole,
  canSetQnaScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getQuestionsForSession,
  getQuizSessionsForEvent,
  type QuestionRecord,
  type QuizSessionRecord,
} from "@/lib/data/quiz";
import {
  emptyAnswerStats,
  getAnswerStatsForQuestion,
} from "@/lib/data/answer-stats";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  closeQuestion,
  revealQuestionAnswer,
  setBreakMode,
  setLuckyDrawMode,
  setQnaWaitingMode,
  setWaitingMode,
  showResultMode,
  startQuestion,
} from "./actions";

type LivePageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    sessionId?: string | string[];
    message?: string | string[];
    error?: string | string[];
  }>;
};

type LiveStateRecord = {
  current_session_id: string | null;
  current_question_id: string | null;
  mode: "waiting" | "question" | "closed" | "result" | "draw" | "qna";
  question_started_at: string | null;
  question_ends_at: string | null;
  reveal_answer: boolean;
  show_results: boolean;
  screen_scene: string | null;
  updated_at: string | null;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

function modeTone(mode: LiveStateRecord["mode"]) {
  if (mode === "question") {
    return "cyan";
  }

  if (mode === "result") {
    return "green";
  }

  if (mode === "closed") {
    return "amber";
  }

  return "slate";
}

function modeLabel(mode: LiveStateRecord["mode"] | null | undefined) {
  const labels: Record<LiveStateRecord["mode"], string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
  };

  return labels[mode ?? "waiting"];
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    question: "퀴즈 문제 화면",
    closed: "응답 마감 화면",
    result: "결과 화면",
    qna: "Q&A 대기 화면",
    qna_waiting: "Q&A 대기 화면",
    qna_question: "승인 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    draw_winner: "당첨자 발표 화면",
  };

  return labels[scene ?? "waiting"] ?? "대기 화면";
}

async function getLiveState(eventId: string): Promise<LiveStateRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select(
      `
        current_session_id,
        current_question_id,
        mode,
        question_started_at,
        question_ends_at,
        reveal_answer,
        show_results,
        screen_scene,
        updated_at
      `
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-live] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as LiveStateRecord | null;
}

function StateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-700">{label}</p>
      <p className="mt-2 break-all text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

function sceneDescription(liveState: LiveStateRecord | null) {
  const scene = liveState?.screen_scene ?? liveState?.mode ?? "waiting";

  if (scene === "question") {
    return "퀴즈 문제가 참가자와 스크린에 표시되는 중입니다.";
  }

  if (scene === "closed") {
    return "응답 마감 화면이 송출 중입니다.";
  }

  if (scene === "result") {
    return liveState?.reveal_answer
      ? "정답 공개 화면이 송출 중입니다."
      : "결과 화면이 송출 중입니다.";
  }

  if (scene === "qna_question") {
    return "관리자가 승인한 Q&A 질문이 스크린에 송출 중입니다.";
  }

  if (scene === "qna_waiting" || scene === "qna") {
    return "Q&A 질문 접수 대기 화면이 송출 중입니다.";
  }

  if (scene === "draw_winner") {
    return "럭키드로우 당첨자 발표 화면이 송출 중입니다.";
  }

  if (scene === "draw") {
    return "럭키드로우 준비 화면이 송출 중입니다.";
  }

  if (scene === "break") {
    return "휴식 화면이 송출 중입니다.";
  }

  return "대기 화면이 송출 중입니다.";
}

function broadcastStatus(liveState: LiveStateRecord | null) {
  const scene = liveState?.screen_scene ?? liveState?.mode ?? "waiting";

  return {
    quiz:
      scene === "question"
        ? "문제 송출 중"
        : scene === "closed"
          ? "응답 마감"
          : scene === "result"
            ? "결과 화면"
            : "대기",
    qna:
      scene === "qna_question"
        ? "승인 질문 송출 중"
        : scene === "qna_waiting" || scene === "qna"
          ? "Q&A 대기"
          : "꺼짐",
    draw:
      scene === "draw_winner"
        ? "당첨자 발표 중"
        : scene === "draw"
          ? "추첨 준비"
          : "꺼짐",
  };
}

function SessionSelector({
  eventId,
  sessions,
  selectedSession,
}: {
  eventId: string;
  sessions: QuizSessionRecord[];
  selectedSession: QuizSessionRecord | null;
}) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        title="퀴즈 세션이 없습니다."
        description="문제 관리 화면에서 세션과 문제를 먼저 만들어 주세요."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/admin/events/${eventId}/live?sessionId=${session.id}`}
          className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:border-slate-950 ${
            selectedSession?.id === session.id
              ? "border-slate-950"
              : "border-slate-200"
          }`}
        >
          <p className="text-base font-black text-slate-950">{session.title}</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            상태: {session.status}
          </p>
        </Link>
      ))}
    </div>
  );
}

function ControlButton({
  action,
  children,
  tone = "dark",
  sessionId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: string;
  tone?: "dark" | "cyan" | "amber" | "rose";
  sessionId?: string | null;
}) {
  const classes = {
    dark: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
    cyan: "border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800",
    amber: "border-amber-500 bg-amber-400 text-slate-950 hover:bg-amber-300",
    rose: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <form action={action}>
      {sessionId && <input type="hidden" name="session_id" value={sessionId} />}
      <button
        type="submit"
        className={`min-h-12 w-full rounded-2xl border px-5 py-3 text-base font-black shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${classes[tone]}`}
      >
        {children}
      </button>
    </form>
  );
}

function QuestionStartCard({
  eventId,
  sessionId,
  question,
  isCurrent,
  canOperate,
}: {
  eventId: string;
  sessionId: string;
  question: QuestionRecord;
  isCurrent: boolean;
  canOperate: boolean;
}) {
  const startAction = startQuestion.bind(null, eventId);

  return (
    <article
      className={`rounded-3xl border bg-white p-5 shadow-sm ${
        isCurrent ? "border-cyan-500" : "border-slate-200"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={isCurrent ? "cyan" : "slate"}>
              #{question.order_index}
            </StatusBadge>
            <StatusBadge tone={question.is_active ?? true ? "green" : "amber"}>
              {question.is_active ?? true ? "활성" : "비활성"}
            </StatusBadge>
            <StatusBadge tone="slate">{question.time_limit_seconds}초</StatusBadge>
          </div>
          <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">
            {question.question_text}
          </h3>
          {isCurrent && (
            <p className="mt-2 text-sm font-black text-cyan-700">
              현재 송출 중인 문제입니다.
            </p>
          )}
        </div>

        {canOperate && (
          <form action={startAction} className="min-w-40">
            <input type="hidden" name="session_id" value={sessionId} />
            <input type="hidden" name="question_id" value={question.id} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-2xl border border-cyan-700 bg-cyan-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-800"
            >
              이 문제 시작
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

export default async function LivePage({ params, searchParams }: LivePageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canOperate = canOperateLiveByRole(role);
  const canOperateScreen = canOperateLiveScreenByRole(role);
  const canSetQnaScreen = canSetQnaScreenByRole(role);
  const canUseAnyScreenAction = canOperateScreen || canSetQnaScreen;
  const [liveState, sessions] = await Promise.all([
    getLiveState(eventId),
    getQuizSessionsForEvent(eventId),
  ]);
  const selectedSessionId =
    getSingle(query.sessionId) ?? liveState?.current_session_id ?? undefined;
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ??
    sessions[0] ??
    null;
  const currentSession =
    sessions.find((session) => session.id === liveState?.current_session_id) ??
    null;
  const questions = selectedSession
    ? await getQuestionsForSession(selectedSession.id)
    : [];
  const currentQuestion =
    currentSession?.id === selectedSession?.id
      ? questions.find((question) => question.id === liveState?.current_question_id) ??
        null
      : null;
  const answerStats = liveState?.current_question_id
    ? await getAnswerStatsForQuestion(
        liveState.current_question_id,
        liveState.reveal_answer
      )
    : emptyAnswerStats();
  const waitingAction = setWaitingMode.bind(null, eventId);
  const qnaWaitingAction = setQnaWaitingMode.bind(null, eventId);
  const breakAction = setBreakMode.bind(null, eventId);
  const luckyDrawAction = setLuckyDrawMode.bind(null, eventId);
  const closeAction = closeQuestion.bind(null, eventId);
  const revealAction = revealQuestionAnswer.bind(null, eventId);
  const resultAction = showResultMode.bind(null, eventId);
  const message = getSingle(query.message);
  const error = getSingle(query.error);
  const status = broadcastStatus(liveState);
  const participantUrl = `/e/${event.event_code}`;
  const joinUrl = `/e/${event.event_code}/join`;
  const screenUrl = `/screen/${event.event_code}`;

  return (
    <AdminShell
      title="라이브 진행"
      description="문제를 선택해 현장 스크린의 대기, 문제, 마감, 정답 공개, 결과 화면을 제어합니다."
    >
      <div className="grid gap-5">
        <AdminPanel title={event.title} description={`행사 코드: ${event.event_code}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={modeTone(liveState?.mode ?? "waiting")}>
              현재 운영 모드: {modeLabel(liveState?.mode)}
            </StatusBadge>
            <StatusBadge tone="slate">
              현재 송출 화면: {sceneLabel(liveState?.screen_scene)}
            </StatusBadge>
            <StatusBadge
              tone={canOperate ? "green" : canUseAnyScreenAction ? "cyan" : "amber"}
            >
              {canOperate
                ? "라이브 제어 가능"
                : canUseAnyScreenAction
                  ? "일부 스크린 전환 가능"
                  : "조회 전용"}
            </StatusBadge>
          </div>

          {!canOperate && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              현재 역할은 퀴즈 진행 제어가 제한될 수 있습니다. Q&A moderator는
              Q&A 대기 화면 전환만 사용할 수 있습니다.
            </p>
          )}

          {message && (
            <p className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">
              {error}
            </p>
          )}
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <AdminPanel
            title="현재 송출 상태"
            description="지금 현장 스크린에 무엇이 나가는지 먼저 확인한 뒤 전환해 주세요."
          >
            <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
              <p className="text-sm font-black uppercase text-cyan-700">
                Live Output
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950">
                {sceneDescription(liveState)}
              </h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StateRow label="퀴즈" value={status.quiz} />
              <StateRow label="Q&A" value={status.qna} />
              <StateRow label="럭키드로우" value={status.draw} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <StateRow label="스크린 URL" value={screenUrl} />
              <StateRow label="참가자 입장 URL" value={participantUrl} />
              <StateRow label="참가자 등록 URL" value={joinUrl} />
              <StateRow
                label="정답 공개"
                value={liveState?.reveal_answer ? "정답 공개 중" : "정답 비공개"}
              />
            </div>
          </AdminPanel>

          <AdminPanel
            title="현장 링크"
            description="새 창으로 스크린을 열고, 참가자 QR에는 참가자 입장 URL을 사용합니다."
          >
            <div className="grid gap-3">
              <Link
                href={screenUrl}
                target="_blank"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
              >
                스크린 새 창 열기
              </Link>
              <Link
                href={participantUrl}
                target="_blank"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
              >
                참가자 입장 페이지 열기
              </Link>
              <Link
                href={`/admin/events/${eventId}/rehearsal`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
              >
                리허설 체크 열기
              </Link>
              <Link
                href={`/admin/events/${eventId}/logs`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
              >
                운영 로그 열기
              </Link>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-700">
                  QR에 넣을 URL
                </p>
                <p className="mt-2 break-all text-lg font-black text-slate-950">
                  {participantUrl}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                  배포 후에는 Vercel 도메인을 포함한 전체 URL로 교체해 주세요.
                </p>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="grid gap-5 xl:grid-cols-[24rem_1fr_22rem]">
          <section className="grid content-start gap-5">
            <AdminPanel title="세션 선택">
              <SessionSelector
                eventId={eventId}
                sessions={sessions}
                selectedSession={selectedSession}
              />
            </AdminPanel>
          </section>

          <section className="grid content-start gap-5">
            <AdminPanel
              title={selectedSession ? selectedSession.title : "문제 목록"}
              description="다른 문제를 시작하면 현재 스크린 송출 상태가 새 문제로 즉시 바뀝니다."
            >
              {selectedSession ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone="slate">
                    문제 {questions.length.toLocaleString("ko-KR")}개
                  </StatusBadge>
                  <Link
                    href={`/admin/events/${eventId}/questions?sessionId=${selectedSession.id}`}
                    className="inline-flex rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
                  >
                    문제 관리로 이동
                  </Link>
                </div>
              ) : (
                <EmptyState
                  title="선택된 세션이 없습니다."
                  description="먼저 문제 관리 화면에서 세션을 만들어 주세요."
                />
              )}
            </AdminPanel>

            {questions.length > 0 ? (
              <div className="grid gap-4">
                {questions.map((question) => (
                  <QuestionStartCard
                    key={question.id}
                    eventId={eventId}
                    sessionId={selectedSession?.id ?? ""}
                    question={question}
                    isCurrent={question.id === liveState?.current_question_id}
                    canOperate={canOperate}
                  />
                ))}
              </div>
            ) : (
              <AdminPanel title="문제 목록">
                <EmptyState
                  title="등록된 문제가 없습니다."
                  description="문제 관리 화면에서 문제를 만든 뒤 라이브 진행을 시작할 수 있습니다."
                />
              </AdminPanel>
            )}
          </section>

          <aside className="grid content-start gap-5">
            <AdminPanel title="현재 운영 상태">
              <div className="grid gap-3">
                <StateRow label="현재 세션" value={currentSession?.title ?? "없음"} />
                <StateRow
                  label="현재 문제"
                  value={
                    currentQuestion?.question_text ??
                    liveState?.current_question_id ??
                    "없음"
                  }
                />
                <StateRow
                  label="시작 시간"
                  value={formatDateTime(liveState?.question_started_at ?? null)}
                />
                <StateRow
                  label="종료 시간"
                  value={formatDateTime(liveState?.question_ends_at ?? null)}
                />
                <StateRow
                  label="정답 공개 상태"
                  value={liveState?.reveal_answer ? "정답 공개 중" : "정답 비공개"}
                />
                <StateRow
                  label="결과 표시 상태"
                  value={liveState?.show_results ? "결과 표시 중" : "결과 숨김"}
                />
              </div>
            </AdminPanel>

            <AdminPanel
              title="스크린 전환"
              description="질문, 정답, 당첨자를 노출하지 않는 안전한 기본 화면 전환입니다."
            >
              {canOperateScreen || canSetQnaScreen ? (
                <div className="grid gap-3">
                  {canOperateScreen && (
                    <>
                      <ControlButton action={waitingAction} tone="dark">
                        대기 화면 송출
                      </ControlButton>
                      <ControlButton action={breakAction} tone="amber">
                        휴식 화면 송출
                      </ControlButton>
                      <ControlButton action={luckyDrawAction} tone="dark">
                        럭키드로우 준비 화면 송출
                      </ControlButton>
                    </>
                  )}
                  {canSetQnaScreen && (
                    <ControlButton action={qnaWaitingAction} tone="cyan">
                      Q&A 대기 화면 송출
                    </ControlButton>
                  )}
                </div>
              ) : (
                    <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-800">
                  현재 역할은 스크린 상태를 조회할 수 있지만 변경할 수 없습니다.
                </p>
              )}
            </AdminPanel>

            <AdminPanel
              title="퀴즈 진행 제어"
              description="정답 공개 버튼은 스크린과 참가자 화면에 정답을 노출합니다."
            >
              {canOperate ? (
                <div className="grid gap-3">
                  <ControlButton
                    action={closeAction}
                    tone="amber"
                    sessionId={selectedSession?.id}
                  >
                    응답 마감
                  </ControlButton>
                  <ControlButton
                    action={revealAction}
                    tone="cyan"
                    sessionId={selectedSession?.id}
                  >
                    정답 공개
                  </ControlButton>
                  <ControlButton
                    action={resultAction}
                    tone="dark"
                    sessionId={selectedSession?.id}
                  >
                    결과 화면만 표시
                  </ControlButton>
                </div>
              ) : (
                  <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-800">
                  현재 역할은 퀴즈 문제 진행을 조회할 수 있지만 변경할 수 없습니다.
                </p>
              )}
            </AdminPanel>

            <AdminPanel title="응답 통계">
              <div className="grid gap-3">
                <StateRow
                  label="전체 응답"
                  value={answerStats.total_answers.toLocaleString("ko-KR")}
                />
                <StateRow
                  label="1번"
                  value={answerStats.option_counts["1"].toLocaleString("ko-KR")}
                />
                <StateRow
                  label="2번"
                  value={answerStats.option_counts["2"].toLocaleString("ko-KR")}
                />
                <StateRow
                  label="3번"
                  value={answerStats.option_counts["3"].toLocaleString("ko-KR")}
                />
                <StateRow
                  label="4번"
                  value={answerStats.option_counts["4"].toLocaleString("ko-KR")}
                />
                {typeof answerStats.correct_answers === "number" && (
                  <StateRow
                    label="정답자"
                    value={answerStats.correct_answers.toLocaleString("ko-KR")}
                  />
                )}
              </div>
            </AdminPanel>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
