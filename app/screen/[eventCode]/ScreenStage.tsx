"use client";

import { QrCode } from "@/components/quiz/QrCode";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
  state_updated_at: string | null;
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
    animation_id: string;
    participant_display_name: string;
    winner_name: string;
    prize_name: string;
    prize_title: string;
    source_type: string;
    draw_phase: "ready" | "rolling" | "result";
    candidate_names: string[];
    message: string | null;
    duration_ms: number;
    countdown_seconds: number;
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
  joinQr: {
    event_code: string;
    join_url: string;
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
  initialState?: ScreenState | null;
};

const SCREEN_POLL_DELAY_MS = 400;

function getSecondsLeft(questionEndsAt: string | null, now: number) {
  if (!questionEndsAt) {
    return null;
  }

  return Math.max(0, Math.ceil((new Date(questionEndsAt).getTime() - now) / 1000));
}

function isOlderState(
  nextUpdatedAt: string | null | undefined,
  currentUpdatedAt: string | null
) {
  if (!nextUpdatedAt || !currentUpdatedAt) {
    return false;
  }

  const nextTime = Date.parse(nextUpdatedAt);
  const currentTime = Date.parse(currentUpdatedAt);

  if (Number.isNaN(nextTime) || Number.isNaN(currentTime)) {
    return false;
  }

  return nextTime < currentTime;
}

function optionEntries(question: NonNullable<ScreenState["question"]>) {
  return [
    { number: 1, label: question.option_1 },
    { number: 2, label: question.option_2 },
    { number: 3, label: question.option_3 },
    { number: 4, label: question.option_4 },
  ];
}

