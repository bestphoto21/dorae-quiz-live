import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canOperateDrawByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getDrawWinnersForEvent,
  getPrizesForEvent,
  type DrawWinnerSummary,
  type PrizeSummary,
} from "@/lib/data/draw";
import { getQuestionsForSession, getQuizSessionsForEvent } from "@/lib/data/quiz";
import {
  getSurveyRespondentDrawOptions,
  type SurveyRespondentDrawOption,
} from "@/lib/data/surveys";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  cancelWinner,
  createPrize,
  deletePrize,
  drawWinner,
  markWinnerClaimed,
  replayLatestWinnerOnScreen,
  redrawWinner,
  setBreakScreenFromDraw,
  setJoinQrScreenFromDraw,
  setLuckyDrawReadyScreenFromDraw,
  setWaitingScreenFromDraw,
  updatePrize,
} from "./actions";
import { DrawSubmitButton } from "./DrawSubmitButton";

type DrawPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

type DrawLiveState = {
  mode: string;
  screen_scene: string | null;
  screen_payload: Record<string, unknown> | null;
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

function sourceLabel(sourceType: string) {
  if (sourceType === "all_participants") {
    return "전체 참가자";
  }

  if (sourceType === "correct_answers") {
    return "정답자 전체";
  }

  if (sourceType === "question_correct_answers") {
    return "특정 문제 정답자";
  }

  if (sourceType === "survey_respondents") {
    return "설문 제출자";
  }

  return sourceType;
}

function modeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
  };

  return labels[mode ?? "waiting"] ?? "대기";
}

function statusTone(status: DrawWinnerSummary["status"]) {
  if (status === "claimed") {
    return "green";
  }

  if (status === "cancelled" || status === "redrawn") {
    return "rose";
  }

  return "amber";
}

function winnerStatusLabel(status: DrawWinnerSummary["status"]) {
  if (status === "claimed") {
    return "수령 완료";
  }

  if (status === "cancelled") {
    return "당첨 취소";
  }

  if (status === "redrawn") {
    return "재추첨 완료";
  }

  return "당첨 발표";
}

function sceneLabel(scene: string | null | undefined) {
  if (scene === "draw_winner") {
    return "당첨자 발표 화면";
  }

  if (scene === "draw") {
    return "럭키드로우 준비 화면";
  }

  if (scene === "join_qr") {
    return "QR 참여 안내 화면";
  }

  if (scene === "break") {
    return "휴식 화면";
  }

  if (scene === "qna_waiting" || scene === "qna") {
    return "Q&A 대기 화면";
  }

  if (scene === "question") {
    return "퀴즈 문제 화면";
  }

  if (scene === "result") {
    return "결과 화면";
  }

  return "대기 화면";
}

function drawPhaseLabel(phase: unknown) {
  if (phase === "rolling") {
    return "추첨 연출 중";
  }

  if (phase === "result") {
    return "당첨자 발표";
  }

  if (phase === "ready") {
    return "추첨 준비";
  }

  return "발표 대기";
}

async function getLiveState(eventId: string): Promise<DrawLiveState | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("mode, screen_scene, screen_payload, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-draw] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as DrawLiveState | null;
}

