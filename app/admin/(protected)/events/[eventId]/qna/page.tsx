import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canOperateLiveScreenByRole,
  canModerateQnaByRole,
  canSetQnaScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getQnaQuestionsForEvent,
  type QnaQuestionSummary,
  type QnaStatus,
} from "@/lib/data/qna";
import {
  approveQuestion,
  clearQnaScreenFromQna,
  deleteQuestion,
  hideQuestion,
  pinQuestion,
  setBreakScreenFromQna,
  setJoinQrScreenFromQna,
  setWaitingScreenFromQna,
  showQuestionOnScreen,
  unpinQuestion,
} from "./actions";

type QnaPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    message?: string | string[];
    error?: string | string[];
  }>;
};

type QnaLiveState = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

const STATUS_OPTIONS: Array<{ value: QnaStatus | "all"; label: string }> = [
  { value: "pending", label: "검토 중" },
  { value: "approved", label: "승인됨" },
  { value: "hidden", label: "숨김" },
  { value: "deleted", label: "삭제 상태" },
  { value: "all", label: "전체" },
];

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getStatus(value: string | undefined): QnaStatus | "all" {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "hidden" ||
    value === "deleted" ||
    value === "all"
  ) {
    return value;
  }

  return "pending";
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

function statusTone(status: QnaStatus) {
  if (status === "approved") {
    return "green";
  }

  if (status === "hidden") {
    return "amber";
  }

  if (status === "deleted") {
    return "rose";
  }

  return "cyan";
}

function statusLabel(status: QnaStatus) {
  if (status === "approved") {
    return "승인됨";
  }

  if (status === "hidden") {
    return "숨김";
  }

  if (status === "deleted") {
    return "삭제 상태";
  }

  return "검토 중";
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    join_qr: "QR 참여 안내 화면",
    qna: "Q&A 질문 접수 화면",
    qna_waiting: "Q&A 질문 접수 화면",
    qna_question: "승인 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    draw_winner: "당첨자 발표 화면",
    question: "퀴즈 문제 화면",
    closed: "응답 마감 화면",
    result: "결과 화면",
    survey_intro: "설문 참여 안내 화면",
    survey_active: "설문 진행 화면",
    survey_status: "설문 제출 현황 화면",
    survey_closed: "설문 마감 화면",
  };

  return labels[scene ?? "waiting"] ?? "대기 화면";
}

function modeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
    survey: "설문",
  };

  return labels[mode ?? "waiting"] ?? "대기";
}

async function getLiveState(eventId: string): Promise<QnaLiveState | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("mode, screen_scene, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-qna] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as QnaLiveState | null;
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
      className={`min-h-10 rounded-2xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 ${classes[tone]}`}
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
  canOperateScreen,
  canSetQnaScreen,
}: {
  eventId: string;
  screenUrl: string;
  liveState: QnaLiveState | null;
  canOperateScreen: boolean;
  canSetQnaScreen: boolean;
}) {
  const waitingAction = setWaitingScreenFromQna.bind(null, eventId);
  const joinQrAction = setJoinQrScreenFromQna.bind(null, eventId);
  const breakAction = setBreakScreenFromQna.bind(null, eventId);
  const clearQnaAction = clearQnaScreenFromQna.bind(null, eventId);

  return (
    <AdminPanel
      title="화면 제어"
      description="Q&A 운영 중에도 스크린을 대기, 휴식, QR, 질문 접수 화면으로 바로 전환할 수 있습니다."
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
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
            className="mt-1 inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-slate-100"
          >
            스크린 열기
          </Link>
        </div>

        <div className="grid content-start gap-2">
          <ScreenControlButton
            action={waitingAction}
            disabled={!canOperateScreen}
          >
            대기 화면 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={joinQrAction}
            disabled={!canOperateScreen}
          >
            QR 참여 안내 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={breakAction}
            tone="amber"
            disabled={!canOperateScreen}
          >
            휴식 화면 송출
          </ScreenControlButton>
          <ScreenControlButton
            action={clearQnaAction}
            tone="cyan"
            disabled={!canSetQnaScreen}
          >
            Q&A 송출 해제
          </ScreenControlButton>
          {!canOperateScreen && !canSetQnaScreen && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              현재 역할은 스크린 상태를 조회할 수 있지만 변경할 수 없습니다.
            </p>
          )}
        </div>
      </div>
    </AdminPanel>
  );
}

