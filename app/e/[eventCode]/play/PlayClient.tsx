"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { MobileCard, StatusBadge } from "@/components/quiz/ui";
import { submitAnswer, submitQnaQuestion } from "./actions";

type ParticipantMode = "waiting" | "question" | "closed" | "result" | "draw" | "qna";

type ParticipantState = {
  event: {
    id: string;
    event_code: string;
    title: string;
    subtitle: string | null;
    primary_color: string | null;
    logo_url: string | null;
    screen_notice: string | null;
  };
  participant: {
    display_name: string;
  };
  liveState: {
    mode: ParticipantMode;
    screen_scene: string | null;
    question_started_at: string | null;
    question_ends_at: string | null;
    reveal_answer: boolean;
    show_results: boolean;
  };
  question: {
    id: string;
    question_text: string;
    option_1: string;
    option_2: string;
    option_3: string;
    option_4: string;
    question_type: string;
    time_limit_seconds: number;
    correct_option?: number;
  } | null;
  answer: {
    selected_option: number;
    answered_at: string;
    is_correct?: boolean;
  } | null;
  qnaQuestions: Array<{
    id: string;
    question_text: string;
    status: "pending" | "approved" | "hidden";
    created_at: string | null;
  }>;
  canAnswer: boolean;
  stats: {
    total_answers: number;
    option_counts: Record<"1" | "2" | "3" | "4", number>;
    correct_answers?: number;
  };
};

type PlayClientProps = {
  eventCode: string;
  eventTitle: string;
};

function getSecondsLeft(questionEndsAt: string | null, now: number | null) {
  if (!questionEndsAt || now === null) {
    return null;
  }

  return Math.max(0, Math.ceil((new Date(questionEndsAt).getTime() - now) / 1000));
}

function optionEntries(question: NonNullable<ParticipantState["question"]>) {
  return [
    { number: 1, label: question.option_1 },
    { number: 2, label: question.option_2 },
    { number: 3, label: question.option_3 },
    { number: 4, label: question.option_4 },
  ];
}

function AnswerNotice({ state }: { state: ParticipantState }) {
  if (!state.answer) {
    return null;
  }

  return (
    <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
      <p className="text-sm font-black text-cyan-700">응답 완료</p>
      <p className="mt-1 text-lg font-black text-cyan-950">
        선택한 답: {state.answer.selected_option}번
      </p>
      {!state.liveState.reveal_answer && (
        <p className="mt-2 text-sm font-bold leading-6 text-cyan-800">
          정답은 운영자가 공개한 뒤 확인할 수 있습니다.
        </p>
      )}
    </div>
  );
}

function WaitingCard({ state, fallbackTitle }: { state: ParticipantState | null; fallbackTitle: string }) {
  const title = state?.event.title || fallbackTitle;
  const displayName = state?.participant.display_name;

  return (
    <MobileCard>
      <StatusBadge tone="cyan">대기</StatusBadge>
      <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950">
        퀴즈가 곧 시작됩니다
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-700">
        {displayName ? `${displayName}님, ` : ""}
        {title} 진행자의 안내를 기다려 주세요.
      </p>
      <p className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-800">
        화면은 자동으로 새로고침됩니다.
      </p>
    </MobileCard>
  );
}

function QuestionCard({
  state,
  secondsLeft,
  pendingOption,
  submitMessage,
  submitError,
  onSubmit,
}: {
  state: ParticipantState;
  secondsLeft: number | null;
  pendingOption: number | null;
  submitMessage: string | null;
  submitError: string | null;
  onSubmit: (selectedOption: number) => void;
}) {
  const question = state.question;

  if (!question) {
    return <WaitingCard state={state} fallbackTitle={state.event.title} />;
  }

  const timeClosed = secondsLeft === 0;
  const canSubmit = state.canAnswer && !timeClosed && pendingOption === null;

  return (
    <MobileCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="cyan">문제 진행</StatusBadge>
        <span className="rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-black text-amber-950">
          {timeClosed ? "응답 마감" : `${secondsLeft ?? question.time_limit_seconds}초`}
        </span>
      </div>

      <h2 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
        {question.question_text}
      </h2>

      <div className="mt-7 grid gap-3">
        {optionEntries(question).map((option) => {
          const isSelected = state.answer?.selected_option === option.number;
          const isPending = pendingOption === option.number;

          return (
            <button
              key={option.number}
              type="button"
              disabled={!canSubmit}
              onClick={() => onSubmit(option.number)}
              className={`min-h-20 rounded-2xl border p-5 text-left text-2xl font-black shadow-sm transition ${
                isSelected
                  ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                  : "border-slate-300 bg-slate-50 text-slate-900"
              } ${
                canSubmit
                  ? "hover:border-slate-950 active:scale-[0.99]"
                  : "cursor-not-allowed"
              }`}
            >
              <span className="mr-3 text-cyan-700">{option.number}</span>
              {option.label}
              {isPending && <span className="ml-3 text-base">제출 중</span>}
            </button>
          );
        })}
      </div>

      <AnswerNotice state={state} />

      {!state.answer && !state.canAnswer && (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
          현재는 응답할 수 없습니다. 문제가 진행 중인지와 남은 시간을 확인해 주세요.
        </p>
      )}
      {submitMessage && (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {submitMessage}
        </p>
      )}
      {submitError && (
        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {submitError}
        </p>
      )}
    </MobileCard>
  );
}

