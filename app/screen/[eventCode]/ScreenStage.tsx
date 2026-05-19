"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type ScreenMode = "waiting" | "question" | "closed" | "result" | "draw" | "qna";

type ScreenState = {
  event: {
    id: string;
    event_code: string;
    title: string;
    subtitle: string | null;
    venue: string | null;
    primary_color: string | null;
    logo_url: string | null;
    screen_notice: string | null;
  };
  liveState: {
    mode: ScreenMode;
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
  draw: {
    winner_id: string;
    participant_display_name: string;
    prize_name: string;
    source_type: string;
    created_at: string | null;
  } | null;
  qna: {
    qna_question_id: string;
    question_text: string;
    participant_display_name: string;
    organization: string | null;
    group_name: string | null;
    created_at: string | null;
  } | null;
  notice: {
    title: string | null;
    message: string | null;
  } | null;
  stats: {
    total_answers: number;
    option_counts: Record<"1" | "2" | "3" | "4", number>;
    correct_answers?: number;
  };
};

type ScreenStageProps = {
  eventCode: string;
};

function getSecondsLeft(questionEndsAt: string | null, now: number) {
  if (!questionEndsAt) {
    return null;
  }

  return Math.max(0, Math.ceil((new Date(questionEndsAt).getTime() - now) / 1000));
}

function optionEntries(question: NonNullable<ScreenState["question"]>) {
  return [
    { number: 1, label: question.option_1 },
    { number: 2, label: question.option_2 },
    { number: 3, label: question.option_3 },
    { number: 4, label: question.option_4 },
  ];
}

function sourceLabel(sourceType: string) {
  if (sourceType === "all_participants") {
    return "전체 참가자 추첨";
  }

  if (sourceType === "correct_answers") {
    return "정답자 추첨";
  }

  if (sourceType === "question_correct_answers") {
    return "특정 문제 정답자 추첨";
  }

  return "추첨";
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    inactive: "비활성 행사",
    waiting: "대기 화면",
    break: "휴식 시간",
    question: "퀴즈 진행",
    quiz_question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    quiz_results: "결과 공개",
    qna: "질문 접수 중",
    qna_waiting: "질문 접수 중",
    qna_question: "현장 질문",
    draw: "럭키드로우 준비",
    lucky_draw_ready: "럭키드로우 준비",
    draw_winner: "당첨자 발표",
    lucky_draw_winner: "당첨자 발표",
  };

  return labels[scene ?? ""] ?? "송출 준비 중";
}