function screenStateFingerprint(state: ScreenState) {
  return JSON.stringify({
    updated_at: state.state_updated_at,
    mode: state.liveState.mode,
    screen_scene: state.liveState.screen_scene,
    question_started_at: state.liveState.question_started_at,
    question_ends_at: state.liveState.question_ends_at,
    reveal_answer: state.liveState.reveal_answer,
    show_results: state.liveState.show_results,
    question_id: state.question?.id ?? null,
    draw_winner_id: state.draw?.winner_id ?? null,
    draw_animation_id: state.draw?.animation_id ?? null,
    draw_phase: state.draw?.draw_phase ?? null,
    draw_candidate_names: state.draw?.candidate_names ?? [],
    draw_duration_ms: state.draw?.duration_ms ?? null,
    draw_countdown_seconds: state.draw?.countdown_seconds ?? null,
    qna_question_id: state.qna?.qna_question_id ?? null,
    notice_title: state.notice?.title ?? null,
    notice_message: state.notice?.message ?? null,
    join_url: state.joinQr?.join_url ?? null,
    stats_total_answers: state.stats.total_answers,
    stats_option_counts: state.stats.option_counts,
    stats_correct_answers: state.stats.correct_answers ?? null,
  });
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
    join_qr: "QR 참여 안내",
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
  const currentSceneLabel =
    state?.draw?.draw_phase === "rolling"
      ? "추첨 연출"
      : sceneLabel(state?.liveState.screen_scene ?? state?.liveState.mode);

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
              {currentSceneLabel}
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

function normalizeScene(scene: string | null | undefined) {
  const sceneAliases: Record<string, string> = {
    quiz_question: "question",
    quiz_results: "result",
    lucky_draw_ready: "draw",
    lucky_draw_winner: "draw_winner",
  };

  return scene ? (sceneAliases[scene] ?? scene) : scene;
}

type DrawPayload = NonNullable<ScreenState["draw"]>;
type DrawAnimationStep = "countdown" | "rolling" | "result";
type ConfettiParticle = {
  id: number;
  shape: "dot" | "capsule" | "rect";
  color: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  opacity: number;
  delayMs: number;
  durationMs: number;
  burstX: number;
  burstY: number;
  fallX: number;
  fallY: number;
  rotateDeg: number;
  radius: string;
  glowPx: number;
};

const CONFETTI_COLORS = [
  "#ec4899",
  "#22d3ee",
  "#facc15",
  "#f97316",
  "#a855f7",
  "#38bdf8",
  "#ef4444",
  "#facc15",
  "#f59e0b",
  "#fde68a",
  "#ffffff",
];
const CONFETTI_COUNT = 220;
const CELEBRATION_DURATION_MS = 4000;

function normalizeCandidateNames(
  candidateNames: string[],
  participantDisplayName: string
) {
  const names = Array.from(
    new Set(
      [...candidateNames, participantDisplayName]
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

  return names.length > 0 ? names : [participantDisplayName];
}

function drawAnimationKey(draw: DrawPayload, stateUpdatedAt?: string | null) {
  return [
    draw.animation_id,
    draw.winner_id,
    draw.participant_display_name,
    draw.prize_name,
    draw.created_at,
    stateUpdatedAt,
    draw.duration_ms,
    draw.countdown_seconds,
    draw.candidate_names.join("|"),
  ].join(":");
}

function seededRatio(seed: string, index: number, salt: number) {
  let hash = 2166136261;
  const input = `${seed}:${index}:${salt}`;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function buildConfettiParticles(seed: string): ConfettiParticle[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const shapeSeed = seededRatio(seed, index, 2);
    const shape =
      shapeSeed > 0.76 ? "dot" : shapeSeed > 0.38 ? "capsule" : "rect";
    const angle = seededRatio(seed, index, 3) * Math.PI * 2;
    const burstDistance = 170 + seededRatio(seed, index, 4) * 340;
    const fallDistance = 620 + seededRatio(seed, index, 5) * 520;
    const startX = 40 + seededRatio(seed, index, 6) * 20;
    const startY = 52 + seededRatio(seed, index, 7) * 12;
    const baseSize = 9 + Math.round(seededRatio(seed, index, 8) * 13);
    const sideDrift = (seededRatio(seed, index, 9) - 0.5) * 180;
    const burstX = Math.cos(angle) * burstDistance;
    const burstY = Math.sin(angle) * burstDistance * 0.72 - 70;

    return {
      id: index,
      shape,
      color:
        CONFETTI_COLORS[
          Math.floor(seededRatio(seed, index, 1) * CONFETTI_COLORS.length)
        ] ?? "#f59e0b",
      startX,
      startY,
      width:
        shape === "capsule"
          ? 22 + Math.round(seededRatio(seed, index, 10) * 24)
          : shape === "rect"
            ? 14 + Math.round(seededRatio(seed, index, 11) * 30)
            : baseSize,
      height:
        shape === "capsule"
          ? 7 + Math.round(seededRatio(seed, index, 12) * 6)
          : shape === "rect"
            ? 8 + Math.round(seededRatio(seed, index, 13) * 18)
            : baseSize,
      opacity: 0.76 + seededRatio(seed, index, 14) * 0.18,
      delayMs: Math.round(seededRatio(seed, index, 15) * 250),
      durationMs: 3200 + Math.round(seededRatio(seed, index, 16) * 800),
      burstX: Math.round(burstX),
      burstY: Math.round(burstY),
      fallX: Math.round(burstX * 1.16 + sideDrift),
      fallY: Math.round(fallDistance),
      rotateDeg: Math.round((seededRatio(seed, index, 17) - 0.5) * 1160),
      radius: shape === "dot" ? "9999px" : shape === "capsule" ? "9999px" : "3px",
      glowPx: 2 + Math.round(seededRatio(seed, index, 18) * 7),
    };
  });
}

function CelebrationStyles() {
  return (
    <style>{`
      @keyframes doraeConfettiBurst {
        0% {
          opacity: 0;
          transform: translate3d(-50%, -50%, 0)
            rotate(var(--rotate-start))
            scale(0.42);
        }
        8% {
          opacity: var(--particle-opacity);
        }
        25% {
          opacity: var(--particle-opacity);
          transform: translate3d(
              calc(-50% + var(--burst-x)),
              calc(-50% + var(--burst-y)),
              0
            )
            rotate(var(--rotate-mid))
            scale(1);
        }
        72% {
          opacity: calc(var(--particle-opacity) * 0.78);
        }
        100% {
          opacity: 0;
          transform: translate3d(
              calc(-50% + var(--fall-x)),
              calc(-50% + var(--fall-y)),
              0
            )
            rotate(var(--rotate-end))
            scale(0.82);
        }
      }

      @keyframes doraeWinnerPop {
        0% {
          transform: scale(0.96);
          opacity: 0.82;
        }
        48% {
          transform: scale(1.04);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes doraeWinnerGlow {
        0% {
          box-shadow: 0 0 0 rgba(250, 204, 21, 0);
          transform: scale(0.992);
        }
        35% {
          box-shadow:
            0 0 0 8px rgba(250, 204, 21, 0.16),
            0 0 58px rgba(245, 158, 11, 0.24),
            0 24px 62px rgba(10, 26, 56, 0.16);
          transform: scale(1.008);
        }
        100% {
          box-shadow: 0 0 0 rgba(250, 204, 21, 0);
          transform: scale(1);
        }
      }

      .dorae-confetti-particle {
        animation-name: doraeConfettiBurst;
        animation-fill-mode: both;
        animation-timing-function: cubic-bezier(0.13, 0.82, 0.28, 1);
        box-shadow:
          0 0 var(--particle-glow) currentColor,
          0 0 calc(var(--particle-glow) * 1.2) rgba(250, 204, 21, 0.1);
      }

      .dorae-winner-pop {
        animation: doraeWinnerPop 980ms cubic-bezier(0.18, 0.84, 0.32, 1) both;
      }

      .dorae-winner-glow {
        animation: doraeWinnerGlow 2600ms ease-out both;
      }

      @media (prefers-reduced-motion: reduce) {
        .dorae-confetti-particle {
          display: none;
        }

        .dorae-winner-pop,
        .dorae-winner-glow {
          animation: none;
        }
      }
    `}</style>
  );
}

function CelebrationOverlay({ celebrationKey }: { celebrationKey: string }) {
  const [visible, setVisible] = useState(true);
  const particles = useMemo(
    () => buildConfettiParticles(celebrationKey),
    [celebrationKey]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setVisible(false),
      CELEBRATION_DURATION_MS
    );

    return () => window.clearTimeout(timeoutId);
  }, [celebrationKey]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="dorae-confetti-particle absolute"
          style={
            {
              left: `${particle.startX}vw`,
              top: `${particle.startY}vh`,
              width: `${particle.width}px`,
              height: `${particle.height}px`,
              backgroundColor: particle.color,
              color: particle.color,
              borderRadius: particle.radius,
              opacity: particle.opacity,
              animationDelay: `${particle.delayMs}ms`,
              animationDuration: `${particle.durationMs}ms`,
              "--burst-x": `${particle.burstX}px`,
              "--burst-y": `${particle.burstY}px`,
              "--fall-x": `${particle.fallX}px`,
              "--fall-y": `${particle.fallY}px`,
              "--rotate-start": `${Math.round(particle.rotateDeg * -0.16)}deg`,
              "--rotate-mid": `${Math.round(particle.rotateDeg * 0.36)}deg`,
              "--rotate-end": `${particle.rotateDeg}deg`,
              "--particle-opacity": particle.opacity,
              "--particle-glow": `${particle.glowPx}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function DrawResultView({
  draw,
  celebrationKey,
}: {
  draw: DrawPayload;
  celebrationKey: string;
}) {
  return (
    <section className="relative isolate flex flex-1 items-center justify-center overflow-visible rounded-3xl bg-white p-8 text-center text-[color:#0a1a38] shadow-2xl sm:p-12">
      <CelebrationStyles />
      <CelebrationOverlay key={celebrationKey} celebrationKey={celebrationKey} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(250, 204, 21, 0.20), rgba(254, 243, 199, 0.12) 28%, rgba(103, 232, 249, 0.08) 48%, transparent 70%)",
        }}
      />
      <div className="relative z-50 w-full">
        <p className="text-3xl font-black uppercase tracking-normal text-amber-600">
          {sourceLabel(draw.source_type)}
        </p>
        <h2 className="dorae-winner-pop mt-6 text-7xl font-black leading-tight text-[color:#0a1a38] drop-shadow-[0_14px_30px_rgba(255,255,255,0.90)] sm:text-9xl">
          당첨!
        </h2>
        <div className="mx-auto mt-10 max-w-5xl rounded-3xl border border-amber-200 bg-amber-50 p-8">
          <p className="text-3xl font-black text-amber-700">당첨 경품</p>
          <p className="mt-4 text-5xl font-black leading-tight text-[color:#0a1a38] drop-shadow-[0_8px_16px_rgba(255,255,255,0.85)] sm:text-7xl">
            {draw.prize_name}
          </p>
        </div>
        <div className="dorae-winner-glow mx-auto mt-8 max-w-5xl rounded-3xl border border-amber-200 bg-gradient-to-br from-white via-amber-50 to-cyan-50 p-8">
          <p className="text-3xl font-black text-amber-700">당첨자</p>
          <p className="mt-4 break-words text-7xl font-black leading-tight text-cyan-950 drop-shadow-[0_10px_20px_rgba(255,255,255,0.95)] sm:text-9xl">
            {draw.participant_display_name}
          </p>
        </div>
      </div>
    </section>
  );
}

function RollingDrawView({
  draw,
  animationKey,
}: {
  draw: DrawPayload;
  animationKey: string;
}) {
  const candidateNamesKey = draw.candidate_names.join("\u0001");
  const candidates = useMemo(
    () =>
      normalizeCandidateNames(
        candidateNamesKey ? candidateNamesKey.split("\u0001") : [],
        draw.participant_display_name
      ),
    [candidateNamesKey, draw.participant_display_name]
  );
  const [step, setStep] = useState<DrawAnimationStep>("countdown");
  const [countdown, setCountdown] = useState(draw.countdown_seconds);
  const [rollingName, setRollingName] = useState(
    candidates[0] ?? draw.participant_display_name
  );

  useEffect(() => {
    let active = true;
    const timers: number[] = [];
    const countdownSeconds = Math.max(1, draw.countdown_seconds);
    const countdownMs = countdownSeconds * 1000;
    const totalDurationMs = Math.max(draw.duration_ms, countdownMs + 1800);
    const rollingDurationMs = Math.max(1800, totalDurationMs - countdownMs);

    for (let secondsLeft = countdownSeconds; secondsLeft >= 1; secondsLeft -= 1) {
      timers.push(
        window.setTimeout(() => {
          if (active) {
            setCountdown(secondsLeft);
          }
        }, (countdownSeconds - secondsLeft) * 1000)
      );
    }

    timers.push(
      window.setTimeout(() => {
        if (!active) {
          return;
        }

        setStep("rolling");
        const startedAt = Date.now();
        let index = 0;

        function tick() {
          if (!active) {
            return;
          }

          const elapsed = Date.now() - startedAt;

          if (elapsed >= rollingDurationMs) {
            setStep("result");
            setRollingName(draw.participant_display_name);
            return;
          }

          index = (index + 1) % candidates.length;
          setRollingName(candidates[index] ?? draw.participant_display_name);

          const progress = Math.min(1, elapsed / rollingDurationMs);
          const nextDelay = 55 + Math.round(progress * progress * 360);
          timers.push(window.setTimeout(tick, nextDelay));
        }

        tick();
      }, countdownMs)
    );

    timers.push(
      window.setTimeout(() => {
        if (active) {
          setStep("result");
          setRollingName(draw.participant_display_name);
        }
      }, totalDurationMs)
    );

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    animationKey,
    candidates,
    draw.countdown_seconds,
    draw.duration_ms,
    draw.participant_display_name,
  ]);

  if (step === "result") {
    return <DrawResultView draw={draw} celebrationKey={animationKey} />;
  }

  return (
    <section className="flex flex-1 items-center justify-center rounded-3xl border border-white/15 bg-white/10 p-8 text-center shadow-2xl sm:p-12">
      <div className="w-full">
        <p className="text-3xl font-black text-amber-200">
          {draw.message || "두구두구... 곧 당첨자를 공개합니다."}
        </p>
        <h2 className="mt-5 text-6xl font-black leading-tight sm:text-8xl">
          {step === "countdown" ? "추첨을 시작합니다" : "추첨 중"}
        </h2>

        <div className="mx-auto mt-8 max-w-5xl rounded-3xl bg-white p-8 text-[color:#0a1a38] shadow-2xl">
          <p className="text-2xl font-black text-amber-700">경품</p>
          <p className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
            {draw.prize_name}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-5xl rounded-3xl border border-cyan-100 bg-cyan-50 p-8 text-[color:#0a1a38] shadow-2xl">
          {step === "countdown" ? (
            <>
              <p className="text-2xl font-black text-cyan-800">카운트다운</p>
              <p className="mt-2 text-9xl font-black leading-none text-cyan-950 sm:text-[12rem]">
                {countdown}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black text-cyan-800">후보 확인 중</p>
              <p className="mt-4 break-words text-7xl font-black leading-tight text-cyan-950 sm:text-9xl">
                {rollingName}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function DrawWinnerView({ state }: { state: ScreenState }) {
  const draw = state.draw;

  if (!draw) {
    return <DrawPreparingView state={state} />;
  }

  const animationKey = drawAnimationKey(draw, state.state_updated_at);

  if (draw.draw_phase === "rolling") {
    return (
      <RollingDrawView
        key={animationKey}
        draw={draw}
        animationKey={animationKey}
      />
    );
  }

  return (
    <DrawResultView
      key={animationKey}
      draw={draw}
      celebrationKey={animationKey}
    />
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

function JoinQrView({ state }: { state: ScreenState }) {
  const joinUrl = state.joinQr?.join_url || `/e/${state.event.event_code}/join`;
  const title = state.joinQr?.title || state.event.title;
  const message =
    state.joinQr?.message || "휴대폰 카메라로 QR을 스캔해 참여해 주세요";

  return (
    <section className="grid flex-1 gap-6 lg:grid-cols-[1fr_34rem] lg:items-center">
      <div className="flex flex-col justify-center rounded-3xl bg-white p-8 text-[color:#0a1a38] shadow-2xl sm:p-12">
        <p className="text-3xl font-black text-cyan-800">QR로 참여하기</p>
        <h2 className="mt-6 text-6xl font-black leading-tight sm:text-8xl">
          {title}
        </h2>
        <p className="mt-6 text-3xl font-bold leading-tight text-slate-700">
          {message}
        </p>
        <p className="mt-6 text-2xl font-black leading-tight text-cyan-800">
          참가자 등록 후 퀴즈와 Q&A에 참여할 수 있습니다.
        </p>
        <p className="mt-8 break-all rounded-3xl border border-slate-200 bg-slate-50 p-6 text-3xl font-black text-[color:#0a1a38]">
          {joinUrl}
        </p>
      </div>

      <aside className="rounded-3xl border border-white/20 bg-white p-6 shadow-2xl">
        <QrCode
          value={joinUrl}
          title="참가자 등록 QR"
          className="mx-auto h-auto w-full max-w-[30rem]"
        />
        <p className="mt-5 text-center text-2xl font-black text-[color:#0a1a38]">
          휴대폰 카메라로 스캔
        </p>
      </aside>
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

export default function ScreenStage({
  eventCode,
  initialState = null,
}: ScreenStageProps) {
  const [state, setState] = useState<ScreenState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const latestStateUpdatedAtRef = useRef<string | null>(
    initialState?.state_updated_at ?? null
  );
  const latestFingerprintRef = useRef<string | null>(
    initialState ? screenStateFingerprint(initialState) : null
  );
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const pollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    function scheduleNextPoll() {
      if (!active) {
        return;
      }

      pollTimeoutRef.current = window.setTimeout(
        fetchState,
        SCREEN_POLL_DELAY_MS
      );
    }

    async function fetchState() {
      if (inFlightRef.current) {
        scheduleNextPoll();
        return;
      }

      inFlightRef.current = true;
      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;

      try {
        const response = await fetch(
          `/api/screen/${encodeURIComponent(eventCode)}/state`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("screen-state request failed");
        }

        const nextState = (await response.json()) as ScreenState;
        const nextFingerprint = screenStateFingerprint(nextState);

        if (
          active &&
          requestSeq === requestSeqRef.current &&
          nextFingerprint !== latestFingerprintRef.current &&
          !isOlderState(
            nextState.state_updated_at,
            latestStateUpdatedAtRef.current
          )
        ) {
          latestStateUpdatedAtRef.current =
            nextState.state_updated_at ?? latestStateUpdatedAtRef.current;
          latestFingerprintRef.current = nextFingerprint;
          setState(nextState);
          setError(null);
        } else if (active) {
          setError(null);
        }
      } catch {
        if (active) {
          setError("송출 상태를 불러오지 못했습니다.");
        }
      } finally {
        inFlightRef.current = false;
        scheduleNextPoll();
      }
    }

    fetchState();

    return () => {
      active = false;
      inFlightRef.current = false;
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
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
  const scene = normalizeScene(
    state?.liveState.screen_scene ?? state?.liveState.mode
  );

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
      {scene === "join_qr" && <JoinQrView state={state} />}
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
        "join_qr",
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
