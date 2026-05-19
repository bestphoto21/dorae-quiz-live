import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canModerateQnaByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getQnaQuestionsForEvent,
  type QnaQuestionSummary,
  type QnaStatus,
} from "@/lib/data/qna";
import {
  approveQuestion,
  deleteQuestion,
  hideQuestion,
  pinQuestion,
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
  const status = getStatus(getSingle(query.status));
  const search = getSingle(query.q)?.trim() ?? "";
  const message = getSingle(query.message);
  const error = getSingle(query.error);
  const questions = await getQnaQuestionsForEvent({
    eventId,
    status,
    search,
  });

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
