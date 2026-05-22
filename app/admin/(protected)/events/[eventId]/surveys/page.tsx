import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  EmptyState,
  StatusBadge,
} from "@/components/quiz/ui";
import {
  canManageSurveysByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import {
  getSurveyFormsForEvent,
  getSurveyResponseReviews,
  type SurveyFormSummary,
  type SurveyQuestionRecord,
  type SurveyQuestionType,
  type SurveyResponseReview,
  type SurveyStatus,
} from "@/lib/data/surveys";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  closeSurveyForm,
  createDefaultSurveyQuestions,
  createStarterSurveys,
  createSurveyForm,
  createSurveyQuestion,
  deleteOrArchiveSurveyForm,
  deleteSurveyQuestion,
  moveSurveyQuestion,
  reopenSurveyFormAsDraft,
  setBreakScreenFromSurveys,
  setJoinQrScreenFromSurveys,
  setSurveyIntroScreenFromSurveys,
  setSurveyStatusScreenFromSurveys,
  setWaitingScreenFromSurveys,
  startSurveyForm,
  updateSurveyForm,
  updateSurveyQuestion,
} from "./actions";
import { buildPublicUrl } from "@/lib/site-url";
import { AdminScreenStatusCard } from "../_components/AdminScreenStatusCard";
import { SurveyActionButton } from "./SurveyActionButton";
import { SurveyStatsClient } from "./SurveyStatsClient";

type SurveyPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    surveyId?: string | string[];
    message?: string | string[];
    error?: string | string[];
  }>;
};

type SurveyLiveState = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

const QUESTION_TYPES: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: "short_text", label: "단답형" },
  { value: "long_text", label: "장문형" },
  { value: "single_choice", label: "객관식 단일 선택" },
  { value: "multiple_choice", label: "객관식 복수 선택" },
  { value: "rating", label: "1~5 만족도" },
];

const STATUS_OPTIONS: Array<{ value: SurveyStatus; label: string }> = [
  { value: "draft", label: "작성 중" },
  { value: "open", label: "응답 가능" },
  { value: "closed", label: "마감" },
  { value: "archived", label: "보관" },
];

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusLabel(status: SurveyStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
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

function questionTypeLabel(type: SurveyQuestionType) {
  return QUESTION_TYPES.find((option) => option.value === type)?.label ?? type;
}

function screenModeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
    survey: "설문",
  };

  return labels[mode ?? ""] ?? "송출 준비";
}

function screenSceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    join_qr: "QR 입장 안내",
    survey_intro: "설문 참여 안내",
    survey_active: "설문 진행",
    survey_status: "설문 제출 현황",
    survey_closed: "설문 마감",
    question: "퀴즈 진행",
    quiz_question: "퀴즈 진행",
    result: "결과 공개",
    quiz_results: "결과 공개",
    qna_waiting: "Q&A 질문 접수",
    qna_question: "현장 질문",
    draw: "럭키드로우 준비",
    draw_winner: "당첨자 발표",
  };

  return labels[scene ?? ""] ?? "대기 화면";
}

async function getParticipantCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-surveys] Failed to count participants.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getLiveState(eventId: string): Promise<SurveyLiveState | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("mode, screen_scene, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-surveys] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return (data as SurveyLiveState | null) ?? null;
}