function FilterPanel({
  eventId,
  currentStatus,
  search,
}: {
  eventId: string;
  currentStatus: QnaStatus | "all";
  search: string;
}) {
  return (
    <AdminPanel
      title="질문 필터"
      description="승인 전 질문은 스크린에 노출되지 않습니다. 먼저 질문 내용을 검수해 주세요."
    >
      <form className="grid gap-3 md:grid-cols-[12rem_1fr_auto]">
        <select
          name="status"
          defaultValue={currentStatus}
          className="min-h-11 rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={search}
          placeholder="질문 내용 검색"
          className="min-h-11 rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
        />
        <SubmitButton>검색</SubmitButton>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/events/${eventId}/qna?status=${option.value}`}
            className={`rounded-2xl border px-4 py-2 text-sm font-black shadow-sm ${
              currentStatus === option.value
                ? "border-[#0a1a38] bg-[#0a1a38] text-white"
                : "border-slate-400 bg-white text-[color:#0a1a38] hover:border-[#0a1a38]"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </AdminPanel>
  );
}

function QuestionActions({
  eventId,
  question,
  canModerate,
}: {
  eventId: string;
  question: QnaQuestionSummary;
  canModerate: boolean;
}) {
  const approveAction = approveQuestion.bind(null, eventId, question.id);
  const hideAction = hideQuestion.bind(null, eventId, question.id);
  const deleteAction = deleteQuestion.bind(null, eventId, question.id);
  const pinAction = pinQuestion.bind(null, eventId, question.id);
  const unpinAction = unpinQuestion.bind(null, eventId, question.id);
  const showAction = showQuestionOnScreen.bind(null, eventId, question.id);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <form action={approveAction}>
        <SubmitButton
          tone="cyan"
          disabled={!canModerate || question.status === "approved"}
        >
          승인
        </SubmitButton>
      </form>
      <form action={hideAction}>
        <SubmitButton
          tone="amber"
          disabled={!canModerate || question.status === "hidden"}
        >
          숨김
        </SubmitButton>
      </form>
      <form action={deleteAction}>
        <SubmitButton
          tone="rose"
          disabled={!canModerate || question.status === "deleted"}
        >
          삭제 상태로 변경
        </SubmitButton>
      </form>
      <form action={question.is_pinned ? unpinAction : pinAction}>
        <SubmitButton disabled={!canModerate}>
          {question.is_pinned ? "고정 해제" : "핀 고정"}
        </SubmitButton>
      </form>
      <form action={showAction}>
        <SubmitButton
          tone="dark"
          disabled={!canModerate || question.status !== "approved"}
        >
          승인 질문 스크린 송출
        </SubmitButton>
      </form>
    </div>
  );
}

function QuestionCard({
  eventId,
  question,
  canModerate,
}: {
  eventId: string;
  question: QnaQuestionSummary;
  canModerate: boolean;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={statusTone(question.status)}>
            {statusLabel(question.status)}
          </StatusBadge>
          {question.is_pinned && <StatusBadge tone="amber">고정됨</StatusBadge>}
        </div>
        <p className="text-xs font-black text-slate-700">
          {formatDateTime(question.created_at)}
        </p>
      </div>

      <p className="mt-5 whitespace-pre-wrap text-xl font-black leading-8 text-[color:#0a1a38]">
        {question.question_text}
      </p>

      <div className="mt-5 grid gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold text-[color:#0a1a38]">
        <p>참가자: {question.participant_display_name}</p>
        {(question.organization || question.group_name) && (
          <p>
            {question.organization ?? "소속 미입력"}
            {question.group_name ? ` · ${question.group_name}` : ""}
          </p>
        )}
        <p>승인 시각: {formatDateTime(question.approved_at)}</p>
      </div>

      <QuestionActions
        eventId={eventId}
        question={question}
        canModerate={canModerate}
      />
    </article>
  );
}

export default async function QnaPage({ params, searchParams }: QnaPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canModerate = canModerateQnaByRole(role);
  const canOperateScreen = canOperateLiveScreenByRole(role);
  const canSetQnaScreen = canSetQnaScreenByRole(role);
  const status = getStatus(getSingle(query.status));
  const search = getSingle(query.q)?.trim() ?? "";
  const message = getSingle(query.message);
  const error = getSingle(query.error);
  const [questions, liveState] = await Promise.all([
    getQnaQuestionsForEvent({
      eventId,
      status,
      search,
    }),
    getLiveState(eventId),
  ]);
  const screenUrl = buildPublicUrl(`/screen/${event.event_code}`);

  return (
    <AdminShell
      title="현장 Q&A"
      description="참가자가 남긴 질문을 검수하고, 승인된 질문만 현장 스크린에 송출합니다."
    >
      <div className="grid gap-5">
        <AdminPanel title={event.title} description={`행사 코드: ${event.event_code}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={canModerate ? "green" : "amber"}>
              {canModerate ? "Q&A 검수 가능" : "조회 전용"}
            </StatusBadge>
            <StatusBadge tone="slate">
              승인된 질문만 스크린 송출 가능
            </StatusBadge>
          </div>
          {!canModerate && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              screen_operator는 Q&A 질문을 볼 수 있지만 승인, 삭제, 송출은 할 수
              없습니다.
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

        <ScreenControlPanel
          eventId={eventId}
          screenUrl={screenUrl}
          liveState={liveState}
          canOperateScreen={canOperateScreen}
          canSetQnaScreen={canSetQnaScreen}
        />

        <FilterPanel eventId={eventId} currentStatus={status} search={search} />

        <AdminPanel
          title="질문 목록"
          description="전화번호는 표시하지 않습니다. 삭제는 실제 삭제가 아니라 deleted 상태로 바꾸는 soft delete입니다."
        >
          {questions.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  eventId={eventId}
                  question={question}
                  canModerate={canModerate}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="조건에 맞는 질문이 없습니다."
              description="참가자가 질문을 제출하면 pending 상태로 이곳에 표시됩니다."
            />
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
