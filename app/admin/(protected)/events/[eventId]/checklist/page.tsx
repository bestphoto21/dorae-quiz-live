import Link from "next/link";
import { AdminPanel, AdminShell, StatusBadge } from "@/components/quiz/ui";
import { requireEventAccess } from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type OperationChecklistPageProps = {
  params: Promise<{ eventId: string }>;
};

type ChecklistStatus = "ok" | "warn" | "danger";

type ChecklistLink = {
  href: string;
  label: string;
  external?: boolean;
};

type ChecklistItem = {
  title: string;
  status: ChecklistStatus;
  description: string;
  currentValue: string;
  action: string;
  links: ChecklistLink[];
};

type LiveStateSummary = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

type QuizSummary = {
  sessionCount: number;
  questionCount: number;
  emptySessionCount: number;
};

type SurveySummary = {
  formCount: number;
  draftCount: number;
  openCount: number;
  closedCount: number;
  questionCount: number;
  formsWithQuestions: number;
  responseCount: number;
};

type QnaSummary = {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
  deleted: number;
};

type DrawSummary = {
  prizeCount: number;
  totalQuantity: number;
  winnerCount: number;
  activeWinnerCount: number;
  remainingQuantity: number;
};

const EVENT_CODE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const MANUAL_CHECK_ITEMS = [
  {
    id: "screen-connected",
    label: "행사장 스크린이 연결되어 있다",
  },
  {
    id: "audio-checked",
    label: "스크린 PC 오디오 출력이 확인되었다",
  },
  {
    id: "qr-visible",
    label: "QR이 화면에서 잘 보인다",
  },
  {
    id: "mobile-join-tested",
    label: "참가자 휴대폰으로 QR 접속 테스트 완료",
  },
  {
    id: "survey-submit-tested",
    label: "설문 제출 테스트 완료",
  },
  {
    id: "draw-tested",
    label: "럭키드로우 테스트 완료",
  },
  {
    id: "csv-tested",
    label: "CSV 다운로드 테스트 완료",
  },
  {
    id: "rehearsal-reset-reviewed",
    label: "리허설 데이터 초기화 여부 확인 완료",
  },
];

function statusTone(status: ChecklistStatus) {
  if (status === "ok") {
    return "green";
  }

  if (status === "danger") {
    return "rose";
  }

  return "amber";
}

function statusLabel(status: ChecklistStatus) {
  if (status === "ok") {
    return "정상";
  }

  if (status === "danger") {
    return "위험";
  }

  return "확인 필요";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
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
    question: "퀴즈 문제 화면",
    closed: "응답 마감 화면",
    result: "결과 화면",
    qna: "Q&A 대기 화면",
    qna_waiting: "Q&A 대기 화면",
    qna_question: "승인 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    draw_winner: "당첨자 발표 화면",
    join_qr: "QR 참여 안내 화면",
    survey_intro: "설문 참여 안내 화면",
    survey_active: "설문 진행 화면",
    survey_status: "설문 제출 현황 화면",
    survey_closed: "설문 마감 화면",
  };

  return labels[scene ?? "waiting"] ?? scene ?? "대기 화면";
}

function featureLabel(value: boolean) {
  return value ? "ON" : "OFF";
}

function countText(value: number) {
  return `${value.toLocaleString("ko-KR")}건`;
}

function getBooleanSetting(value: boolean | null | undefined) {
  return value ?? true;
}