function SubmitButton({
  children,
  tone = "dark",
  disabled = false,
}: {
  children: string;
  tone?: "dark" | "cyan" | "amber" | "rose";
  disabled?: boolean;
}) {
  const classes = {
    dark: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    cyan: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    amber: "border-amber-500 bg-amber-400 text-[color:#0a1a38] hover:bg-amber-300",
    rose: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type="submit"
      disabled={disabled}
      className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 ${classes[tone]}`}
    >
      {children}
    </button>
  );
}

function ScreenControlButton({
  action,
  children,
  tone = "dark",
  disabled = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: string;
  tone?: "dark" | "cyan" | "amber" | "rose";
  disabled?: boolean;
}) {
  const classes = {
    dark: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    cyan: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    amber: "border-amber-500 bg-amber-400 text-[color:#0a1a38] hover:bg-amber-300",
    rose: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled}
        className={`min-h-11 w-full rounded-2xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 ${classes[tone]}`}
      >
        {children}
      </button>
    </form>
  );
}

function ScreenControlPanel({
  eventId,
  screenUrl,
  liveState,
  canOperate,
  hasLatestWinner,
}: {
  eventId: string;
  screenUrl: string;
  liveState: DrawLiveState | null;
  canOperate: boolean;
  hasLatestWinner: boolean;
}) {
  const waitingAction = setWaitingScreenFromDraw.bind(null, eventId);
  const joinQrAction = setJoinQrScreenFromDraw.bind(null, eventId);
  const breakAction = setBreakScreenFromDraw.bind(null, eventId);
  const readyAction = setLuckyDrawReadyScreenFromDraw.bind(null, eventId);
  const replayAction = replayLatestWinnerOnScreen.bind(null, eventId);

  return (
    <AdminPanel
      title="화면 제어"
      description="추첨 중에도 스크린을 대기, 휴식, QR, 준비, 최근 당첨 결과 화면으로 바로 전환합니다."
    >
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-black text-slate-700">현재 운영 모드</p>
            <p className="mt-1 text-sm font-bold text-[color:#0a1a38]">
              {modeLabel(liveState?.mode)}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-slate-700">현재 송출 화면</p>
            <p className="mt-1 text-sm font-bold text-[color:#0a1a38]">
              {sceneLabel(liveState?.screen_scene ?? liveState?.mode)}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-slate-700">마지막 변경</p>
            <p className="mt-1 text-sm font-bold text-[color:#0a1a38]">
              {formatDateTime(liveState?.updated_at ?? null)}
            </p>
          </div>
          <Link
            href={screenUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-slate-100"
          >
            스크린 열기
          </Link>
        </div>

        <div className="grid gap-2">
          <ScreenControlButton
            action={waitingAction}
            disabled={!canOperate}
          >
            대기 화면 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={joinQrAction}
            disabled={!canOperate}
          >
            QR 참여 안내 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={breakAction}
            tone="amber"
            disabled={!canOperate}
          >
            휴식 화면 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={readyAction}
            disabled={!canOperate}
          >
            럭키드로우 준비 화면 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={replayAction}
            tone="cyan"
            disabled={!canOperate || !hasLatestWinner}
          >
            최근 당첨 결과 다시 송출
          </ScreenControlButton>
          {!canOperate && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              현재 역할은 추첨 화면을 조회할 수 있지만 변경할 수 없습니다.
            </p>
          )}
          {canOperate && !hasLatestWinner && (
            <p className="rounded-2xl border border-slate-300 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-700">
              최근 당첨 결과가 생기면 다시 송출 버튼을 사용할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </AdminPanel>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="text-sm font-black text-[color:#0a1a38]">{children}</label>;
}

function TextInput({
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
    />
  );
}

function PrizeCard({
  eventId,
  prize,
  canOperate,
}: {
  eventId: string;
  prize: PrizeSummary;
  canOperate: boolean;
}) {
  const updateAction = updatePrize.bind(null, eventId, prize.id);
  const deleteAction = deletePrize.bind(null, eventId, prize.id);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-[color:#0a1a38]">{prize.name}</h3>
          <p className="mt-1 text-sm font-bold text-slate-700">
            생성: {formatDateTime(prize.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="cyan">수량 {prize.quantity}</StatusBadge>
          <StatusBadge tone={prize.remaining > 0 ? "green" : "amber"}>
            남은 수량 {prize.remaining}
          </StatusBadge>
          <StatusBadge tone="slate">당첨 이력 {prize.winner_count}</StatusBadge>
        </div>
      </div>

      <form action={updateAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_8rem_auto]">
        <TextInput name="name" defaultValue={prize.name} />
        <TextInput name="quantity" type="number" defaultValue={prize.quantity} />
        <SubmitButton disabled={!canOperate}>수정</SubmitButton>
      </form>

      <form action={deleteAction} className="mt-3">
        <SubmitButton tone="rose" disabled={!canOperate || prize.winner_count > 0}>
          삭제
        </SubmitButton>
        <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
          당첨자와 연결된 경품은 운영 실수 방지를 위해 삭제할 수 없습니다.
        </p>
      </form>
    </article>
  );
}

function PrizeCreateForm({
  eventId,
  canOperate,
}: {
  eventId: string;
  canOperate: boolean;
}) {
  const action = createPrize.bind(null, eventId);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_8rem_auto]">
      <div>
        <FieldLabel>경품명</FieldLabel>
        <div className="mt-2">
          <TextInput name="name" placeholder="예: 무선 이어폰" />
        </div>
      </div>
      <div>
        <FieldLabel>수량</FieldLabel>
        <div className="mt-2">
          <TextInput name="quantity" type="number" defaultValue={1} />
        </div>
      </div>
      <div className="flex items-end">
        <SubmitButton disabled={!canOperate}>경품 추가</SubmitButton>
      </div>
    </form>
  );
}

function DrawForm({
  eventId,
  prizes,
  sessions,
  questionGroups,
  surveyOptions,
  canOperate,
}: {
  eventId: string;
  prizes: PrizeSummary[];
  sessions: Awaited<ReturnType<typeof getQuizSessionsForEvent>>;
  questionGroups: Array<{
    sessionTitle: string;
    questions: Awaited<ReturnType<typeof getQuestionsForSession>>;
  }>;
  surveyOptions: SurveyRespondentDrawOption[];
  canOperate: boolean;
}) {
  const action = drawWinner.bind(null, eventId);
  const drawablePrizes = prizes.filter((prize) => prize.remaining > 0);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <FieldLabel>경품</FieldLabel>
          <select
            name="prize_id"
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            defaultValue=""
          >
            <option value="">경품 선택</option>
            {drawablePrizes.map((prize) => (
              <option key={prize.id} value={prize.id}>
                {prize.name} · 남은 수량 {prize.remaining}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>추첨 대상</FieldLabel>
          <select
            name="source_type"
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            defaultValue="all_participants"
          >
            <option value="all_participants">전체 참가자</option>
            <option value="correct_answers">정답자 전체</option>
            <option value="question_correct_answers">특정 문제 정답자</option>
            <option value="survey_respondents">설문 제출자</option>
          </select>
        </div>

        <div>
          <FieldLabel>세션 필터</FieldLabel>
          <select
            name="source_session_id"
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            defaultValue=""
          >
            <option value="">세션 전체</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
            정답자 전체 추첨에서만 세션 필터가 적용됩니다.
          </p>
        </div>

        <div>
          <FieldLabel>문제 선택</FieldLabel>
          <select
            name="source_question_id"
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            defaultValue=""
          >
            <option value="">문제 선택 없음</option>
            {questionGroups.map((group) =>
              group.questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {group.sessionTitle} · #{question.order_index} {question.question_text}
                </option>
              ))
            )}
          </select>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
            특정 문제 정답자 추첨에서는 문제 선택이 필수입니다.
          </p>
        </div>

        <div className="lg:col-span-2">
          <FieldLabel>설문 선택</FieldLabel>
          <select
            name="survey_form_id"
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            defaultValue=""
          >
            <option value="">설문 제출자 추첨 때 선택</option>
            {surveyOptions.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title} · 제출 {survey.response_count.toLocaleString("ko-KR")}명
                · {survey.status === "open" ? "진행 중" : "마감"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
            추첨 대상을 설문 제출자로 선택하면 해당 설문 제출자만 후보가 됩니다.
            응답 내용, 연락처, 이메일은 추첨 화면에 표시하지 않습니다.
          </p>
          {surveyOptions.length === 0 && (
            <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">
              제출자가 있는 진행 중 또는 마감 설문이 아직 없습니다.
            </p>
          )}
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-[color:#0a1a38]">
        <input
          type="checkbox"
          name="exclude_already_won"
          defaultChecked
          className="mt-1 size-4"
        />
        이미 당첨된 참가자 제외. 현재 DB 정책상 한 행사에서 같은 참가자는 상태와 관계없이 중복 당첨될 수 없습니다.
      </label>

      <div>
        <DrawSubmitButton disabled={!canOperate || drawablePrizes.length === 0} />
        <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
          추첨 대상이 설문 제출자인 경우 “설문 제출자 중 추첨 실행”으로 처리됩니다.
        </p>
      </div>
    </form>
  );
}

function WinnerActions({
  eventId,
  winner,
  canOperate,
}: {
  eventId: string;
  winner: DrawWinnerSummary;
  canOperate: boolean;
}) {
  const claimAction = markWinnerClaimed.bind(null, eventId, winner.id);
  const cancelAction = cancelWinner.bind(null, eventId, winner.id);
  const redrawAction = redrawWinner.bind(null, eventId, winner.id);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <form action={claimAction}>
        <SubmitButton tone="cyan" disabled={!canOperate || winner.status === "claimed"}>
          수령 완료
        </SubmitButton>
      </form>
      <form action={cancelAction}>
        <SubmitButton tone="rose" disabled={!canOperate || winner.status === "cancelled"}>
          당첨 취소
        </SubmitButton>
      </form>
      <form action={redrawAction}>
        <SubmitButton tone="amber" disabled={!canOperate}>
          재추첨
        </SubmitButton>
      </form>
    </div>
  );
}

function WinnerCard({
  eventId,
  winner,
  canOperate,
}: {
  eventId: string;
  winner: DrawWinnerSummary;
  canOperate: boolean;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-700">당첨자</p>
          <h3 className="mt-1 text-2xl font-black text-[color:#0a1a38]">
            {winner.participant_display_name}
          </h3>
          <p className="mt-2 text-sm font-bold text-slate-600">
            {winner.prize_name}
          </p>
        </div>
        <StatusBadge tone={statusTone(winner.status)}>
          {winnerStatusLabel(winner.status)}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-2 text-sm font-bold text-[color:#0a1a38]">
        <p>추첨 방식: {sourceLabel(winner.source_type)}</p>
        {winner.source_question_text && (
          <p className="line-clamp-2">문제: {winner.source_question_text}</p>
        )}
        <p>당첨 시각: {formatDateTime(winner.created_at)}</p>
        <p>수령 시각: {formatDateTime(winner.claimed_at)}</p>
      </div>

      <WinnerActions eventId={eventId} winner={winner} canOperate={canOperate} />
    </article>
  );
}

function ScreenStatePanel({ liveState }: { liveState: DrawLiveState | null }) {
  const payload = liveState?.screen_payload ?? {};
  const winnerName =
    typeof payload.participant_display_name === "string"
      ? payload.participant_display_name
      : null;
  const prizeName =
    typeof payload.prize_name === "string" ? payload.prize_name : null;
  const drawPhase = payload.draw_phase;

  return (
    <AdminPanel
      title="현재 스크린 발표 상태"
      description="추첨이 성공하면 저장된 당첨 결과를 기준으로 스크린 연출을 시작합니다."
    >
      <div className="grid gap-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black text-slate-700">현재 송출 화면</p>
          <p className="mt-2 text-sm font-bold text-[color:#0a1a38]">
            {sceneLabel(liveState?.screen_scene ?? liveState?.mode)}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-600">
            {drawPhaseLabel(drawPhase)}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-xs font-black text-cyan-900">발표 당첨자</p>
          <p className="mt-2 text-xl font-black text-cyan-950">
            {winnerName ?? "발표 대기"}
          </p>
          <p className="mt-1 text-sm font-bold text-cyan-800">
            {prizeName ?? "경품 없음"}
          </p>
        </div>
      </div>
    </AdminPanel>
  );
}

export default async function DrawPage({ params, searchParams }: DrawPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canOperate = canOperateDrawByRole(role);
  const [prizes, winners, sessions, liveState, surveyOptions] = await Promise.all([
    getPrizesForEvent(eventId),
    getDrawWinnersForEvent(eventId),
    getQuizSessionsForEvent(eventId),
    getLiveState(eventId),
    getSurveyRespondentDrawOptions(eventId),
  ]);
  const questionGroups = await Promise.all(
    sessions.map(async (session) => ({
      sessionTitle: session.title,
      questions: await getQuestionsForSession(session.id),
    }))
  );
  const message = getSingle(query.message);
  const error = getSingle(query.error);
  const screenUrl = buildPublicUrl(`/screen/${event.event_code}`);
  const hasLatestWinner = winners.some(
    (winner) => winner.status === "pending" || winner.status === "claimed"
  );

  return (
    <AdminShell
      title="럭키드로우"
      description="경품을 등록하고 전체 참가자, 정답자, 설문 제출자 중에서 당첨자를 추첨합니다. 당첨 결과는 저장된 뒤 스크린에 발표됩니다."
    >
      <div className="grid gap-5">
        <AdminPanel title={event.title} description={`행사 코드: ${event.event_code}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={canOperate ? "green" : "amber"}>
              {canOperate ? "추첨 운영 가능" : "조회 전용"}
            </StatusBadge>
            <StatusBadge tone="slate">
              중복 당첨 방지: event_id + participant_id
            </StatusBadge>
          </div>
          {!canOperate && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              screen_operator와 qna_moderator는 추첨 결과를 볼 수 있지만 경품 생성,
              추첨 실행, 상태 변경은 할 수 없습니다.
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              {error}
            </p>
          )}
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
          <section className="grid content-start gap-5">
            <AdminPanel
              title="경품 관리"
              description="수량은 1 이상이어야 하며, 이미 당첨자와 연결된 경품은 삭제할 수 없습니다."
            >
              <PrizeCreateForm eventId={eventId} canOperate={canOperate} />
            </AdminPanel>

            {prizes.length > 0 ? (
              <div className="grid gap-4">
                {prizes.map((prize) => (
                  <PrizeCard
                    key={prize.id}
                    eventId={eventId}
                    prize={prize}
                    canOperate={canOperate}
                  />
                ))}
              </div>
            ) : (
              <AdminPanel title="경품 목록">
                <EmptyState
                  title="등록된 경품이 없습니다."
                  description="먼저 경품을 추가한 뒤 추첨을 실행할 수 있습니다."
                />
              </AdminPanel>
            )}

            <AdminPanel
              title="추첨 실행"
              description="추첨은 서버에서 후보를 선택해 저장한 뒤, 스크린에서 카운트다운과 롤링 연출을 보여줍니다."
            >
              <DrawForm
                eventId={eventId}
                prizes={prizes}
                sessions={sessions}
                questionGroups={questionGroups}
                surveyOptions={surveyOptions}
                canOperate={canOperate}
              />
            </AdminPanel>

            <AdminPanel
              title="당첨자 목록"
              description="전화번호는 표시하지 않습니다. 수령 완료, 취소, 재추첨 상태만 관리합니다."
            >
              {winners.length > 0 ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {winners.map((winner) => (
                    <WinnerCard
                      key={winner.id}
                      eventId={eventId}
                      winner={winner}
                      canOperate={canOperate}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="아직 당첨자가 없습니다."
                  description="추첨을 실행하면 저장된 당첨 결과가 이곳에 표시됩니다."
                />
              )}
            </AdminPanel>
          </section>

          <aside className="grid content-start gap-5">
            <ScreenStatePanel liveState={liveState} />
            <ScreenControlPanel
              eventId={eventId}
              screenUrl={screenUrl}
              liveState={liveState}
              canOperate={canOperate}
              hasLatestWinner={hasLatestWinner}
            />
            <AdminPanel
              title="운영 메모"
              description="현재 정책은 한 행사에서 한 참가자 1회 당첨입니다."
            >
              <div className="grid gap-3 text-sm font-bold leading-6 text-slate-600">
              <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  cancelled 또는 redrawn 상태도 기존 당첨 이력으로 남습니다. 현재
                  DB unique 제약 때문에 같은 참가자는 다시 당첨될 수 없습니다.
                </p>
              <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  스크린 발표 payload에는 당첨자 이름, 경품명, 추첨 방식만 저장하며
                  전화번호는 포함하지 않습니다.
                </p>
              <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  추첨 연출은 화면 효과입니다. 최종 당첨자는 서버에 저장된
                  draw_winners 결과를 기준으로 표시됩니다.
                </p>
              </div>
            </AdminPanel>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
