import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canEditEventQuestionsByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getQuestionCountsBySession,
  getQuestionsForSession,
  getQuizSessionsForEvent,
  type QuestionRecord,
  type QuestionType,
  type QuizSessionRecord,
  type QuizSessionStatus,
} from "@/lib/data/quiz";
import {
  createQuestion,
  createQuizSession,
  deleteQuestion,
  deleteQuizSession,
  moveQuestionOrder,
  updateQuestion,
  updateQuizSession,
} from "./actions";

type QuestionsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    sessionId?: string | string[];
    message?: string | string[];
    error?: string | string[];
  }>;
};

const SESSION_STATUS_LABELS: Record<QuizSessionStatus, string> = {
  draft: "초안",
  ready: "준비",
  live: "진행",
  ended: "종료",
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  quiz_single: "단일 정답 퀴즈",
  poll_single: "단일 선택 투표",
  poll_multiple: "복수 선택 투표",
  ox: "OX",
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusTone(status: QuizSessionStatus) {
  if (status === "live") {
    return "cyan";
  }

  if (status === "ready") {
    return "green";
  }

  if (status === "ended") {
    return "slate";
  }

  return "amber";
}

function questionTypeTone(questionType: QuestionType) {
  if (questionType === "quiz_single") {
    return "green";
  }

  if (questionType === "ox") {
    return "amber";
  }

  return "cyan";
}

function selectClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-slate-950";
}

function inputClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-sm outline-none transition focus:border-slate-950";
}

function labelClasses() {
  return "text-xs font-black uppercase text-slate-500";
}

function SessionCreateForm({ eventId }: { eventId: string }) {
  const action = createQuizSession.bind(null, eventId);

  return (
    <form action={action} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-black text-slate-950">새 세션</h3>
      <div className="mt-4 grid gap-3">
        <div>
          <label htmlFor="session-title-new" className={labelClasses()}>
            세션명
          </label>
          <input
            id="session-title-new"
            name="title"
            type="text"
            required
            className={inputClasses()}
            placeholder="1라운드 퀴즈"
          />
        </div>
        <input type="hidden" name="status" value="draft" />
        <button
          type="submit"
          className="min-h-11 rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          세션 생성
        </button>
      </div>
    </form>
  );
}