function Shell({
  state,
  children,
}: {
  state: ScreenState | null;
  children: ReactNode;
}) {
  const accentColor = state?.event.primary_color || "#06b6d4";

  return (
    <main className="min-h-screen bg-[#0a1a38] p-5 text-white sm:p-8">
      <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-5 sm:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase text-cyan-200">
              Live Screen
            </p>
            <h1 className="mt-2 truncate text-4xl font-black sm:text-6xl">
              {state?.event.title ?? "Dorae Quiz Live"}
            </h1>
            {state?.event.subtitle && (
              <p className="mt-2 text-2xl font-bold text-slate-300">
                {state.event.subtitle}
              </p>
            )}
          </div>
          <div
            className="rounded-3xl border border-white/15 bg-white/10 px-6 py-4 text-right"
            style={{ boxShadow: `inset 0 0 0 2px ${accentColor}33` }}
          >
            <p className="text-sm font-black text-slate-200">현재 송출</p>
            <p className="mt-1 text-3xl font-black text-emerald-200">
              {sceneLabel(state?.liveState.screen_scene ?? state?.liveState.mode)}
            </p>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function WaitingView({ state }: { state: ScreenState }) {
  const title = state.notice?.title || "잠시 후 시작합니다";
  const message =
    state.notice?.message || "QR을 통해 입장하고 진행자의 안내를 기다려 주세요";

  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_26rem]">
      <div className="flex flex-col justify-center rounded-3xl bg-white p-8 text-[color:#0a1a38] shadow-2xl sm:p-14">
        <p className="text-2xl font-black text-cyan-800">
          대기 화면
        </p>
        <h2 className="mt-6 text-6xl font-black leading-tight sm:text-9xl">
          {title}
        </h2>
        <p className="mt-6 text-3xl font-bold leading-tight text-slate-600">
          {message}
        </p>
        <p className="mt-8 break-all rounded-3xl border border-slate-200 bg-slate-50 p-6 text-5xl font-black text-[color:#0a1a38]">
          /e/{state.event.event_code}
        </p>
      </div>

      <aside className="grid content-start gap-5">
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
          <p className="text-sm font-black text-slate-200">현장 안내</p>
          <p className="mt-4 text-3xl font-black leading-tight">
            {state.event.screen_notice || "현장 안내를 기다려 주세요"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
          <p className="text-sm font-black text-slate-200">장소</p>
          <p className="mt-4 text-4xl font-black">
            {state.event.venue || "Live Event"}
          </p>
        </div>
      </aside>
    </section>
  );
}

function BreakView({ state }: { state: ScreenState }) {
  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 text-center text-[color:#0a1a38] shadow-2xl">
      <div>
        <p className="text-3xl font-black text-amber-800">휴식 시간</p>
        <h2 className="mt-6 text-6xl font-black leading-tight sm:text-9xl">
          {state.notice?.title || "잠시 쉬는 시간입니다"}
        </h2>
        <p className="mt-6 text-3xl font-bold leading-tight text-slate-600">
          {state.notice?.message || "곧 다시 시작합니다"}
        </p>
        <p className="mt-10 text-4xl font-black text-cyan-700">
          {state.event.title}
        </p>
      </div>
    </section>
  );
}

function QuestionView({
  state,
  secondsLeft,
}: {
  state: ScreenState;
  secondsLeft: number | null;
}) {
  if (!state.question) {
    return <WaitingView state={state} />;
  }

  const closed = secondsLeft !== null && secondsLeft <= 0;

  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col justify-between rounded-3xl bg-white p-6 text-[color:#0a1a38] shadow-2xl sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="rounded-full bg-cyan-100 px-6 py-3 text-2xl font-black text-cyan-800">
            퀴즈 진행
          </span>
          <span
            className={`rounded-full px-6 py-3 text-2xl font-black ${
              closed
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {closed ? "응답 마감" : `${secondsLeft ?? state.question.time_limit_seconds}초`}
          </span>
        </div>

        <h2 className="my-10 text-5xl font-black leading-tight sm:text-7xl">
          {state.question.question_text}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {optionEntries(state.question).map((option) => (
            <div
              key={option.number}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-3xl font-black"
            >
              {option.number}. {option.label}
            </div>
          ))}
        </div>
      </div>

      <StatsPanel state={state} />
    </section>
  );
}

function ClosedView({ state }: { state: ScreenState }) {
  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col justify-center rounded-3xl bg-white p-8 text-center text-[color:#0a1a38] shadow-2xl sm:p-12">
        <p className="text-3xl font-black text-amber-800">응답 마감</p>
        <h2 className="mt-6 text-7xl font-black leading-tight sm:text-9xl">
          응답 마감
        </h2>
        <p className="mt-6 text-3xl font-bold text-slate-600">
          잠시 후 결과를 공개합니다
        </p>
      </div>
      <StatsPanel state={state} />
    </section>
  );
}

function ResultView({ state }: { state: ScreenState }) {
  const question = state.question;
  const correctOption = question?.correct_option;

  return (
    <section className="grid flex-1 gap-5 lg:grid-cols-[1fr_24rem]">
      <div className="flex flex-col justify-between rounded-3xl bg-white p-6 text-[color:#0a1a38] shadow-2xl sm:p-10">
        <div>
          <p className="text-2xl font-black text-emerald-800">
            결과 공개
          </p>
          <h2 className="mt-5 text-5xl font-black leading-tight sm:text-7xl">
            {question?.question_text ?? "결과 화면"}
          </h2>
        </div>

        {question ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {optionEntries(question).map((option) => {
              const isCorrect = correctOption === option.number;

              return (
                <div
                  key={option.number}
                  className={`rounded-3xl border p-6 text-3xl font-black ${
                    isCorrect
                      ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {option.number}. {option.label}
                  {isCorrect && <span className="ml-3 text-2xl">정답</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-4xl font-black">
            표시할 문제가 없습니다
          </p>
        )}

        {!correctOption && (
          <p className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-2xl font-black text-amber-800">
            정답은 아직 공개되지 않았습니다
          </p>
        )}
      </div>

      <StatsPanel state={state} />
    </section>
  );
}

function DrawWinnerView({ state }: { state: ScreenState }) {
  const draw = state.draw;

  if (!draw) {
    return <DrawPreparingView state={state} />;
  }

  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-8 text-center text-[color:#0a1a38] shadow-2xl sm:p-12">
      <div className="w-full">
        <p className="text-3xl font-black uppercase tracking-normal text-amber-600">
          {sourceLabel(draw.source_type)}
        </p>
        <h2 className="mt-6 text-6xl font-black leading-tight text-[color:#0a1a38] sm:text-8xl">
          축하합니다
        </h2>
        <div className="mx-auto mt-10 max-w-5xl rounded-3xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-3xl font-black text-amber-700">당첨 경품</p>
          <p className="mt-4 text-5xl font-black leading-tight text-[color:#0a1a38] sm:text-7xl">
            {draw.prize_name}
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-5xl rounded-3xl border border-cyan-200 bg-cyan-50 p-8">
          <p className="text-3xl font-black text-cyan-700">당첨자</p>
          <p className="mt-4 break-words text-7xl font-black leading-tight text-cyan-950 sm:text-9xl">
            {draw.participant_display_name}
          </p>
        </div>
      </div>
    </section>
  );
}

function DrawPreparingView({ state }: { state: ScreenState }) {
  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 text-center text-[color:#0a1a38] shadow-2xl">
      <div>
        <p className="text-3xl font-black uppercase text-amber-700">
          럭키드로우 준비
        </p>
        <h2 className="mt-6 text-7xl font-black sm:text-9xl">
          추첨 준비 중
        </h2>
        <p className="mt-6 text-3xl font-bold text-slate-600">
          {state.event.title}
        </p>
      </div>
    </section>
  );
}

function QnaQuestionView({ state }: { state: ScreenState }) {
  const qna = state.qna;

  if (!qna) {
    return <QnaWaitingView state={state} />;
  }

  const meta = [qna.organization, qna.group_name].filter(Boolean).join(" · ");

  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-8 text-[color:#0a1a38] shadow-2xl sm:p-12">
      <div className="w-full">
        <p className="text-3xl font-black uppercase tracking-normal text-cyan-700">
          현장 질문
        </p>
        <div className="mt-8 rounded-3xl border border-cyan-200 bg-cyan-50 p-8 sm:p-10">
          <p className="text-3xl font-black text-cyan-800">현장 질문</p>
          <h2 className="mt-6 break-words text-5xl font-black leading-tight text-[color:#0a1a38] sm:text-8xl">
            {qna.question_text}
          </h2>
        </div>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-7">
          <div>
            <p className="text-2xl font-black text-slate-700">질문자</p>
            <p className="mt-2 text-5xl font-black text-[color:#0a1a38]">
              {qna.participant_display_name}
            </p>
            {meta && (
              <p className="mt-3 text-2xl font-bold text-slate-600">{meta}</p>
            )}
          </div>
          <p className="text-2xl font-black text-cyan-700">
            관리자 승인 완료
          </p>
        </div>
      </div>
    </section>
  );
}

function QnaWaitingView({ state }: { state: ScreenState }) {
  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 text-center text-[color:#0a1a38] shadow-2xl">
      <div>
        <p className="text-3xl font-black uppercase text-cyan-700">
          질문 접수 중
        </p>
        <h2 className="mt-6 text-6xl font-black leading-tight sm:text-9xl">
          질문을 기다리는 중입니다
        </h2>
        <p className="mt-6 text-3xl font-bold leading-tight text-slate-600">
          QR을 통해 질문을 남겨주세요
        </p>
        <p className="mx-auto mt-8 max-w-4xl break-all rounded-3xl border border-slate-200 bg-slate-50 p-6 text-5xl font-black text-[color:#0a1a38]">
          /e/{state.event.event_code}
        </p>
      </div>
    </section>
  );
}

function PlaceholderView({
  state,
  title,
  description,
}: {
  state: ScreenState;
  title: string;
  description: string;
}) {
  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 text-center text-[color:#0a1a38] shadow-2xl">
      <div>
        <p className="text-3xl font-black text-cyan-800">
          {state.event.event_code}
        </p>
        <h2 className="mt-6 text-7xl font-black sm:text-9xl">{title}</h2>
        <p className="mt-6 text-3xl font-bold text-slate-600">{description}</p>
      </div>
    </section>
  );
}

function StatsPanel({ state }: { state: ScreenState }) {
  return (
    <aside className="grid content-start gap-5">
      <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
        <p className="text-sm font-black text-slate-200">총 응답</p>
        <p className="mt-4 text-7xl font-black">{state.stats.total_answers}</p>
      </div>
      <div className="rounded-3xl border border-white/15 bg-white/10 p-6">
        <p className="text-sm font-black text-slate-200">선택지별 응답</p>
        <div className="mt-5 grid gap-3 text-3xl font-black">
          {(["1", "2", "3", "4"] as const).map((option) => (
            <p key={option}>
              {option}번: {state.stats.option_counts[option]}
            </p>
          ))}
        </div>
      </div>
      {typeof state.stats.correct_answers === "number" && (
        <div className="rounded-3xl border border-emerald-300/30 bg-emerald-400/15 p-6">
          <p className="text-sm font-black text-emerald-100">정답</p>
          <p className="mt-4 text-7xl font-black text-emerald-200">
            {state.stats.correct_answers}
          </p>
        </div>
      )}
    </aside>
  );
}

export default function ScreenStage({ eventCode }: ScreenStageProps) {
  const [state, setState] = useState<ScreenState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchState() {
      try {
        const response = await fetch(
          `/api/screen/${encodeURIComponent(eventCode)}/state`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("screen-state request failed");
        }

        const nextState = (await response.json()) as ScreenState;

        if (active) {
          setState(nextState);
          setError(null);
        }
      } catch {
        if (active) {
          setError("송출 상태를 불러오지 못했습니다.");
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
    () =>
      now === null
        ? null
        : getSecondsLeft(state?.liveState.question_ends_at ?? null, now),
    [state?.liveState.question_ends_at, now]
  );
  const scene = state?.liveState.screen_scene ?? state?.liveState.mode;

  if (!state) {
    return (
      <Shell state={null}>
        <section className="flex flex-1 items-center justify-center rounded-3xl bg-white p-10 text-center text-[color:#0a1a38] shadow-2xl">
          <div>
            <p className="text-3xl font-black uppercase text-cyan-700">
              {eventCode}
            </p>
            <h2 className="mt-6 text-6xl font-black">송출 준비 중</h2>
            {error && (
              <p className="mt-6 text-2xl font-bold text-rose-700">{error}</p>
            )}
          </div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell state={state}>
      {scene === "inactive" && (
        <PlaceholderView
          state={state}
          title="비활성 행사"
          description="현재 참가자 입장과 송출을 준비 중입니다."
        />
      )}
      {scene === "waiting" && <WaitingView state={state} />}
      {scene === "break" && <BreakView state={state} />}
      {scene === "question" && (
        <QuestionView state={state} secondsLeft={secondsLeft} />
      )}
      {scene === "closed" && <ClosedView state={state} />}
      {scene === "result" && <ResultView state={state} />}
      {scene === "draw_winner" && <DrawWinnerView state={state} />}
      {scene === "draw" && <DrawPreparingView state={state} />}
      {scene === "qna_question" && <QnaQuestionView state={state} />}
      {(scene === "qna" || scene === "qna_waiting") && (
        <QnaWaitingView state={state} />
      )}
      {![
        "inactive",
        "waiting",
        "break",
        "question",
        "closed",
        "result",
        "draw",
        "draw_winner",
        "qna_question",
        "qna",
        "qna_waiting",
      ].includes(scene ?? "") && <WaitingView state={state} />}
    </Shell>
  );
}