function CheckItemCard({ item }: { item: ChecklistItem }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-[color:#0a1a38]">
            {item.title}
          </h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            {item.description}
          </p>
        </div>
        <StatusBadge tone={statusTone(item.status)}>
          {statusLabel(item.status)}
        </StatusBadge>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-black text-slate-700">현재 값</p>
          <p className="mt-2 whitespace-pre-line break-words text-sm font-black leading-6 text-[color:#0a1a38]">
            {item.currentValue}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-4">
          <p className="text-xs font-black text-slate-700">권장 조치</p>
          <p className="mt-2 text-sm font-bold leading-6 text-[color:#0a1a38]">
            {item.action}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.links.map((link) => (
            <Link
              key={`${link.href}:${link.label}`}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#10284f]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4">
      <p className="text-sm font-black text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-black text-[color:#0a1a38]">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function buildManualChecklistScript(eventId: string) {
  const storageKey = `dorae-quiz-live:operation-checklist:${eventId}`;

  return `
(() => {
  const storageKey = ${JSON.stringify(storageKey)};
  const section = document.getElementById("operation-manual-checklist");
  const countNode = document.getElementById("operation-manual-count");
  const resetButton = document.getElementById("operation-manual-reset");

  if (!section || !countNode || !resetButton) {
    return;
  }

  const boxes = Array.from(
    section.querySelectorAll('input[type="checkbox"][name="manual-check"]')
  );
  const readState = () => {
    try {
      const rawValue = window.localStorage.getItem(storageKey);
      return rawValue ? JSON.parse(rawValue) : {};
    } catch {
      return {};
    }
  };
  const writeState = (state) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // localStorage can be unavailable in some hardened browser modes.
    }
  };
  let state = readState();
  const updateView = () => {
    let completed = 0;

    for (const box of boxes) {
      box.checked = Boolean(state[box.value]);
      box.closest("label")?.classList.toggle("border-emerald-300", box.checked);
      box.closest("label")?.classList.toggle("bg-emerald-50", box.checked);
      box.closest("label")?.classList.toggle("text-emerald-900", box.checked);
      box.closest("label")?.classList.toggle("border-slate-300", !box.checked);
      box.closest("label")?.classList.toggle("bg-slate-50", !box.checked);
      box.closest("label")?.classList.toggle("text-[color:#0a1a38]", !box.checked);

      if (box.checked) {
        completed += 1;
      }
    }

    countNode.textContent = completed + "/${MANUAL_CHECK_ITEMS.length} 완료";
  };

  section.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement) || target.name !== "manual-check") {
      return;
    }

    state = {
      ...state,
      [target.value]: target.checked,
    };
    writeState(state);
    updateView();
  });

  resetButton.addEventListener("click", () => {
    state = {};
    writeState(state);
    updateView();
  });

  updateView();
})();
`;
}

function ManualChecklist({ eventId }: { eventId: string }) {
  return (
    <section
      id="operation-manual-checklist"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-[color:#0a1a38]">
            운영자 최종 확인
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            장비, 오디오, 실제 휴대폰 테스트처럼 시스템이 자동으로 판단할 수
            없는 항목입니다. 체크 상태는 현재 브라우저에만 저장됩니다.
          </p>
        </div>
        <div
          id="operation-manual-count"
          className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-950"
        >
          0/{MANUAL_CHECK_ITEMS.length} 완료
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {MANUAL_CHECK_ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-black text-[color:#0a1a38] shadow-sm transition"
          >
            <input
              type="checkbox"
              name="manual-check"
              value={item.id}
              className="h-5 w-5 rounded border-slate-300"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      <button
        id="operation-manual-reset"
        type="button"
        className="mt-5 min-h-11 rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:border-[#0a1a38] hover:bg-slate-50"
      >
        체크 상태 초기화
      </button>

      <script
        dangerouslySetInnerHTML={{
          __html: buildManualChecklistScript(eventId),
        }}
      />
    </section>
  );
}

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[operation-checklist] Failed to load count.", {
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
    console.error("[operation-checklist] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as LiveStateSummary | null;
}

async function getQuizSummary(eventId: string): Promise<QuizSummary> {
  const supabase = createAdminSupabaseClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("event_id", eventId);

  if (sessionsError) {
    console.error("[operation-checklist] Failed to load quiz sessions.", {
      eventId,
      message: sessionsError.message,
      code: sessionsError.code,
    });

    return {
      sessionCount: 0,
      questionCount: 0,
      emptySessionCount: 0,
    };
  }

  const sessionIds = (sessions ?? [])
    .map((session) => session.id as string | null)
    .filter((sessionId): sessionId is string => Boolean(sessionId));

  if (sessionIds.length === 0) {
    return {
      sessionCount: 0,
      questionCount: 0,
      emptySessionCount: 0,
    };
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("session_id")
    .in("session_id", sessionIds);

  if (questionsError) {
    console.error("[operation-checklist] Failed to load question summary.", {
      eventId,
      message: questionsError.message,
      code: questionsError.code,
    });
  }

  const questionCounts = new Map<string, number>();

  for (const question of questions ?? []) {
    const sessionId = question.session_id as string | null;

    if (sessionId) {
      questionCounts.set(sessionId, (questionCounts.get(sessionId) ?? 0) + 1);
    }
  }

  return {
    sessionCount: sessionIds.length,
    questionCount: questions?.length ?? 0,
    emptySessionCount: sessionIds.filter(
      (sessionId) => (questionCounts.get(sessionId) ?? 0) === 0
    ).length,
  };
}

async function getSurveySummary(eventId: string): Promise<SurveySummary> {
  const supabase = createAdminSupabaseClient();
  const [{ data: forms, error: formsError }, responseResult] =
    await Promise.all([
      supabase
        .from("survey_forms")
        .select("id, status")
        .eq("event_id", eventId),
      supabase
        .from("survey_responses")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId),
    ]);

  if (formsError) {
    console.error("[operation-checklist] Failed to load survey forms.", {
      eventId,
      message: formsError.message,
      code: formsError.code,
    });
  }

  if (responseResult.error) {
    console.error("[operation-checklist] Failed to count survey responses.", {
      eventId,
      message: responseResult.error.message,
      code: responseResult.error.code,
    });
  }

  const formRows = forms ?? [];
  const formIds = formRows
    .map((form) => form.id as string | null)
    .filter((formId): formId is string => Boolean(formId));

  let questionCount = 0;
  let formsWithQuestions = 0;

  if (formIds.length > 0) {
    const { data: questions, error: questionsError } = await supabase
      .from("survey_questions")
      .select("survey_form_id")
      .in("survey_form_id", formIds);

    if (questionsError) {
      console.error("[operation-checklist] Failed to load survey questions.", {
        eventId,
        message: questionsError.message,
        code: questionsError.code,
      });
    }

    questionCount = questions?.length ?? 0;
    formsWithQuestions = new Set(
      (questions ?? [])
        .map((question) => question.survey_form_id as string | null)
        .filter((formId): formId is string => Boolean(formId))
    ).size;
  }

  return {
    formCount: formRows.length,
    draftCount: formRows.filter((form) => form.status === "draft").length,
    openCount: formRows.filter((form) => form.status === "open").length,
    closedCount: formRows.filter((form) => form.status === "closed").length,
    questionCount,
    formsWithQuestions,
    responseCount: responseResult.count ?? 0,
  };
}

async function getQnaSummary(eventId: string): Promise<QnaSummary> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qna_questions")
    .select("status")
    .eq("event_id", eventId);

  if (error) {
    console.error("[operation-checklist] Failed to load Q&A summary.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  const summary: QnaSummary = {
    total: data?.length ?? 0,
    pending: 0,
    approved: 0,
    hidden: 0,
    deleted: 0,
  };

  for (const item of data ?? []) {
    const status = item.status as keyof Omit<QnaSummary, "total">;

    if (status in summary) {
      summary[status] += 1;
    }
  }

  return summary;
}

async function getDrawSummary(eventId: string): Promise<DrawSummary> {
  const supabase = createAdminSupabaseClient();
  const [prizesResult, winnersResult] = await Promise.all([
    supabase.from("prizes").select("quantity").eq("event_id", eventId),
    supabase.from("draw_winners").select("status").eq("event_id", eventId),
  ]);

  if (prizesResult.error) {
    console.error("[operation-checklist] Failed to load prize summary.", {
      eventId,
      message: prizesResult.error.message,
      code: prizesResult.error.code,
    });
  }

  if (winnersResult.error) {
    console.error("[operation-checklist] Failed to load draw winner summary.", {
      eventId,
      message: winnersResult.error.message,
      code: winnersResult.error.code,
    });
  }

  const prizes = prizesResult.data ?? [];
  const winners = winnersResult.data ?? [];
  const totalQuantity = prizes.reduce(
    (sum, prize) => sum + Number(prize.quantity ?? 0),
    0
  );
  const activeWinnerCount = winners.filter((winner) =>
    ["pending", "claimed"].includes(String(winner.status ?? "pending"))
  ).length;

  return {
    prizeCount: prizes.length,
    totalQuantity,
    winnerCount: winners.length,
    activeWinnerCount,
    remainingQuantity: Math.max(totalQuantity - activeWinnerCount, 0),
  };
}

function buildChecklistItems({
  eventId,
  eventCode,
  eventTitle,
  venue,
  primaryColor,
  liveState,
  quiz,
  survey,
  qna,
  draw,
  participantCount,
  answerCount,
  participantShowQuiz,
  participantShowQna,
  participantShowSurvey,
  participantShowDraw,
  participantTitle,
  participantDescription,
  screenTitle,
  screenSubtitle,
  screenShowLogo,
}: {
  eventId: string;
  eventCode: string;
  eventTitle: string;
  venue: string | null;
  primaryColor: string | null;
  liveState: LiveStateSummary | null;
  quiz: QuizSummary;
  survey: SurveySummary;
  qna: QnaSummary;
  draw: DrawSummary;
  participantCount: number;
  answerCount: number;
  participantShowQuiz: boolean;
  participantShowQna: boolean;
  participantShowSurvey: boolean;
  participantShowDraw: boolean;
  participantTitle: string | null;
  participantDescription: string | null;
  screenTitle: string | null;
  screenSubtitle: string | null;
  screenShowLogo: boolean;
}): ChecklistItem[] {
  const eventCodeIsValid = EVENT_CODE_PATTERN.test(eventCode);
  const participantHomePath = `/e/${eventCode}`;
  const participantJoinPath = `/e/${eventCode}/join`;
  const participantPlayPath = `/e/${eventCode}/play`;
  const screenPath = `/screen/${eventCode}`;
  const settingsPath = `/admin/events/${eventId}/settings`;
  const livePath = `/admin/events/${eventId}/live`;
  const surveysPath = `/admin/events/${eventId}/surveys`;
  const qnaPath = `/admin/events/${eventId}/qna`;
  const drawPath = `/admin/events/${eventId}/draw`;
  const rehearsalPath = `/admin/events/${eventId}/rehearsal`;
  const exportsPath = `/admin/events/${eventId}/exports`;
  const questionsPath = `/admin/events/${eventId}/questions`;
  const allParticipantFeaturesOff =
    !participantShowQuiz &&
    !participantShowQna &&
    !participantShowSurvey &&
    !participantShowDraw;

  const items: ChecklistItem[] = [
    {
      title: "행사 기본정보",
      status:
        !eventTitle.trim() || !eventCode || !eventCodeIsValid
          ? "danger"
          : venue
            ? "ok"
            : "warn",
      description: "행사명, 행사 코드, 장소, 대표 색상을 확인합니다.",
      currentValue: [
        `행사명: ${eventTitle || "없음"}`,
        `event_code: ${eventCode || "없음"}`,
        `행사 코드 형식: ${eventCodeIsValid ? "정상" : "확인 필요"}`,
        `장소: ${venue || "미입력"}`,
        `대표 색상: ${primaryColor || "기본값 사용"}`,
      ].join("\n"),
      action:
        !eventTitle.trim() || !eventCode || !eventCodeIsValid
          ? "행사 설정에서 행사명과 event_code를 먼저 정리하세요."
          : venue
            ? "기본정보가 준비되어 있습니다."
            : "현장 운영 자료에 장소가 필요하면 설정에서 venue를 입력하세요.",
      links: [{ href: settingsPath, label: "행사 설정" }],
    },
    {
      title: "참가자 URL",
      status: eventCodeIsValid ? "ok" : "danger",
      description: "참가자 홈, 입장, 플레이 화면 주소를 확인합니다.",
      currentValue: eventCodeIsValid
        ? [
            `참가자 홈: ${buildPublicUrl(participantHomePath)}`,
            `입장: ${buildPublicUrl(participantJoinPath)}`,
            `플레이: ${buildPublicUrl(participantPlayPath)}`,
          ].join("\n")
        : "유효한 event_code가 없어 참가자 URL을 만들 수 없습니다.",
      action: eventCodeIsValid
        ? "실제 휴대폰으로 QR 입장과 플레이 화면 접속을 확인하세요."
        : "행사 설정에서 영문 소문자, 숫자, 하이픈으로 event_code를 정리하세요.",
      links: eventCodeIsValid
        ? [
            { href: participantHomePath, label: "참가자 홈", external: true },
            { href: participantJoinPath, label: "입장 화면", external: true },
            { href: participantPlayPath, label: "플레이 화면", external: true },
          ]
        : [{ href: settingsPath, label: "행사 설정" }],
    },
    {
      title: "스크린 URL",
      status: !eventCodeIsValid || !liveState ? "danger" : "ok",
      description: "행사장 대형 스크린 주소와 현재 송출 상태를 확인합니다.",
      currentValue: eventCodeIsValid
        ? [
            `스크린: ${buildPublicUrl(screenPath)}`,
            `현재 모드: ${liveModeLabel(liveState?.mode)}`,
            `현재 화면: ${sceneLabel(liveState?.screen_scene)}`,
            `마지막 변경: ${formatDateTime(liveState?.updated_at ?? null)}`,
          ].join("\n")
        : "유효한 event_code가 없어 스크린 URL을 만들 수 없습니다.",
      action:
        !eventCodeIsValid || !liveState
          ? "live_state가 준비되어 있는지 확인하고 라이브 콘솔에서 대기 화면을 송출하세요."
          : "스크린 PC에서 전체 화면으로 열어 실제 표시 상태를 확인하세요.",
      links: eventCodeIsValid
        ? [
            { href: screenPath, label: "스크린 열기", external: true },
            { href: livePath, label: "라이브 콘솔" },
          ]
        : [{ href: settingsPath, label: "행사 설정" }],
    },
    {
      title: "참가자 화면 설정",
      status: allParticipantFeaturesOff ? "danger" : "ok",
      description: "참가자에게 보이는 제목, 설명, 기능 버튼 표시 상태입니다.",
      currentValue: [
        `제목: ${participantTitle || eventTitle || "기본 제목 사용"}`,
        `설명: ${participantDescription || "기본 설명 사용"}`,
        `퀴즈: ${featureLabel(participantShowQuiz)}`,
        `Q&A: ${featureLabel(participantShowQna)}`,
        `설문: ${featureLabel(participantShowSurvey)}`,
        `럭키드로우 안내: ${featureLabel(participantShowDraw)}`,
      ].join("\n"),
      action: allParticipantFeaturesOff
        ? "참가자가 사용할 기능을 최소 1개 이상 켜세요."
        : "행사 성격에 맞게 켜진 기능만 참가자 화면에 표시됩니다.",
      links: [
        { href: settingsPath, label: "참가자 화면 설정" },
        ...(eventCodeIsValid
          ? [{ href: participantPlayPath, label: "참가자 화면", external: true }]
          : []),
      ],
    },
    {
      title: "스크린 화면 설정",
      status: screenTitle || screenSubtitle ? "ok" : "warn",
      description: "대형 스크린 제목, 보조 문구, 로고 표시 상태입니다.",
      currentValue: [
        `스크린 제목: ${screenTitle || eventTitle || "기본값 사용"}`,
        `스크린 보조 문구: ${screenSubtitle || "기본값 사용"}`,
        `로고 표시: ${screenShowLogo ? "표시" : "숨김"}`,
      ].join("\n"),
      action:
        screenTitle || screenSubtitle
          ? "스크린 문구가 설정되어 있습니다. 실제 스크린에서 표시를 확인하세요."
          : "기본 문구로 동작하지만, 행사명이 아닌 안내 문구가 필요하면 설정에서 입력하세요.",
      links: [
        { href: settingsPath, label: "스크린 화면 설정" },
        ...(eventCodeIsValid
          ? [{ href: screenPath, label: "스크린 열기", external: true }]
          : []),
      ],
    },
    {
      title: "퀴즈 준비 상태",
      status: !participantShowQuiz
        ? "ok"
        : quiz.questionCount === 0
          ? "danger"
          : quiz.emptySessionCount > 0
            ? "warn"
            : "ok",
      description: "참가자 화면에서 퀴즈를 사용할 때 필요한 문제 상태입니다.",
      currentValue: !participantShowQuiz
        ? "퀴즈 비활성화됨"
        : [
            `퀴즈 세션: ${countText(quiz.sessionCount)}`,
            `문제: ${countText(quiz.questionCount)}`,
            `문제 없는 세션: ${countText(quiz.emptySessionCount)}`,
            `답변 기록: ${countText(answerCount)}`,
          ].join("\n"),
      action: !participantShowQuiz
        ? "참가자 화면에서 퀴즈를 숨긴 상태입니다. 설문 행사라면 정상입니다."
        : quiz.questionCount === 0
          ? "퀴즈를 사용하려면 문제를 1개 이상 등록하세요."
          : quiz.emptySessionCount > 0
            ? "문제 없는 퀴즈 세션을 정리하거나 문제를 추가하세요."
            : "퀴즈 문제 수가 준비되어 있습니다.",
      links: [{ href: questionsPath, label: "퀴즈 관리" }],
    },
    {
      title: "설문 준비 상태",
      status: !participantShowSurvey
        ? "ok"
        : survey.formCount === 0
          ? "warn"
          : survey.formsWithQuestions === 0
            ? "danger"
            : "ok",
      description: "참가자 화면에서 설문을 사용할 때 필요한 설문지와 질문 상태입니다.",
      currentValue: !participantShowSurvey
        ? "설문 비활성화됨"
        : [
            `설문지: ${countText(survey.formCount)}`,
            `질문 있는 설문지: ${countText(survey.formsWithQuestions)}`,
            `설문 질문: ${countText(survey.questionCount)}`,
            `draft/open/closed: ${survey.draftCount}/${survey.openCount}/${survey.closedCount}`,
            `제출: ${countText(survey.responseCount)}`,
          ].join("\n"),
      action: !participantShowSurvey
        ? "참가자 화면에서 설문을 숨긴 상태입니다."
        : survey.formCount === 0
          ? "설문을 사용할 예정이면 설문지를 먼저 생성하세요."
          : survey.formsWithQuestions === 0
            ? "설문지는 있지만 질문이 없습니다. 질문을 1개 이상 추가하세요."
            : "질문이 있는 설문지가 준비되어 있습니다.",
      links: [{ href: surveysPath, label: "설문 관리" }],
    },
    {
      title: "Q&A 준비 상태",
      status: "ok",
      description: "참가자 Q&A 사용 여부와 현재 제출 질문 수를 확인합니다.",
      currentValue: !participantShowQna
        ? "Q&A 비활성화됨"
        : [
            `전체 질문: ${countText(qna.total)}`,
            `검토 중: ${countText(qna.pending)}`,
            `승인: ${countText(qna.approved)}`,
            `숨김/삭제: ${countText(qna.hidden + qna.deleted)}`,
          ].join("\n"),
      action: !participantShowQna
        ? "참가자 Q&A 제출을 숨긴 상태입니다. 포럼 행사가 아니면 정상입니다."
        : qna.pending > 0
          ? "검토 중 질문을 확인해 스크린 송출 여부를 결정하세요."
          : "Q&A 제출 화면을 실제 휴대폰에서 한 번 확인하세요.",
      links: [{ href: qnaPath, label: "Q&A 관리" }],
    },
    {
      title: "럭키드로우 준비 상태",
      status: draw.prizeCount > 0 ? "ok" : "warn",
      description: "경품 목록과 당첨 기록 상태를 확인합니다.",
      currentValue: [
        `참가자 추첨 안내: ${featureLabel(participantShowDraw)}`,
        `경품 종류: ${countText(draw.prizeCount)}`,
        `전체 경품 수량: ${draw.totalQuantity.toLocaleString("ko-KR")}개`,
        `남은 수량 추정: ${draw.remainingQuantity.toLocaleString("ko-KR")}개`,
        `당첨 기록: ${countText(draw.winnerCount)}`,
        `설문 제출자 수: ${countText(survey.responseCount)}`,
      ].join("\n"),
      action:
        draw.prizeCount > 0
          ? "경품 목록이 준비되어 있습니다. 리허설 당첨 기록이 있으면 초기화 여부를 확인하세요."
          : "럭키드로우를 사용할 예정이면 경품을 1개 이상 등록하세요.",
      links: [{ href: drawPath, label: "럭키드로우 관리" }],
    },
    {
      title: "리허설 데이터 상태",
      status:
        participantCount + answerCount + survey.responseCount + qna.total + draw.winnerCount >
        0
          ? "warn"
          : "ok",
      description: "행사 시작 전 초기화가 필요할 수 있는 운영 데이터를 숫자로 확인합니다.",
      currentValue: [
        `참가자: ${countText(participantCount)}`,
        `퀴즈 답변: ${countText(answerCount)}`,
        `설문 응답: ${countText(survey.responseCount)}`,
        `Q&A 질문: ${countText(qna.total)}`,
        `당첨 기록: ${countText(draw.winnerCount)}`,
      ].join("\n"),
      action:
        participantCount + answerCount + survey.responseCount + qna.total + draw.winnerCount >
        0
          ? "실제 행사 전 리허설 데이터인지 확인하고 필요 시 선택 초기화하세요."
          : "초기화가 필요한 참여/응답/당첨 데이터가 없습니다.",
      links: [{ href: rehearsalPath, label: "리허설 초기화" }],
    },
    {
      title: "CSV 다운로드 상태",
      status: "ok",
      description: "행사 후 결과 다운로드에 필요한 페이지와 데이터 건수를 확인합니다.",
      currentValue: [
        `참가자: ${countText(participantCount)}`,
        `설문 응답: ${countText(survey.responseCount)}`,
        `당첨자: ${countText(draw.winnerCount)}`,
        `Q&A: ${countText(qna.total)}`,
      ].join("\n"),
      action: "데이터가 없어도 CSV는 헤더를 내려받을 수 있습니다. 행사 전 테스트 파일을 확인하세요.",
      links: [{ href: exportsPath, label: "결과 다운로드" }],
    },
    {
      title: "현재 스크린 송출 상태",
      status: liveState ? "ok" : "danger",
      description: "현재 mode, screen_scene, 마지막 변경 시각을 확인합니다.",
      currentValue: [
        `mode: ${liveState?.mode ?? "없음"} (${liveModeLabel(liveState?.mode)})`,
        `screen_scene: ${liveState?.screen_scene ?? "없음"} (${sceneLabel(
          liveState?.screen_scene
        )})`,
        `마지막 변경: ${formatDateTime(liveState?.updated_at ?? null)}`,
      ].join("\n"),
      action: liveState
        ? "리허설에서 QR, 대기, 설문, Q&A, 추첨 화면 전환을 확인하세요."
        : "라이브 상태가 없으면 스크린 송출이 불안정할 수 있습니다. 라이브 콘솔에서 상태를 확인하세요.",
      links: eventCodeIsValid
        ? [
            { href: livePath, label: "라이브 콘솔" },
            { href: screenPath, label: "스크린 열기", external: true },
          ]
        : [{ href: livePath, label: "라이브 콘솔" }],
    },
    {
      title: "효과음 확인",
      status: "warn",
      description: "럭키드로우 효과음은 브라우저 정책상 현장 스크린에서 직접 확인해야 합니다.",
      currentValue:
        "럭키드로우 효과음은 스크린 화면에서 효과음 켜기를 눌러야 재생됩니다.",
      action: "스크린 PC에서 오디오 출력 장치와 브라우저 음소거 상태를 확인하세요.",
      links: eventCodeIsValid
        ? [
            { href: screenPath, label: "스크린 열기", external: true },
            { href: drawPath, label: "럭키드로우 관리" },
          ]
        : [{ href: drawPath, label: "럭키드로우 관리" }],
    },
  ];

  return items;
}

export default async function OperationChecklistPage({
  params,
}: OperationChecklistPageProps) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId);
  const eventCode = event.event_code?.trim() ?? "";
  const [
    liveState,
    quiz,
    survey,
    qna,
    draw,
    participantCount,
    answerCount,
  ] = await Promise.all([
    getLiveState(eventId),
    getQuizSummary(eventId),
    getSurveySummary(eventId),
    getQnaSummary(eventId),
    getDrawSummary(eventId),
    getExactCount("participants", eventId),
    getExactCount("answers", eventId),
  ]);
  const participantShowQuiz = getBooleanSetting(event.participant_show_quiz);
  const participantShowQna = getBooleanSetting(event.participant_show_qna);
  const participantShowSurvey = getBooleanSetting(event.participant_show_survey);
  const participantShowDraw = getBooleanSetting(event.participant_show_draw);
  const checks = buildChecklistItems({
    eventId,
    eventCode,
    eventTitle: event.title,
    venue: event.venue,
    primaryColor: event.primary_color,
    liveState,
    quiz,
    survey,
    qna,
    draw,
    participantCount,
    answerCount,
    participantShowQuiz,
    participantShowQna,
    participantShowSurvey,
    participantShowDraw,
    participantTitle: event.participant_title,
    participantDescription: event.participant_description,
    screenTitle: event.screen_title,
    screenSubtitle: event.screen_subtitle,
    screenShowLogo: event.screen_show_logo ?? true,
  });
  const okCount = checks.filter((item) => item.status === "ok").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const dangerCount = checks.filter((item) => item.status === "danger").length;
  const overallStatus: ChecklistStatus =
    dangerCount > 0 ? "danger" : warnCount > 0 ? "warn" : "ok";
  const recommendation =
    overallStatus === "danger"
      ? "위험 항목을 먼저 해결한 뒤 리허설을 진행하세요."
      : overallStatus === "warn"
        ? "운영 전 확인 필요 항목을 점검하세요."
        : "기본 운영 준비가 완료되었습니다. 현장 장비와 네트워크를 최종 확인하세요.";

  return (
    <AdminShell
      title="운영 체크리스트"
      description="행사 시작 전 QR, 참가자 화면, 스크린, 설문, Q&A, 럭키드로우, 다운로드 상태를 점검합니다."
    >
      <div className="grid gap-5">
        <AdminPanel
          title="준비 상태 요약"
          description="자동 점검 항목을 정상, 확인 필요, 위험 상태로 분류했습니다. 수동 장비 확인은 아래 체크리스트에서 별도로 진행하세요."
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="rounded-3xl border border-slate-300 bg-slate-50 p-5">
              <p className="text-sm font-black text-slate-700">전체 상태</p>
              <div className="mt-3">
                <StatusBadge tone={statusTone(overallStatus)}>
                  {statusLabel(overallStatus)}
                </StatusBadge>
              </div>
              <p className="mt-4 text-sm font-bold leading-6 text-[color:#0a1a38]">
                {recommendation}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryMetric label="정상" value={okCount} />
              <SummaryMetric label="확인 필요" value={warnCount} />
              <SummaryMetric label="위험" value={dangerCount} />
            </div>
          </div>
        </AdminPanel>

        <div className="grid gap-4 xl:grid-cols-2">
          {checks.map((item) => (
            <CheckItemCard key={item.title} item={item} />
          ))}
        </div>

        <ManualChecklist eventId={eventId} />

        <AdminPanel
          title="개인정보 최소화"
          description="이 페이지는 점검에 필요한 숫자와 설정값만 조회합니다. 참가자 이름, 전화번호, 이메일, participant_id, 설문 답변 상세, screen_payload 원문은 표시하지 않습니다."
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="green">count 중심 조회</StatusBadge>
            <StatusBadge tone="green">응답 상세 미표시</StatusBadge>
            <StatusBadge tone="green">개인 식별값 미표시</StatusBadge>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