function SessionCard({
  eventId,
  session,
  selected,
  questionCount,
  canEdit,
}: {
  eventId: string;
  session: QuizSessionRecord;
  selected: boolean;
  questionCount: number;
  canEdit: boolean;
}) {
  const updateAction = updateQuizSession.bind(null, eventId, session.id);
  const deleteAction = deleteQuizSession.bind(null, eventId, session.id);

  return (
    <article
      className={`rounded-3xl border bg-white p-5 shadow-sm ${
        selected ? "border-slate-950" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusBadge tone={statusTone(session.status)}>
            {SESSION_STATUS_LABELS[session.status]}
          </StatusBadge>
          <Link
            href={`/admin/events/${eventId}/questions?sessionId=${session.id}`}
            className="mt-3 block text-xl font-black leading-tight text-slate-950 hover:underline"
          >
            {session.title}
          </Link>
          <p className="mt-2 text-sm font-bold text-slate-500">
            문제 {questionCount.toLocaleString("ko-KR")}개
          </p>
        </div>
        {selected && <StatusBadge tone="slate">선택됨</StatusBadge>}
      </div>

      {canEdit ? (
        <div className="mt-5 grid gap-3">
          <form action={updateAction} className="grid gap-3">
            <div>
              <label htmlFor={`session-title-${session.id}`} className={labelClasses()}>
                세션명 수정
              </label>
              <input
                id={`session-title-${session.id}`}
                name="title"
                type="text"
                required
                defaultValue={session.title}
                className={inputClasses()}
              />
            </div>
            <div>
              <label htmlFor={`session-status-${session.id}`} className={labelClasses()}>
                상태
              </label>
              <select
                id={`session-status-${session.id}`}
                name="status"
                defaultValue={session.status}
                className={selectClasses()}
              >
                {Object.entries(SESSION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950 hover:text-slate-950"
            >
              세션 저장
            </button>
          </form>

          <form action={deleteAction} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold leading-6 text-rose-700">
              문제가 있는 세션은 서버에서 삭제를 막습니다. 운영 실수를 줄이기
              위해 먼저 문제를 정리해 주세요.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-black text-rose-800">
              <input
                type="checkbox"
                name="confirm_delete"
                value="yes"
                className="h-4 w-4 rounded border-rose-300"
              />
              세션 삭제 확인
            </label>
            <button
              type="submit"
              className="mt-3 min-h-10 rounded-2xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm"
            >
              세션 삭제
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
          현재 역할은 세션을 조회할 수 있지만 수정할 수 없습니다.
        </p>
      )}
    </article>
  );
}

function QuestionFormFields({ question }: { question?: QuestionRecord }) {
  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={question ? `question-text-${question.id}` : "question-text-new"} className={labelClasses()}>
          질문
        </label>
        <textarea
          id={question ? `question-text-${question.id}` : "question-text-new"}
          name="question_text"
          rows={3}
          required
          defaultValue={question?.question_text ?? ""}
          className={`${inputClasses()} resize-y leading-7`}
          placeholder="오늘 행사의 메인 키워드는 무엇인가요?"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((optionNumber) => {
          const key = `option_${optionNumber}` as
            | "option_1"
            | "option_2"
            | "option_3"
            | "option_4";

          return (
            <div key={key}>
              <label
                htmlFor={question ? `${key}-${question.id}` : `${key}-new`}
                className={labelClasses()}
              >
                선택지 {optionNumber}
              </label>
              <input
                id={question ? `${key}-${question.id}` : `${key}-new`}
                name={key}
                type="text"
                required
                defaultValue={question?.[key] ?? ""}
                className={inputClasses()}
                placeholder={optionNumber === 1 ? "O 또는 선택지" : "선택지"}
              />
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label htmlFor={question ? `correct-${question.id}` : "correct-new"} className={labelClasses()}>
            정답
          </label>
          <select
            id={question ? `correct-${question.id}` : "correct-new"}
            name="correct_option"
            defaultValue={question?.correct_option ?? 1}
            className={selectClasses()}
          >
            {[1, 2, 3, 4].map((optionNumber) => (
              <option key={optionNumber} value={optionNumber}>
                {optionNumber}번
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={question ? `time-${question.id}` : "time-new"} className={labelClasses()}>
            제한 시간
          </label>
          <input
            id={question ? `time-${question.id}` : "time-new"}
            name="time_limit_seconds"
            type="number"
            min={5}
            max={300}
            defaultValue={question?.time_limit_seconds ?? 20}
            className={inputClasses()}
          />
        </div>
        <div>
          <label htmlFor={question ? `type-${question.id}` : "type-new"} className={labelClasses()}>
            유형
          </label>
          <select
            id={question ? `type-${question.id}` : "type-new"}
            name="question_type"
            defaultValue={question?.question_type ?? "quiz_single"}
            className={selectClasses()}
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 md:mt-6">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={question?.is_active ?? true}
            className="h-4 w-4 rounded border-slate-300"
          />
          활성
        </label>
      </div>
    </div>
  );
}

function CreateQuestionForm({
  eventId,
  sessionId,
}: {
  eventId: string;
  sessionId: string;
}) {
  const action = createQuestion.bind(null, eventId, sessionId);

  return (
    <AdminPanel
      title="문제 추가"
      description="정답 값은 관리자 화면에서만 다룹니다. 참가자용 문제 payload는 이후 별도로 분리합니다."
    >
      <form action={action} className="grid gap-5">
        <QuestionFormFields />
        <button
          type="submit"
          className="min-h-12 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800"
        >
          문제 추가
        </button>
      </form>
    </AdminPanel>
  );
}

function QuestionCard({
  eventId,
  sessionId,
  question,
  index,
  total,
  canEdit,
}: {
  eventId: string;
  sessionId: string;
  question: QuestionRecord;
  index: number;
  total: number;
  canEdit: boolean;
}) {
  const updateAction = updateQuestion.bind(null, eventId, sessionId, question.id);
  const deleteAction = deleteQuestion.bind(null, eventId, sessionId, question.id);
  const moveUpAction = moveQuestionOrder.bind(
    null,
    eventId,
    sessionId,
    question.id,
    "up"
  );
  const moveDownAction = moveQuestionOrder.bind(
    null,
    eventId,
    sessionId,
    question.id,
    "down"
  );

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="slate">#{index + 1}</StatusBadge>
            <StatusBadge tone={questionTypeTone(question.question_type)}>
              {QUESTION_TYPE_LABELS[question.question_type]}
            </StatusBadge>
            <StatusBadge tone={question.is_active ?? true ? "green" : "amber"}>
              {question.is_active ?? true ? "활성" : "비활성"}
            </StatusBadge>
            <StatusBadge tone="rose">정답 {question.correct_option}번</StatusBadge>
          </div>
          <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">
            {question.question_text}
          </h3>
          <p className="mt-2 text-sm font-bold text-slate-500">
            제한 시간 {question.time_limit_seconds}초 · order_index{" "}
            {question.order_index}
          </p>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <form action={moveUpAction}>
              <button
                type="submit"
                disabled={index === 0}
                className="min-h-10 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950 disabled:opacity-40"
              >
                위로
              </button>
            </form>
            <form action={moveDownAction}>
              <button
                type="submit"
                disabled={index === total - 1}
                className="min-h-10 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950 disabled:opacity-40"
              >
                아래로
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {[question.option_1, question.option_2, question.option_3, question.option_4].map(
          (option, optionIndex) => (
            <p
              key={`${question.id}-${optionIndex}`}
              className={`rounded-2xl border p-4 text-sm font-bold ${
                question.correct_option === optionIndex + 1
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {optionIndex + 1}. {option}
            </p>
          )
        )}
      </div>

      {canEdit ? (
        <div className="mt-5 grid gap-4">
          <form action={updateAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-black text-slate-950">문제 수정</h4>
            <QuestionFormFields question={question} />
            <button
              type="submit"
              className="min-h-11 rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              문제 수정
            </button>
          </form>

          <form action={deleteAction} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold leading-6 text-rose-700">
              삭제하면 이 문제와 연결된 답변도 cascade 대상이 될 수 있습니다.
              실시간 운영 전인지 확인해 주세요.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-black text-rose-800">
              <input
                type="checkbox"
                name="confirm_delete"
                value="yes"
                className="h-4 w-4 rounded border-rose-300"
              />
              문제 삭제 확인
            </label>
            <button
              type="submit"
              className="mt-3 min-h-10 rounded-2xl border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-black text-white shadow-sm"
            >
              문제 삭제
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
          현재 역할은 문제 내용을 조회할 수 있지만 수정할 수 없습니다.
        </p>
      )}
    </article>
  );
}

