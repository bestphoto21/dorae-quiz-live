import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canManageSurveysByRole,
  canModerateQnaByRole,
  canOperateDrawByRole,
  canOperateLiveScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getSurveyFormsForEvent,
  getSurveyRemainingSeconds,
  getSurveyRespondentDrawOptions,
  type SurveyFormSummary,
  type SurveyStatus,
} from "@/lib/data/surveys";
import { getPrizesForEvent } from "@/lib/data/draw";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminScreenStatusCard } from "../_components/AdminScreenStatusCard";
import { ConfirmSubmitButton } from "../_components/ConfirmSubmitButton";
import {
  closeSurveyFromOperations,
  replayLatestWinnerFromOperations,
  setBreakScreenFromOperations,
  setJoinQrScreenFromOperations,
  setLuckyDrawReadyScreenFromOperations,
  setSurveyStatusScreenFromOperations,
  setWaitingScreenFromOperations,
  showLatestApprovedQnaFromOperations,
  startSurveyFromOperations,
} from "./actions";

type OperationsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

type LiveStateSummary = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

type QnaRecentQuestion = {
  id: string;
  question_text: string;
  status: "pending" | "approved" | "hidden" | "deleted";
  created_at: string | null;
};

type QnaSummary = {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
  deleted: number;
  recent: QnaRecentQuestion[];
};

