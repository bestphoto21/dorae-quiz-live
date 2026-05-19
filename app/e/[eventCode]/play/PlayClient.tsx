"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileCard, StatusBadge } from "@/components/quiz/ui";

type ParticipantMode = "waiting" | "question" | "closed" | "result" | "draw" | "qna";

type ParticipantState = {
  event: {
    id: string;
    event_code: string;
    title: string;
    subtitle: string | null;
  };
  liveState: {
    mode: ParticipantMode;
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
  stats: {
    total_answers: number;
    option_counts: Record<"1" | "2" | "3" | "4", number>;
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

function WaitingCard({ title }: { title: string }) {
  return (
    <MobileCard>
      <StatusBadge tone="cyan">Waiting</StatusBadge>
      <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950">
        퀴즈가 곧 시작됩니다
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">
        {title} 진행자의 안내를 기다려 주세요.
      </p>
    </MobileCard>
  );
}

function QuestionCard({
  state,
  secondsLeft,
}: {
  state: ParticipantState;
  secondsLeft: number | null;
}) {
  const question = state.question;

  if (!question) {
    return <WaitingCard title={state.event.title} />;
  }

  return (
    <MobileCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge tone="cyan">Question</StatusBadge>
        <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
          {secondsLeft === 0
            ? "응답 마감"
            : `${secondsLeft ?? question.time_limit_seconds}초`}
        </span>
      </div>

      <h2 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
        {question.question_text}
      </h2>

      <div className="mt-7 grid gap-3">
        {optionEntries(question).map((option) => (
          <button
            key={option.number}
            type="button"
            disabled
            className="min-h-20 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left text-2xl font-black text-slate-700 shadow-sm"
          >
            <span className="mr-3 text-cyan-700">{option.number}</span>
            {option.label}
          </button>
        ))}
      </div>

      <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
        답변 제출 기능은 다음 단계에서 연결됩니다.
      </p>
    </MobileCard>
  );
}

function ClosedCard() {
  return (
    <MobileCard>
      <StatusBadge tone="amber">Closed</StatusBadge>
      <h2 className="mt-5 text-4xl font-black leading-tight text-slate-950">
        응답이 마감되었습니다
      </h2>
      <p className="mt-4 text-base leading-7 text-slate-600">
        잠시 후 결과가 공개됩니다.
      </p>
    </MobileCard>
  );
}

function ResultCard({ state }: { state: ParticipantState }) {
  const question = state.question;

  return (
    <MobileCard>
      <StatusBadge tone="green">Result</StatusBadge>
      <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950">
        {question?.question_text ?? "결과 공개"}
      </h2>
      {question?.correct_option ? (
        <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-3xl font-black text-emerald-800">
          정답: {question.correct_option}번
        </p>
      ) : (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base font-bold leading-7 text-amber-800">
          정답은 아직 공개되지 않았습니다.
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
      <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>
    </MobileCard>
  );
}

export default function PlayClient({ eventCode, eventTitle }: PlayClientProps) {
  const [state, setState] = useState<ParticipantState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchState() {
      try {
        const response = await fetch(
          `/api/participant/${encodeURIComponent(eventCode)}/state`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("participant state request failed");
        }

        const nextState = (await response.json()) as ParticipantState;

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

    fetchState();
    const pollingId = window.setInterval(fetchState, 2000);

    return () => {
      active = false;
      window.clearInterval(pollingId);
    };
  }, [eventCode]);

  useEffect(() => {
    const tickId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(tickId);
  }, []);

  const secondsLeft = useMemo(
    () => getSecondsLeft(state?.liveState.question_ends_at ?? null, now),
    [state?.liveState.question_ends_at, now]
  );

  if (!state) {
    return (
      <MobileCard>
        <StatusBadge tone="cyan">{eventCode}</StatusBadge>
        <h2 className="mt-5 text-3xl font-black text-slate-950">
          참여 화면을 준비 중입니다
        </h2>
        {error && (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </p>
        )}
      </MobileCard>
    );
  }

  if (state.liveState.mode === "question") {
    return <QuestionCard state={state} secondsLeft={secondsLeft} />;
  }

  if (state.liveState.mode === "closed") {
    return <ClosedCard />;
  }

  if (state.liveState.mode === "result") {
    return <ResultCard state={state} />;
  }

  if (state.liveState.mode === "draw") {
    return (
      <SimpleModeCard
        label="Draw"
        title="추첨이 진행 중입니다"
        description="추첨 결과는 현장 스크린을 확인해 주세요."
      />
    );
  }

  if (state.liveState.mode === "qna") {
    return (
      <SimpleModeCard
        label="Q&A"
        title="Q&A가 진행 중입니다"
        description="질문 제출 기능은 다음 단계에서 연결됩니다."
      />
    );
  }

  return <WaitingCard title={state.event.title || eventTitle} />;
}