export default async function QuestionsPage({
  params,
  searchParams,
}: QuestionsPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canEdit = canEditEventQuestionsByRole(role);
  const sessions = await getQuizSessionsForEvent(eventId);
  const questionCounts = await getQuestionCountsBySession(eventId);
  const selectedSessionId = getSingle(query.sessionId);
  const selectedSession =
    sessions.find((session) => session.id === selectedSessionId) ??
    sessions[0] ??
    null;
  const questions = selectedSession
    ? await getQuestionsForSession(selectedSession.id)
    : [];
  const createSessionAction = createQuizSession.bind(null, eventId);
  const message = getSingle(query.message);
  const error = getSingle(query.error);

  return (
    <AdminShell
      title="문제 관리"
      description={`${event.title}의 퀴즈 세션과 문제 은행을 관리합니다. 정답 정보는 관리자 화면에서만 표시합니다.`}
    >
      <div className="grid gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <StatusBadge tone="cyan">{event.event_code}</StatusBadge>
              <h2 className="mt-3 text-2xl font-black text-slate-950">
                {event.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                현재 역할: {role ?? "권한 없음"} ·{" "}
                {canEdit ? "문제 편집 가능" : "조회 전용"}
              </p>
            </div>
            <Link
              href={`/admin/events/${eventId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950"
            >
              행사 개요
            </Link>
          </div>
          {!canEdit && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              screen_operator와 qna_moderator는 현장 확인을 위해 조회만
              허용합니다. 문제 생성, 수정, 삭제, 정렬은 event_admin 또는
              operator 권한이 필요합니다.
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
        </div>

        <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
          <section className="grid content-start gap-4">
            <AdminPanel
              title="퀴즈 세션"
              description="하나의 행사에 여러 라운드나 세션을 둘 수 있습니다."
            >
              {canEdit ? (
                <form action={createSessionAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label htmlFor="quick-session-title" className={labelClasses()}>
                    빠른 세션 생성
                  </label>
                  <input
                    id="quick-session-title"
                    name="title"
                    type="text"
                    required
                    className={inputClasses()}
                    placeholder="오프닝 퀴즈"
                  />
                  <input type="hidden" name="status" value="draft" />
                  <button
                    type="submit"
                    className="min-h-11 rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
                  >
                    세션 생성
                  </button>
                </form>
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
                  조회 전용 역할입니다.
                </p>
              )}
            </AdminPanel>

            {sessions.length > 0 ? (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  eventId={eventId}
                  session={session}
                  selected={selectedSession?.id === session.id}
                  questionCount={questionCounts.get(session.id) ?? 0}
                  canEdit={canEdit}
                />
              ))
            ) : canEdit ? (
              <SessionCreateForm eventId={eventId} />
            ) : (
              <AdminPanel title="세션 목록">
                <EmptyState
                  title="등록된 세션이 없습니다."
                  description="event_admin 또는 operator가 세션을 만들면 이곳에 표시됩니다."
                />
              </AdminPanel>
            )}
          </section>

          <section className="grid content-start gap-5">
            {selectedSession ? (
              <>
                <AdminPanel
                  title={selectedSession.title}
                  description="선택된 세션의 문제 목록입니다. 위/아래 이동 버튼은 order_index를 다시 정렬합니다."
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={statusTone(selectedSession.status)}>
                      {SESSION_STATUS_LABELS[selectedSession.status]}
                    </StatusBadge>
                    <StatusBadge tone="slate">
                      문제 {questions.length.toLocaleString("ko-KR")}개
                    </StatusBadge>
                  </div>
                </AdminPanel>

                {canEdit && (
                  <CreateQuestionForm
                    eventId={eventId}
                    sessionId={selectedSession.id}
                  />
                )}

                {questions.length > 0 ? (
                  <div className="grid gap-4">
                    {questions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        eventId={eventId}
                        sessionId={selectedSession.id}
                        question={question}
                        index={index}
                        total={questions.length}
                        canEdit={canEdit}
                      />
                    ))}
                  </div>
                ) : (
                  <AdminPanel title="문제 목록">
                    <EmptyState
                      title="등록된 문제가 없습니다."
                      description={
                        canEdit
                          ? "위의 문제 추가 영역에서 첫 문제를 등록해 주세요."
                          : "아직 등록된 문제가 없습니다."
                      }
                    />
                  </AdminPanel>
                )}
              </>
            ) : (
              <AdminPanel title="문제 목록">
                <EmptyState
                  title="선택된 세션이 없습니다."
                  description="먼저 퀴즈 세션을 만든 뒤 문제를 등록할 수 있습니다."
                />
              </AdminPanel>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