function SubmitButton({
  children,
  tone = "dark",
  disabled = false,
  pendingLabel,
  confirmMessage,
}: {
  children: string;
  tone?: "dark" | "amber" | "rose" | "outline";
  disabled?: boolean;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  return (
    <SurveyActionButton
      tone={tone}
      disabled={disabled}
      pendingLabel={pendingLabel}
      confirmMessage={confirmMessage}
    >
      {children}
    </SurveyActionButton>
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
  required = false,
}: {
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
    />
  );
}

function TextArea({
  name,
  defaultValue,
  placeholder,
  rows = 4,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      name={name}
      rows={rows}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="w-full resize-y rounded-2xl border border-slate-400 bg-white px-4 py-3 text-sm font-bold leading-6 text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
    />
  );
}

function SurveyTabs({
  eventId,
  surveys,
  activeSurveyId,
  participantCount,
}: {
  eventId: string;
  surveys: SurveyFormSummary[];
  activeSurveyId: string | null;
  participantCount: number;
}) {
  return (
    <AdminPanel
      title="설문 목록"
      description="설문별 상태와 제출 인원을 확인하고, 필요한 설문을 선택해 질문을 관리합니다."
    >
      <div className="flex gap-2 overflow-x-auto pb-1">
        {surveys.map((survey, index) => {
          const active = survey.id === activeSurveyId;

          return (
            <Link
              key={survey.id}
              href={`/admin/events/${eventId}/surveys?surveyId=${survey.id}`}
              className={`min-w-44 shrink-0 rounded-2xl border p-4 shadow-sm transition ${
                active
                  ? "border-[#0a1a38] bg-[#0a1a38] text-white"
                  : "border-slate-300 bg-white text-[color:#0a1a38] hover:border-[#0a1a38]"
              }`}
            >
              <p className="text-sm font-black">설문 {index + 1}</p>
              <p className="mt-1 line-clamp-1 text-base font-black">
                {survey.title}
              </p>
              <p
                className={`mt-2 text-xs font-bold ${
                  active ? "text-white/85" : "text-slate-700"
                }`}
              >
                제출 {survey.response_count.toLocaleString("ko-KR")}명 / 입장{" "}
                {participantCount.toLocaleString("ko-KR")}명
              </p>
            </Link>
          );
        })}
        <a
          href="#create-survey"
          className="flex min-w-40 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#0a1a38] bg-white p-4 text-sm font-black text-[color:#0a1a38] shadow-sm hover:bg-slate-50"
        >
          + 설문 추가
        </a>
      </div>
    </AdminPanel>
  );
}

function SurveyCreatePanel({
  eventId,
  nextOrder,
  canManage,
}: {
  eventId: string;
  nextOrder: number;
  canManage: boolean;
}) {
  const action = createSurveyForm.bind(null, eventId);

  return (
    <AdminPanel
      title="설문 추가"
      description="새 설문은 작성 중 상태로 만든 뒤 질문을 추가하고 응답 가능 상태로 전환하세요."
    >
      <form id="create-survey" action={action} className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_12rem_8rem]">
          <div>
            <FieldLabel>설문 제목</FieldLabel>
            <div className="mt-2">
              <TextInput name="title" placeholder="예: 행사 만족도 설문" required />
            </div>
          </div>
          <div>
            <FieldLabel>상태</FieldLabel>
            <select
              name="status"
              defaultValue="draft"
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            >
              {STATUS_OPTIONS.filter((option) => option.value !== "open").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <FieldLabel>순서</FieldLabel>
            <div className="mt-2">
              <TextInput name="sort_order" type="number" defaultValue={nextOrder} />
            </div>
          </div>
        </div>
        <div>
          <FieldLabel>설명</FieldLabel>
          <div className="mt-2">
            <TextArea name="description" placeholder="참가자에게 보일 짧은 안내" />
          </div>
        </div>
        <SubmitButton disabled={!canManage}>설문 추가</SubmitButton>
      </form>
    </AdminPanel>
  );
}

function SurveySettingsPanel({
  eventId,
  survey,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  canManage: boolean;
}) {
  const updateAction = updateSurveyForm.bind(null, eventId, survey.id);
  const deleteAction = deleteOrArchiveSurveyForm.bind(null, eventId, survey.id);
  const hasQuestions = survey.questions.length > 0;

  return (
    <AdminPanel
      title="설문 설정"
      description="응답 가능 상태로 열면 참가자 설문 목록에 표시됩니다. 질문이 없는 설문은 열 수 없습니다."
    >
      <form action={updateAction} className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_12rem_8rem]">
          <div>
            <FieldLabel>설문 제목</FieldLabel>
            <div className="mt-2">
              <TextInput name="title" defaultValue={survey.title} required />
            </div>
          </div>
          <div>
            <FieldLabel>상태</FieldLabel>
            <select
              name="status"
              defaultValue={survey.status}
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>순서</FieldLabel>
            <div className="mt-2">
              <TextInput
                name="sort_order"
                type="number"
                defaultValue={survey.sort_order}
              />
            </div>
          </div>
        </div>
        <div>
          <FieldLabel>설명</FieldLabel>
          <div className="mt-2">
            <TextArea name="description" defaultValue={survey.description} />
          </div>
        </div>
        {!hasQuestions && (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
            질문을 1개 이상 추가해야 응답 가능 상태로 열 수 있습니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <SubmitButton disabled={!canManage}>설문 설정 저장</SubmitButton>
        </div>
      </form>

      <form action={deleteAction} className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
        <label className="flex items-start gap-3 text-sm font-bold leading-6 text-rose-950">
          <input
            type="checkbox"
            name="confirm_delete"
            value="yes"
            className="mt-1 size-4"
          />
          응답이 없으면 설문을 삭제하고, 응답이 있으면 보관 상태로 전환합니다.
        </label>
        <div className="mt-3">
          <SubmitButton tone="rose" disabled={!canManage}>
            설문 삭제 또는 보관
          </SubmitButton>
        </div>
      </form>
    </AdminPanel>
  );
}

function SurveyOperationPanel({
  eventId,
  survey,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  canManage: boolean;
}) {
  const startAction = startSurveyForm.bind(null, eventId, survey.id);
  const closeAction = closeSurveyForm.bind(null, eventId, survey.id);
  const draftAction = reopenSurveyFormAsDraft.bind(null, eventId, survey.id);
  const hasQuestions = survey.questions.length > 0;

  return (
    <AdminPanel
      title="설문 운영"
      description="설문 시작과 스크린 송출은 별도 동작입니다. 먼저 설문을 시작한 뒤 필요한 화면을 송출하세요."
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={statusTone(survey.status)}>
              {statusLabel(survey.status)}
            </StatusBadge>
            <StatusBadge tone={hasQuestions ? "green" : "amber"}>
              질문 {survey.questions.length.toLocaleString("ko-KR")}개
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-slate-700">
            {survey.status === "open"
              ? "현재 참가자에게 공개 중입니다."
              : survey.status === "closed"
                ? "마감된 설문입니다. 필요하면 작성 중으로 되돌려 수정하세요."
                : survey.status === "archived"
                  ? "보관된 설문은 운영 버튼을 사용할 수 없습니다."
                  : "작성 중인 설문입니다. 참가자가 제출하려면 설문 시작을 눌러주세요."}
          </p>
        </div>

        {!hasQuestions && survey.status !== "archived" && (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
            질문을 1개 이상 추가한 뒤 설문을 시작해주세요.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {survey.status === "draft" && (
            <form action={startAction}>
              <SubmitButton
                disabled={!canManage || !hasQuestions}
                pendingLabel="설문 시작 중..."
                confirmMessage="1분 설문을 시작합니다. 참가자 화면과 스크린에 설문이 공개됩니다. 시작할까요?"
              >
                1분 설문 시작
              </SubmitButton>
            </form>
          )}
          {survey.status === "open" && (
            <form action={closeAction}>
              <SubmitButton
                tone="amber"
                disabled={!canManage}
                pendingLabel="마감 중..."
                confirmMessage="설문을 마감합니다. 참가자는 더 이상 제출할 수 없습니다. 마감할까요?"
              >
                설문 마감
              </SubmitButton>
            </form>
          )}
          {survey.status === "closed" && (
            <form action={draftAction}>
              <SubmitButton tone="outline" disabled={!canManage}>
                작성 중으로 되돌리기
              </SubmitButton>
            </form>
          )}
        </div>

        <div className="grid gap-2 text-sm font-bold leading-6 text-slate-700">
          <p>1분 설문 시작: 참가자에게 1분 동안 공개하고 스크린에 진행 화면을 송출합니다.</p>
          <p>설문 마감: 참가자 제출을 중지합니다.</p>
          <p>작성 중으로 되돌리기: 설문을 다시 수정할 수 있는 상태로 변경합니다.</p>
        </div>
      </div>
    </AdminPanel>
  );
}

function ScreenControlPanel({
  eventId,
  eventCode,
  screenUrl,
  activeSurvey,
  liveState,
  canManage,
}: {
  eventId: string;
  eventCode: string;
  screenUrl: string;
  activeSurvey: SurveyFormSummary | null;
  liveState: SurveyLiveState | null;
  canManage: boolean;
}) {
  const waitingAction = setWaitingScreenFromSurveys.bind(null, eventId);
  const breakAction = setBreakScreenFromSurveys.bind(null, eventId);
  const joinQrAction = setJoinQrScreenFromSurveys.bind(null, eventId);
  const surveyIntroAction = activeSurvey
    ? setSurveyIntroScreenFromSurveys.bind(null, eventId, activeSurvey.id)
    : undefined;
  const surveyStatusAction = activeSurvey
    ? setSurveyStatusScreenFromSurveys.bind(null, eventId, activeSurvey.id)
    : undefined;
  const surveyIsOpen = activeSurvey?.status === "open";
  const canBroadcastStatus =
    activeSurvey?.status === "open" || activeSurvey?.status === "closed";

  return (
    <AdminPanel
      title="화면 제어"
      description="설문 관리 화면에서 대기, 휴식, QR, 설문 안내 화면을 바로 송출합니다."
    >
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm font-bold text-[color:#0a1a38]">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="slate">
              현재 모드: {screenModeLabel(liveState?.mode)}
            </StatusBadge>
            <StatusBadge tone="cyan">
              현재 화면: {screenSceneLabel(liveState?.screen_scene)}
            </StatusBadge>
          </div>
          <p className="text-slate-700">
            마지막 변경:{" "}
            {liveState?.updated_at
              ? new Date(liveState.updated_at).toLocaleString("ko-KR")
              : "기록 없음"}
          </p>
          <p className="break-all text-slate-700">스크린 URL: {screenUrl}</p>
        </div>

        <Link
          href={screenUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-slate-100"
        >
          스크린 열기
        </Link>

        <div className="grid gap-2">
          <form action={waitingAction}>
            <SubmitButton
              disabled={!canManage}
              pendingLabel="송출 중..."
              confirmMessage="스크린을 대기 화면으로 전환합니다. 진행할까요?"
            >
              대기 화면 송출
            </SubmitButton>
          </form>
          <form action={breakAction}>
            <SubmitButton
              tone="amber"
              disabled={!canManage}
              pendingLabel="송출 중..."
              confirmMessage="스크린을 휴식 화면으로 전환합니다. 진행할까요?"
            >
              휴식 화면 송출
            </SubmitButton>
          </form>
          <form action={joinQrAction}>
            <SubmitButton
              tone="outline"
              disabled={!canManage}
              pendingLabel="송출 중..."
              confirmMessage="스크린을 QR 입장 안내 화면으로 전환합니다. 진행할까요?"
            >
              QR 입장 안내 송출
            </SubmitButton>
          </form>
          {surveyIntroAction && (
            <form action={surveyIntroAction}>
              <SubmitButton
                disabled={!canManage || !surveyIsOpen}
                pendingLabel="송출 중..."
                confirmMessage="스크린을 설문 참여 안내 화면으로 전환합니다. 진행할까요?"
              >
                설문 참여 안내 송출
              </SubmitButton>
            </form>
          )}
          {surveyStatusAction && (
            <form action={surveyStatusAction}>
              <SubmitButton
                tone="outline"
                disabled={!canManage || !canBroadcastStatus}
                pendingLabel="송출 중..."
                confirmMessage="스크린을 설문 제출 현황 화면으로 전환합니다. 진행할까요?"
              >
                제출 현황 송출
              </SubmitButton>
            </form>
          )}
        </div>

        {activeSurvey ? (
          <p className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
            선택 설문: {activeSurvey.title} · 제출{" "}
            {activeSurvey.response_count.toLocaleString("ko-KR")}명. 설문 참여
            안내는 설문 시작 후 송출해주세요.
          </p>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
            설문을 선택하면 설문 참여 안내와 제출 현황을 송출할 수 있습니다.
          </p>
        )}
        <p className="text-xs font-bold leading-5 text-slate-600">
          화면 제어는 스크린 송출만 변경합니다. 설문 시작/마감 상태는 별도 버튼으로 관리합니다. 행사 코드: {eventCode}
        </p>
      </div>
    </AdminPanel>
  );
}

function QuestionForm({
  eventId,
  survey,
  question,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  question?: SurveyQuestionRecord;
  canManage: boolean;
}) {
  const action = question
    ? updateSurveyQuestion.bind(null, eventId, survey.id, question.id)
    : createSurveyQuestion.bind(null, eventId, survey.id);
  const defaultType = question?.question_type ?? "short_text";
  const defaultOrder = question?.sort_order ?? survey.questions.length + 1;

  return (
    <form action={action} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_14rem_8rem]">
        <div>
          <FieldLabel>질문</FieldLabel>
          <div className="mt-2">
            <TextInput
              name="question_text"
              defaultValue={question?.question_text}
              placeholder="질문 내용을 입력하세요"
              required
            />
          </div>
        </div>
        <div>
          <FieldLabel>질문 타입</FieldLabel>
          <select
            name="question_type"
            defaultValue={defaultType}
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-bold text-[color:#0a1a38] shadow-sm"
          >
            {QUESTION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>순서</FieldLabel>
          <div className="mt-2">
            <TextInput name="sort_order" type="number" defaultValue={defaultOrder} />
          </div>
        </div>
      </div>
      <div>
        <FieldLabel>객관식 선택지</FieldLabel>
        <div className="mt-2">
          <TextArea
            name="options"
            rows={3}
            defaultValue={question?.options.join("\n") ?? ""}
            placeholder={"객관식일 때만 사용합니다.\n예: 매우 만족\n만족\n보통"}
          />
        </div>
        <p className="mt-2 text-xs font-bold leading-5 text-slate-700">
          단답형, 장문형, 만족도 질문은 선택지를 비워도 됩니다.
        </p>
      </div>
      <label className="flex items-center gap-3 text-sm font-bold text-[color:#0a1a38]">
        <input
          type="checkbox"
          name="is_required"
          defaultChecked={question?.is_required ?? true}
          className="size-4"
        />
        필수 질문
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={!canManage}>
          {question ? "질문 저장" : "질문 추가"}
        </SubmitButton>
      </div>
    </form>
  );
}

function QuestionCard({
  eventId,
  survey,
  question,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  question: SurveyQuestionRecord;
  canManage: boolean;
}) {
  const deleteAction = deleteSurveyQuestion.bind(
    null,
    eventId,
    survey.id,
    question.id
  );
  const moveUpAction = moveSurveyQuestion.bind(
    null,
    eventId,
    survey.id,
    question.id,
    "up"
  );
  const moveDownAction = moveSurveyQuestion.bind(
    null,
    eventId,
    survey.id,
    question.id,
    "down"
  );

  return (
    <article className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-700">
            #{question.sort_order} · {questionTypeLabel(question.question_type)}
          </p>
          <h3 className="mt-2 text-xl font-black leading-7 text-[color:#0a1a38]">
            {question.question_text}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={question.is_required ? "cyan" : "slate"}>
            {question.is_required ? "필수" : "선택"}
          </StatusBadge>
          {question.options.length > 0 && (
            <StatusBadge tone="amber">선택지 {question.options.length}개</StatusBadge>
          )}
        </div>
      </div>

      {question.options.length > 0 && (
        <div className="grid gap-2 rounded-2xl border border-slate-300 bg-white p-4">
          {question.options.map((option) => (
            <p key={option} className="text-sm font-bold text-[color:#0a1a38]">
              {option}
            </p>
          ))}
        </div>
      )}

      <QuestionForm
        eventId={eventId}
        survey={survey}
        question={question}
        canManage={canManage}
      />

      <div className="flex flex-wrap gap-2">
        <form action={moveUpAction}>
          <SubmitButton tone="outline" disabled={!canManage}>
            위로
          </SubmitButton>
        </form>
        <form action={moveDownAction}>
          <SubmitButton tone="outline" disabled={!canManage}>
            아래로
          </SubmitButton>
        </form>
        <form action={deleteAction} className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-rose-900">
            <input
              type="checkbox"
              name="confirm_delete"
              value="yes"
              className="size-4"
            />
            삭제 확인
          </label>
          <SubmitButton tone="rose" disabled={!canManage}>
            질문 삭제
          </SubmitButton>
        </form>
      </div>
    </article>
  );
}

function QuestionManagePanel({
  eventId,
  survey,
  canManage,
}: {
  eventId: string;
  survey: SurveyFormSummary;
  canManage: boolean;
}) {
  const defaultQuestionsAction = createDefaultSurveyQuestions.bind(
    null,
    eventId,
    survey.id
  );

  return (
    <AdminPanel
      title="질문 관리"
      description="객관식 선택지는 줄바꿈으로 입력합니다. 응답이 있는 질문은 삭제할 수 없습니다."
    >
      <div className="grid gap-5">
        {survey.questions.length === 0 && (
          <form
            action={defaultQuestionsAction}
            className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-cyan-950">
                  기본 질문 10개 추가
                </h3>
                <p className="mt-2 text-sm font-bold leading-6 text-cyan-900">
                  행사 만족도, 프로그램 구성, 재참여 의향, 개선 의견, 경품 추첨
                  동의 문항을 한 번에 추가합니다.
                </p>
              </div>
              <SubmitButton
                disabled={!canManage}
                pendingLabel="기본 질문 추가 중..."
              >
                기본 질문 10개 추가
              </SubmitButton>
            </div>
          </form>
        )}
        <QuestionForm eventId={eventId} survey={survey} canManage={canManage} />
        {survey.questions.length > 0 ? (
          <div className="grid gap-4">
            {survey.questions.map((question) => (
              <QuestionCard
                key={question.id}
                eventId={eventId}
                survey={survey}
                question={question}
                canManage={canManage}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="아직 질문이 없습니다."
            description="질문을 추가한 뒤 설문을 응답 가능 상태로 전환하세요."
          />
        )}
      </div>
    </AdminPanel>
  );
}

function SurveyResponsesPanel({
  responses,
  totalCount,
}: {
  responses: SurveyResponseReview[];
  totalCount: number;
}) {
  return (
    <AdminPanel
      title="제출자 확인"
      description="최근 제출자와 응답 상세를 확인합니다. 연락처와 이메일은 표시하지 않습니다."
    >
      {responses.length === 0 ? (
        <EmptyState
          title="아직 제출한 참가자가 없습니다."
          description="참가자가 설문을 제출하면 이곳에 최근 제출 내역이 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          <p className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
            최신 제출순으로 최근 {responses.length.toLocaleString("ko-KR")}건을
            표시합니다. 전체 제출 수는 {totalCount.toLocaleString("ko-KR")}건입니다.
          </p>
          {responses.map((response) => (
            <details
              key={response.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm open:border-[#0a1a38]"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-[color:#0a1a38]">
                      {response.participant_name}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {response.organization ?? "소속 정보 없음"}
                    </p>
                  </div>
                  <StatusBadge tone="slate">
                    {response.submitted_at
                      ? new Date(response.submitted_at).toLocaleString("ko-KR")
                      : "제출 시각 없음"}
                  </StatusBadge>
                </div>
              </summary>
              <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5">
                {response.answers.map((answer) => (
                  <div
                    key={answer.question_id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-black text-slate-600">
                      {questionTypeLabel(answer.question_type)}
                    </p>
                    <p className="mt-2 text-base font-black leading-6 text-[color:#0a1a38]">
                      {answer.question_text}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-800">
                      {answer.answer_label}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}

export default async function SurveysPage({
  params,
  searchParams,
}: SurveyPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const canManage = canManageSurveysByRole(role);
  const [surveys, participantCount, liveState] = await Promise.all([
    getSurveyFormsForEvent(eventId),
    getParticipantCount(eventId),
    getLiveState(eventId),
  ]);
  const requestedSurveyId = getSingle(query.surveyId);
  const activeSurvey =
    surveys.find((survey) => survey.id === requestedSurveyId) ?? surveys[0] ?? null;
  const responseReviews =
    activeSurvey && canManage
        ? await getSurveyResponseReviews({
            eventId,
            surveyFormId: activeSurvey.id,
            limit: 50,
          })
      : [];
  const totalResponses = surveys.reduce(
    (sum, survey) => sum + survey.response_count,
    0
  );
  const createStarterAction = createStarterSurveys.bind(null, eventId);
  const message = getSingle(query.message);
  const error = getSingle(query.error);
  const screenUrl = buildPublicUrl(`/screen/${event.event_code}`);
  const activeSurveyStats = activeSurvey
    ? {
        survey_form_id: activeSurvey.id,
        status: activeSurvey.status,
        submitted_count: activeSurvey.response_count,
        participant_count: participantCount,
        submitted_rate:
          participantCount > 0
            ? Math.min(
                100,
                Math.round((activeSurvey.response_count / participantCount) * 100)
              )
            : 0,
        active_started_at: activeSurvey.active_started_at,
        active_ends_at: activeSurvey.active_ends_at,
        closed_at: activeSurvey.closed_at,
        server_now: activeSurvey.updated_at ?? "",
        remaining_seconds: 0,
        is_closed: activeSurvey.status !== "open",
      }
    : null;

  return (
    <AdminShell
      title="설문 관리"
      description="행사별 설문을 만들고, QR로 입장한 참가자가 제출한 설문별 응답 인원을 확인합니다."
    >
      <div className="grid gap-5">
        <AdminPanel title={event.title} description={`행사 코드: ${event.event_code}`}>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={canManage ? "green" : "amber"}>
              {canManage ? "설문 편집 가능" : "조회 전용"}
            </StatusBadge>
            <StatusBadge tone="slate">
              설문 {surveys.length.toLocaleString("ko-KR")}개
            </StatusBadge>
            <StatusBadge tone="cyan">
              전체 제출 {totalResponses.toLocaleString("ko-KR")}건
            </StatusBadge>
            <StatusBadge tone="slate">
              입장 {participantCount.toLocaleString("ko-KR")}명
            </StatusBadge>
          </div>
          <p className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
            참가자는 QR 입장 후 /e/{event.event_code}/survey에서 응답 가능 상태의 설문을 제출할 수 있습니다.
            한 참가자는 같은 설문에 한 번만 제출할 수 있습니다.
          </p>
          {!canManage && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
              현재 역할은 설문을 볼 수 있지만 만들거나 수정할 수 없습니다.
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

        <AdminScreenStatusCard
          mode={liveState?.mode}
          screenScene={liveState?.screen_scene}
          updatedAt={liveState?.updated_at}
          screenUrl={screenUrl}
          eventCode={event.event_code}
        />

        {surveys.length === 0 ? (
          <AdminPanel
            title="기본 설문 4개 만들기"
            description="아직 설문이 없습니다. 설문 1~4를 작성 중 상태로 만든 뒤 필요한 질문을 추가하세요."
          >
            <form action={createStarterAction}>
              <SubmitButton disabled={!canManage}>기본 설문 4개 만들기</SubmitButton>
            </form>
          </AdminPanel>
        ) : (
          <SurveyTabs
            eventId={eventId}
            surveys={surveys}
            activeSurveyId={activeSurvey?.id ?? null}
            participantCount={participantCount}
          />
        )}

        <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
          <section className="grid content-start gap-5">
            {activeSurvey ? (
              <>
                <AdminPanel
                  title={activeSurvey.title}
                  description={activeSurvey.description ?? "설문 설명이 없습니다."}
                >
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={statusTone(activeSurvey.status)}>
                      {statusLabel(activeSurvey.status)}
                    </StatusBadge>
                    <StatusBadge tone="cyan">
                      제출 {activeSurvey.response_count.toLocaleString("ko-KR")}명
                    </StatusBadge>
                    <StatusBadge tone="slate">
                      질문 {activeSurvey.questions.length.toLocaleString("ko-KR")}개
                    </StatusBadge>
                  </div>
                  {activeSurveyStats && (
                    <div className="mt-5">
                      <SurveyStatsClient
                        key={activeSurvey.id}
                        eventId={eventId}
                        surveyFormId={activeSurvey.id}
                        initialStats={activeSurveyStats}
                      />
                    </div>
                  )}
                  <p className="mt-4 text-sm font-bold leading-6 text-slate-700">
                    응답 가능 상태(open)인 설문만 참가자 화면에 표시됩니다. 마감(closed) 또는 보관(archived)
                    상태는 새 제출을 받지 않습니다.
                  </p>
                </AdminPanel>
                <QuestionManagePanel
                  eventId={eventId}
                  survey={activeSurvey}
                  canManage={canManage}
                />
                {canManage ? (
                  <SurveyResponsesPanel
                    responses={responseReviews}
                    totalCount={activeSurvey.response_count}
                  />
                ) : (
                  <EmptyState
                    title="응답 상세 권한이 없습니다."
                    description="제출자 명단과 응답 상세는 설문 운영 권한이 있는 관리자에게만 표시됩니다."
                  />
                )}
              </>
            ) : (
              <EmptyState
                title="선택된 설문이 없습니다."
                description="기본 설문 4개를 만들거나 새 설문을 추가하세요."
              />
            )}
          </section>

          <aside className="grid content-start gap-5">
            <ScreenControlPanel
              eventId={eventId}
              eventCode={event.event_code}
              screenUrl={screenUrl}
              activeSurvey={activeSurvey}
              liveState={liveState}
              canManage={canManage}
            />
            {activeSurvey && (
              <>
                <SurveyOperationPanel
                  eventId={eventId}
                  survey={activeSurvey}
                  canManage={canManage}
                />
                <SurveySettingsPanel
                  eventId={eventId}
                  survey={activeSurvey}
                  canManage={canManage}
                />
              </>
            )}
            <SurveyCreatePanel
              eventId={eventId}
              nextOrder={surveys.length + 1}
              canManage={canManage}
            />
            <AdminPanel
              title="운영 메모"
              description="설문 시작/마감과 스크린 송출은 운영자가 각각 직접 제어합니다."
            >
              <div className="grid gap-3 text-sm font-bold leading-6 text-slate-700">
                <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  설문 시작은 제출 가능 상태를 여는 동작이고, 설문 참여 안내 송출은 스크린 화면만 바꾸는 동작입니다.
                </p>
                <p className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  설문 답변 상세는 보호된 관리자 영역에서만 다뤄야 하며, 참가자 화면에는 다른 사람의 응답을 표시하지 않습니다.
                </p>
              </div>
            </AdminPanel>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