type RecentWinner = {
  id: string;
  participantDisplayName: string;
  prizeName: string;
  status: string;
  createdAt: string | null;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((numerator / denominator) * 100))}%`;
}

function countText(value: number) {
  return `${value.toLocaleString("ko-KR")}건`;
}

function statusLabel(status: SurveyStatus) {
  const labels: Record<SurveyStatus, string> = {
    draft: "작성 중",
    open: "진행 중",
    closed: "마감",
    archived: "보관",
  };

  return labels[status] ?? status;
}

function statusTone(status: SurveyStatus) {
  if (status === "open") {
    return "green";
  }

  if (status === "closed") {
    return "amber";
  }

  if (status === "archived") {
    return "rose";
  }

  return "slate";
}

function qnaStatusLabel(status: QnaRecentQuestion["status"]) {
  const labels: Record<QnaRecentQuestion["status"], string> = {
    pending: "검토 중",
    approved: "승인",
    hidden: "숨김",
    deleted: "삭제",
  };

  return labels[status] ?? status;
}

function qnaStatusTone(status: QnaRecentQuestion["status"]) {
  if (status === "approved") {
    return "green";
  }

  if (status === "pending") {
    return "amber";
  }

  return "slate";
}

function liveModeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
    survey: "설문",
  };

  return labels[mode ?? "waiting"] ?? mode ?? "대기";
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    join_qr: "QR 입장 안내",
    question: "퀴즈 문제",
    closed: "퀴즈 응답 마감",
    result: "퀴즈 결과",
    qna_waiting: "Q&A 접수",
    qna_question: "Q&A 질문 송출",
    draw: "럭키드로우 준비",
    draw_winner: "럭키드로우 당첨 발표",
    survey_active: "1분 설문 진행",
    survey_status: "설문 제출 현황",
    survey_closed: "설문 마감",
  };

  return labels[scene ?? "waiting"] ?? scene ?? "대기 화면";
}

function featureLabel(value: boolean | null | undefined) {
  return value ?? true ? "ON" : "OFF";
}

function featureTone(value: boolean | null | undefined) {
  return value ?? true ? "green" : "slate";
}

function ButtonLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-slate-100"
    >
      {children}
    </Link>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-700">{label}</p>
      <p className="mt-2 break-words text-2xl font-black text-[color:#0a1a38]">
        {value}
      </p>
    </div>
  );
}

function AlertMessage({
  tone,
  children,
}: {
  tone: "green" | "rose";
  children: string;
}) {
  const classes =
    tone === "green"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : "border-rose-300 bg-rose-50 text-rose-950";

  return (
    <div className={`rounded-2xl border p-4 text-sm font-black ${classes}`}>
      {children}
    </div>
  );
}

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-operations] Failed to load count.", {
      table,
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
    console.error("[admin-operations] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as LiveStateSummary | null;
}

async function getQnaSummary(eventId: string): Promise<QnaSummary> {
  const supabase = createAdminSupabaseClient();
  const [{ data: statusRows, error: statusError }, { data: recentRows, error: recentError }] =
    await Promise.all([
      supabase.from("qna_questions").select("status").eq("event_id", eventId),
      supabase
        .from("qna_questions")
        .select("id, question_text, status, created_at")
        .eq("event_id", eventId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (statusError) {
    console.error("[admin-operations] Failed to load Q&A counts.", {
      eventId,
      message: statusError.message,
      code: statusError.code,
    });
  }

  if (recentError) {
    console.error("[admin-operations] Failed to load recent Q&A.", {
      eventId,
      message: recentError.message,
      code: recentError.code,
    });
  }

  const summary: QnaSummary = {
    total: statusRows?.length ?? 0,
    pending: 0,
    approved: 0,
    hidden: 0,
    deleted: 0,
    recent: (recentRows ?? []) as QnaRecentQuestion[],
  };

  for (const row of statusRows ?? []) {
    const status = row.status as keyof Omit<QnaSummary, "total" | "recent">;

    if (status in summary) {
      summary[status] += 1;
    }
  }

  return summary;
}

async function getRecentDrawWinners(eventId: string): Promise<RecentWinner[]> {
  const supabase = createAdminSupabaseClient();
  const { data: winners, error } = await supabase
    .from("draw_winners")
    .select("id, prize_id, participant_id, status, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    console.error("[admin-operations] Failed to load recent draw winners.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  const rows = (winners ?? []) as Array<{
    id: string;
    prize_id: string | null;
    participant_id: string;
    status: string;
    created_at: string | null;
  }>;
  const prizeIds = Array.from(
    new Set(rows.map((row) => row.prize_id).filter(Boolean))
  ) as string[];
  const participantIds = Array.from(new Set(rows.map((row) => row.participant_id)));

  const [{ data: prizes }, { data: participants }] = await Promise.all([
    prizeIds.length > 0
      ? supabase.from("prizes").select("id, name").in("id", prizeIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase
          .from("participants")
          .select("id, name, display_name")
          .in("id", participantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const prizeMap = new Map(
    (prizes ?? []).map((prize) => [prize.id as string, prize.name as string])
  );
  const participantMap = new Map(
    (participants ?? []).map((participant) => [
      participant.id as string,
      String(participant.display_name || participant.name || "이름 미확인"),
    ])
  );

  return rows.map((winner) => ({
    id: winner.id,
    participantDisplayName:
      participantMap.get(winner.participant_id) ?? "이름 미확인",
    prizeName: winner.prize_id
      ? prizeMap.get(winner.prize_id) ?? "경품 미확인"
      : "경품 없음",
    status: winner.status,
    createdAt: winner.created_at,
  }));
}

function SurveyOperationCard({
  eventId,
  survey,
  participantCount,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  participantCount: number;
  canManage: boolean;
}) {
  const questionCount = survey.questions.length;
  const remainingSeconds =
    survey.status === "open" ? getSurveyRemainingSeconds(survey) : 0;
  const canStart =
    canManage && survey.status !== "open" && survey.status !== "archived" && questionCount > 0;
  const canClose = canManage && survey.status === "open";
  const canShowStatus =
    canManage && (survey.status === "open" || survey.status === "closed");

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-[color:#0a1a38]">
            {survey.title}
          </h3>
          {survey.description && (
            <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-slate-700">
              {survey.description}
            </p>
          )}
        </div>
        <StatusBadge tone={statusTone(survey.status)}>
          {statusLabel(survey.status)}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MetricCard label="질문" value={countText(questionCount)} />
        <MetricCard label="제출" value={countText(survey.response_count)} />
        <MetricCard label="제출률" value={formatPercent(survey.response_count, participantCount)} />
        <MetricCard
          label="남은 시간"
          value={survey.status === "open" ? `${remainingSeconds}초` : "-"}
        />
      </div>

      {questionCount === 0 && (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-black leading-6 text-amber-950">
          질문이 없는 설문은 시작할 수 없습니다. 설문 관리에서 질문을 먼저 추가하세요.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={startSurveyFromOperations.bind(null, eventId, survey.id)}>
          <ConfirmSubmitButton
            tone="dark"
            disabled={!canStart}
            pendingLabel="시작 중..."
            confirmMessage="1분 설문을 시작하고 스크린에 진행 화면을 송출합니다. 진행할까요?"
          >
            1분 설문 시작
          </ConfirmSubmitButton>
        </form>
        <form action={closeSurveyFromOperations.bind(null, eventId, survey.id)}>
          <ConfirmSubmitButton
            tone="amber"
            disabled={!canClose}
            pendingLabel="마감 중..."
            confirmMessage="설문을 마감합니다. 진행할까요?"
          >
            설문 마감
          </ConfirmSubmitButton>
        </form>
        <form
          action={setSurveyStatusScreenFromOperations.bind(
            null,
            eventId,
            survey.id
          )}
        >
          <ConfirmSubmitButton
            tone="outline"
            disabled={!canShowStatus}
            pendingLabel="송출 중..."
            confirmMessage="스크린에 설문 제출 현황을 송출합니다. 진행할까요?"
          >
            제출 현황 송출
          </ConfirmSubmitButton>
        </form>
      </div>
    </section>
  );
}

export default async function OperationsPage({
  params,
  searchParams,
}: OperationsPageProps) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canManageSurveys = canManageSurveysByRole(role);
  const canModerateQna = canModerateQnaByRole(role);
  const canOperateDraw = canOperateDrawByRole(role);
  const canOperateScreen = canOperateLiveScreenByRole(role);
  const eventCode = event.event_code?.trim() ?? "";
  const hasEventCode = eventCode.length > 0;
  const screenPath = hasEventCode ? `/screen/${eventCode}` : "#";
  const joinPath = hasEventCode ? `/e/${eventCode}/join` : "#";
  const playPath = hasEventCode ? `/e/${eventCode}/play` : "#";
  const participantHomePath = hasEventCode ? `/e/${eventCode}` : "#";
  const screenUrl = hasEventCode ? buildPublicUrl(screenPath) : "";
  const joinUrl = hasEventCode ? buildPublicUrl(joinPath) : "";
  const playUrl = hasEventCode ? buildPublicUrl(playPath) : "";
  const message = getSingle(resolvedSearchParams.message);
  const error = getSingle(resolvedSearchParams.error);

  const [
    liveState,
    participantCount,
    quizAnswerCount,
    surveyForms,
    surveyResponseCount,
    qna,
    prizes,
    drawWinnerCount,
    recentWinners,
    surveyDrawOptions,
  ] = await Promise.all([
    getLiveState(eventId),
    getExactCount("participants", eventId),
    getExactCount("answers", eventId),
    getSurveyFormsForEvent(eventId),
    getExactCount("survey_responses", eventId),
    getQnaSummary(eventId),
    getPrizesForEvent(eventId),
    getExactCount("draw_winners", eventId),
    getRecentDrawWinners(eventId),
    getSurveyRespondentDrawOptions(eventId),
  ]);
  const totalPrizeQuantity = prizes.reduce((sum, prize) => sum + prize.quantity, 0);
  const remainingPrizeQuantity = prizes.reduce((sum, prize) => sum + prize.remaining, 0);
  const activeWinnerCount = prizes.reduce(
    (sum, prize) => sum + prize.active_winner_count,
    0
  );
  const displaySurveys = surveyForms.slice(0, 5);
  const hasApprovedQna = qna.approved > 0;
  const hasRecentWinner = recentWinners.length > 0;
  const featureSettings = [
    { label: "퀴즈", value: event.participant_show_quiz },
    { label: "Q&A", value: event.participant_show_qna },
    { label: "설문", value: event.participant_show_survey },
    { label: "럭키드로우 안내", value: event.participant_show_draw },
  ];

  return (
    <AdminShell
      title="통합 운영 콘솔"
      description="행사 중 자주 사용하는 화면 송출, 설문, Q&A, 럭키드로우 기능을 한 화면에서 제어합니다."
    >
      <div className="grid gap-5">
        {message && <AlertMessage tone="green">{message}</AlertMessage>}
        {error && <AlertMessage tone="rose">{error}</AlertMessage>}

        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="grid gap-4">
            <AdminScreenStatusCard
              mode={liveState?.mode}
              screenScene={liveState?.screen_scene}
              updatedAt={liveState?.updated_at}
              screenUrl={screenUrl || screenPath}
              eventCode={eventCode || "event_code 없음"}
            />
            <AdminPanel
              title="현장 운영 안내"
              description="마지막으로 누른 송출 버튼이 현재 스크린 화면입니다. 세부 설정과 위험한 작업은 기존 개별 관리 페이지에서 진행하세요."
            >
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard label="현재 모드" value={liveModeLabel(liveState?.mode)} />
                <MetricCard
                  label="현재 화면"
                  value={sceneLabel(liveState?.screen_scene)}
                />
                <MetricCard
                  label="마지막 변경"
                  value={formatDateTime(liveState?.updated_at)}
                />
              </div>
            </AdminPanel>
          </div>

          <AdminPanel
            title="운영 URL"
            description="현장 장비와 참가자 휴대폰에서 열어볼 주소입니다."
          >
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-700">event_code</p>
                <p className="mt-2 break-all text-xl font-black text-[color:#0a1a38]">
                  {eventCode || "없음"}
                </p>
              </div>
              <ButtonLink href={screenPath} external={hasEventCode}>
                스크린 열기
              </ButtonLink>
              <ButtonLink href={joinPath} external={hasEventCode}>
                참가자 입장
              </ButtonLink>
              <ButtonLink href={playPath} external={hasEventCode}>
                참가자 플레이
              </ButtonLink>
              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-700">
                <p className="break-all">스크린: {screenUrl || "행사 코드 없음"}</p>
                <p className="mt-2 break-all">입장: {joinUrl || "행사 코드 없음"}</p>
                <p className="mt-2 break-all">플레이: {playUrl || "행사 코드 없음"}</p>
              </div>
            </div>
          </AdminPanel>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminPanel
            title="빠른 화면 송출"
            description="대기, 휴식, QR 입장 안내처럼 현장에서 자주 전환하는 화면입니다."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <form action={setWaitingScreenFromOperations.bind(null, eventId)}>
                <ConfirmSubmitButton
                  fullWidth
                  disabled={!canOperateScreen}
                  pendingLabel="송출 중..."
                  confirmMessage="스크린을 대기 화면으로 전환합니다. 진행할까요?"
                >
                  대기 화면 송출
                </ConfirmSubmitButton>
              </form>
              <form action={setBreakScreenFromOperations.bind(null, eventId)}>
                <ConfirmSubmitButton
                  fullWidth
                  tone="amber"
                  disabled={!canOperateScreen}
                  pendingLabel="송출 중..."
                  confirmMessage="스크린을 휴식 화면으로 전환합니다. 진행할까요?"
                >
                  휴식 화면 송출
                </ConfirmSubmitButton>
              </form>
              <form action={setJoinQrScreenFromOperations.bind(null, eventId)}>
                <ConfirmSubmitButton
                  fullWidth
                  tone="outline"
                  disabled={!canOperateScreen || !hasEventCode}
                  pendingLabel="송출 중..."
                  confirmMessage="스크린에 QR 입장 안내를 송출합니다. 진행할까요?"
                >
                  QR 입장 안내 송출
                </ConfirmSubmitButton>
              </form>
              <ButtonLink href={screenPath} external={hasEventCode}>
                스크린 열기
              </ButtonLink>
            </div>
          </AdminPanel>

          <AdminPanel
            title="참가자 현황"
            description="개인별 정보 없이 운영에 필요한 카운트만 표시합니다."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="입장 참가자" value={countText(participantCount)} />
              <MetricCard label="설문 제출" value={countText(surveyResponseCount)} />
              <MetricCard label="퀴즈 답변" value={countText(quizAnswerCount)} />
              <MetricCard label="Q&A 질문" value={countText(qna.total)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {featureSettings.map((feature) => (
                <StatusBadge key={feature.label} tone={featureTone(feature.value)}>
                  {feature.label} {featureLabel(feature.value)}
                </StatusBadge>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href={participantHomePath} external={hasEventCode}>
                참가자 화면 열기
              </ButtonLink>
              <ButtonLink href={`/admin/events/${eventId}/exports`}>
                결과 다운로드
              </ButtonLink>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="설문 운영"
          description="최근 설문 최대 5개를 표시합니다. 응답 상세와 개인별 제출자 정보는 이 화면에 표시하지 않습니다."
        >
          {displaySurveys.length === 0 ? (
            <div className="grid gap-4">
              <EmptyState
                title="설문이 없습니다"
                description="설문 관리에서 설문지를 먼저 생성한 뒤 통합 콘솔에서 시작할 수 있습니다."
              />
              <div>
                <ButtonLink href={`/admin/events/${eventId}/surveys`}>
                  설문 관리로 이동
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {displaySurveys.map((survey) => (
                <SurveyOperationCard
                  key={survey.id}
                  eventId={eventId}
                  survey={survey}
                  participantCount={participantCount}
                  canManage={canManageSurveys}
                />
              ))}
              {surveyForms.length > displaySurveys.length && (
                <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-black text-amber-950">
                  설문이 많아 최근 5개만 표시합니다. 전체 관리는 설문 관리에서 확인하세요.
                </p>
              )}
              <div>
                <ButtonLink href={`/admin/events/${eventId}/surveys`}>
                  설문 관리로 이동
                </ButtonLink>
              </div>
            </div>
          )}
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminPanel
            title="Q&A 운영"
            description="최근 질문은 내용과 상태만 표시합니다. 승인/숨김 같은 세부 관리는 Q&A 관리에서 진행하세요."
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <MetricCard label="전체" value={countText(qna.total)} />
              <MetricCard label="검토 중" value={countText(qna.pending)} />
              <MetricCard label="승인됨" value={countText(qna.approved)} />
              <MetricCard label="숨김/삭제" value={countText(qna.hidden + qna.deleted)} />
            </div>

            <div className="mt-5 grid gap-3">
              {qna.recent.length === 0 ? (
                <EmptyState
                  title="최근 Q&A가 없습니다"
                  description="참가자가 질문을 제출하면 이곳에 최근 질문이 표시됩니다."
                />
              ) : (
                qna.recent.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-2xl border border-slate-300 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge tone={qnaStatusTone(question.status)}>
                        {qnaStatusLabel(question.status)}
                      </StatusBadge>
                      <span className="text-xs font-bold text-slate-600">
                        {formatDateTime(question.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-black leading-6 text-[color:#0a1a38]">
                      {question.question_text}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <form action={showLatestApprovedQnaFromOperations.bind(null, eventId)}>
                <ConfirmSubmitButton
                  tone="outline"
                  disabled={!canModerateQna || !hasApprovedQna}
                  pendingLabel="송출 중..."
                  confirmMessage="최근 승인 Q&A 질문을 스크린에 송출합니다. 진행할까요?"
                >
                  최근 승인 질문 송출
                </ConfirmSubmitButton>
              </form>
              <ButtonLink href={`/admin/events/${eventId}/qna`}>
                Q&A 관리로 이동
              </ButtonLink>
            </div>
          </AdminPanel>

          <AdminPanel
            title="럭키드로우 운영"
            description="새 당첨자 추첨은 대상과 경품 선택을 분명히 하기 위해 럭키드로우 관리에서 진행합니다."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="경품 종류" value={countText(prizes.length)} />
              <MetricCard
                label="남은 경품"
                value={`${remainingPrizeQuantity.toLocaleString("ko-KR")}/${totalPrizeQuantity.toLocaleString("ko-KR")}개`}
              />
              <MetricCard label="활성 당첨" value={countText(activeWinnerCount)} />
              <MetricCard label="전체 당첨 기록" value={countText(drawWinnerCount)} />
              <MetricCard
                label="설문 제출자 추첨 가능 설문"
                value={countText(surveyDrawOptions.length)}
              />
              <MetricCard label="전체 참가자" value={countText(participantCount)} />
            </div>

            <div className="mt-5 grid gap-3">
              {hasRecentWinner ? (
                recentWinners.map((winner) => (
                  <div
                    key={winner.id}
                    className="rounded-2xl border border-slate-300 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-black text-[color:#0a1a38]">
                      {winner.participantDisplayName}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {winner.prizeName} · {winner.status} ·{" "}
                      {formatDateTime(winner.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="당첨 기록이 없습니다"
                  description="새 당첨자 추첨은 럭키드로우 관리 화면에서 진행하세요."
                />
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <form
                action={setLuckyDrawReadyScreenFromOperations.bind(null, eventId)}
              >
                <ConfirmSubmitButton
                  tone="amber"
                  disabled={!canOperateDraw}
                  pendingLabel="송출 중..."
                  confirmMessage="럭키드로우 준비 화면을 송출합니다. 진행할까요?"
                >
                  준비 화면 송출
                </ConfirmSubmitButton>
              </form>
              <form action={replayLatestWinnerFromOperations.bind(null, eventId)}>
                <ConfirmSubmitButton
                  tone="outline"
                  disabled={!canOperateDraw || !hasRecentWinner}
                  pendingLabel="송출 중..."
                  confirmMessage="최근 당첨 결과를 다시 송출합니다. 새 당첨자를 뽑는 동작은 아닙니다. 진행할까요?"
                >
                  최근 결과 재송출
                </ConfirmSubmitButton>
              </form>
              <ButtonLink href={`/admin/events/${eventId}/draw`}>
                럭키드로우 관리로 이동
              </ButtonLink>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="운영 바로가기"
          description="통합 콘솔에서 다루지 않는 세부 설정, 점검, 초기화, 다운로드 화면입니다."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ButtonLink href={`/admin/events/${eventId}/checklist`}>
              운영 체크리스트
            </ButtonLink>
            <ButtonLink href={`/admin/events/${eventId}/rehearsal`}>
              리허설 초기화
            </ButtonLink>
            <ButtonLink href={`/admin/events/${eventId}/exports`}>
              결과 다운로드
            </ButtonLink>
            <ButtonLink href={`/admin/events/${eventId}/settings`}>
              행사 설정
            </ButtonLink>
            <ButtonLink href={participantHomePath} external={hasEventCode}>
              참가자 화면
            </ButtonLink>
            <ButtonLink href={screenPath} external={hasEventCode}>
              스크린 화면
            </ButtonLink>
          </div>
        </AdminPanel>

        <AdminPanel
          title="개인정보 최소화"
          description="통합 콘솔은 운영 카운트와 최근 상태만 표시합니다. 전화번호, 이메일, participant_id, raw screen_payload, 설문 응답 상세는 표시하지 않습니다."
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="green">count 중심 조회</StatusBadge>
            <StatusBadge tone="green">응답 상세 미표시</StatusBadge>
            <StatusBadge tone="green">새 추첨 실행 미포함</StatusBadge>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