function ClosedCard({ state }: { state: ParticipantState }) {
  return (
    <MobileCard>
      <StatusBadge tone="amber">응답 마감</StatusBadge>
      <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950">
        응답이 마감되었습니다
      </h2>
      {state.answer ? (
        <AnswerNotice state={state} />
      ) : (
        <p className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-800">
          이번 문제는 응답하지 못했습니다.
        </p>
      )}
      <p className="mt-4 text-base leading-7 text-slate-700">
        잠시 후 결과가 공개됩니다.
      </p>
    </MobileCard>
  );
}

function ResultCard({ state }: { state: ParticipantState }) {
  const question = state.question;
  const selectedOption = state.answer?.selected_option;
  const correctOption = question?.correct_option;
  const showCorrectness =
    state.liveState.reveal_answer && typeof state.answer?.is_correct === "boolean";

  return (
    <MobileCard>
      <StatusBadge tone="green">결과 공개</StatusBadge>
      <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950">
        {question?.question_text ?? "결과 공개"}
      </h2>

      {question && (
        <div className="mt-6 grid gap-3">
          {optionEntries(question).map((option) => {
            const isCorrect = correctOption === option.number;
            const isSelected = selectedOption === option.number;

            return (
              <div
                key={option.number}
                className={`rounded-2xl border p-4 text-lg font-black ${
                  isCorrect
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : isSelected
                      ? "border-cyan-300 bg-cyan-50 text-cyan-900"
                      : "border-slate-300 bg-slate-50 text-slate-900"
                }`}
              >
                {option.number}. {option.label}
                {isSelected && <span className="ml-2 text-sm">내 선택</span>}
                {isCorrect && <span className="ml-2 text-sm">정답</span>}
              </div>
            );
          })}
        </div>
      )}

      {correctOption ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-2xl font-black text-emerald-800">
          정답: {correctOption}번
        </p>
      ) : (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base font-bold leading-7 text-amber-800">
          정답은 아직 공개되지 않았습니다.
        </p>
      )}

      {showCorrectness && (
        <p
          className={`mt-5 rounded-2xl border p-5 text-2xl font-black ${
            state.answer?.is_correct
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.answer?.is_correct ? "정답입니다" : "아쉽지만 오답입니다"}
        </p>
      )}

      {!state.answer && (
        <p className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-800">
          이번 문제는 응답하지 않았습니다.
        </p>
      )}
    </MobileCard>
  );
}

function SimpleModeCard({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <MobileCard>
      <StatusBadge tone="slate">{label}</StatusBadge>
      <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-700">{description}</p>
    </MobileCard>
  );
}

function qnaStatusLabel(status: "pending" | "approved" | "hidden") {
  if (status === "approved") {
    return "채택됨";
  }

  if (status === "hidden") {
    return "미표시";
  }

  return "검토 중";
}

function QnaPanel({
  state,
  questionText,
  pending,
  message,
  error,
  onTextChange,
  onSubmit,
}: {
  state: ParticipantState;
  questionText: string;
  pending: boolean;
  message: string | null;
  error: string | null;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const highlighted = state.liveState.mode === "qna";

  return (
    <MobileCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone={highlighted ? "cyan" : "slate"}>Q&A</StatusBadge>
        <span className="text-xs font-black text-slate-700">
          운영자 검토 후 표시
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-black text-slate-950">질문 남기기</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
        질문을 남기면 운영자가 확인한 뒤 승인된 질문만 스크린에 표시됩니다.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-3">
        <textarea
          value={questionText}
          onChange={(event) => onTextChange(event.target.value)}
          maxLength={300}
          rows={4}
          placeholder="질문을 입력해 주세요."
          className="w-full resize-none rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold leading-7 text-slate-950 shadow-sm outline-none placeholder:text-slate-500 focus:border-slate-950"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-bold text-slate-700">
            {questionText.length}/300
          </span>
          <button
            type="submit"
            disabled={pending}
            className="min-h-12 w-full rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 sm:w-auto"
          >
            {pending ? "접수 중" : "질문 제출"}
          </button>
        </div>
      </form>

      {message && (
          <p className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error}
        </p>
      )}

      {state.qnaQuestions.length > 0 && (
        <div className="mt-6 grid gap-3">
          <p className="text-sm font-black text-slate-700">내 최근 질문</p>
          {state.qnaQuestions.map((question) => (
            <div
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-bold leading-6 text-slate-800">
                {question.question_text}
              </p>
              <p className="mt-2 text-xs font-black text-slate-700">
                {qnaStatusLabel(question.status)}
              </p>
            </div>
          ))}
        </div>
      )}
    </MobileCard>
  );
}

export default function PlayClient({ eventCode, eventTitle }: PlayClientProps) {
  const [state, setState] = useState<ParticipantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [qnaQuestionText, setQnaQuestionText] = useState("");
  const [qnaPending, setQnaPending] = useState(false);
  const [qnaMessage, setQnaMessage] = useState<string | null>(null);
  const [qnaError, setQnaError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const loadState = useCallback(async () => {
    const response = await fetch(
      `/api/participant/${encodeURIComponent(eventCode)}/state`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("participant state request failed");
    }

    return (await response.json()) as ParticipantState;
  }, [eventCode]);

  const refreshState = useCallback(async () => {
    const nextState = await loadState();

    setState(nextState);
    setError(null);
  }, [loadState]);

  useEffect(() => {
    let active = true;

    async function refreshIfActive() {
      try {
        const nextState = await loadState();

        if (active) {
          setState(nextState);
          setError(null);
        }
      } catch {
        if (active) {
          setError("현재 퀴즈 상태를 불러오지 못했습니다.");
        }
      }
    }

    refreshIfActive();
    const pollingId = window.setInterval(refreshIfActive, 2000);

    return () => {
      active = false;
      window.clearInterval(pollingId);
    };
  }, [loadState]);

  useEffect(() => {
    const tickId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(tickId);
  }, []);

  const secondsLeft = useMemo(
    () => getSecondsLeft(state?.liveState.question_ends_at ?? null, now),
    [state?.liveState.question_ends_at, now]
  );

  async function handleSubmit(selectedOption: number) {
    if (!state?.question || !state.canAnswer || pendingOption !== null) {
      return;
    }

    setPendingOption(selectedOption);
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      const result = await submitAnswer(eventCode, state.question.id, selectedOption);

      if (result.ok) {
        setSubmitMessage(result.message);
      } else {
        setSubmitError(result.message);
      }

      await refreshState();
    } catch {
      setSubmitError("응답 제출 중 오류가 발생했습니다.");
    } finally {
      setPendingOption(null);
    }
  }

  async function handleQnaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (qnaPending) {
      return;
    }

    setQnaPending(true);
    setQnaMessage(null);
    setQnaError(null);

    try {
      const result = await submitQnaQuestion(eventCode, qnaQuestionText);

      if (result.ok) {
        setQnaQuestionText("");
        setQnaMessage(result.message);
      } else {
        setQnaError(result.message);
      }

      await refreshState();
    } catch {
      setQnaError("질문 접수 중 오류가 발생했습니다.");
    } finally {
      setQnaPending(false);
    }
  }

  function withQna(content: ReactNode, qnaFirst = false) {
    if (!state) {
      return content;
    }

    const qnaPanel = (
      <QnaPanel
        state={state}
        questionText={qnaQuestionText}
        pending={qnaPending}
        message={qnaMessage}
        error={qnaError}
        onTextChange={setQnaQuestionText}
        onSubmit={handleQnaSubmit}
      />
    );

    return (
      <div className="grid gap-5">
        {qnaFirst && qnaPanel}
        {content}
        {!qnaFirst && qnaPanel}
      </div>
    );
  }

  if (!state) {
    return (
      <MobileCard>
        <StatusBadge tone="cyan">{eventCode}</StatusBadge>
        <h2 className="mt-5 text-3xl font-black text-slate-950">
          참여 화면을 준비 중입니다
        </h2>
        {error && (
          <p className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">
            {error}
          </p>
        )}
      </MobileCard>
    );
  }

  if (state.liveState.mode === "question") {
    return withQna(
      <QuestionCard
        state={state}
        secondsLeft={secondsLeft}
        pendingOption={pendingOption}
        submitMessage={submitMessage}
        submitError={submitError}
        onSubmit={handleSubmit}
      />
    );
  }

  if (state.liveState.mode === "closed") {
    return withQna(<ClosedCard state={state} />);
  }

  if (state.liveState.mode === "result") {
    return withQna(<ResultCard state={state} />);
  }

  if (state.liveState.mode === "draw") {
    return withQna(
      <SimpleModeCard
        label="추첨"
        title="추첨이 진행 중입니다"
        description="추첨 결과는 현장 스크린을 확인해 주세요."
      />
    );
  }

  if (state.liveState.mode === "qna") {
    return withQna(
      <SimpleModeCard
        label="Q&A"
        title="Q&A가 진행 중입니다"
        description="질문을 남기면 운영자가 확인한 뒤 승인된 질문만 스크린에 표시됩니다."
      />
    );
  }

  return withQna(<WaitingCard state={state} fallbackTitle={eventTitle} />);
}
