import "server-only";

import {
  canManageSurveysByRole,
  canModerateQnaByRole,
  canOperateDrawByRole,
  canViewOperationLogsByRole,
  getEventScopedRole,
  requireEventAccess,
  type EventAccessRole,
  type EventRecord,
} from "@/lib/auth/events";
import {
  createCsvDownloadResponse,
  createCsvFilename,
  formatCsvDateTime,
  type CsvCell,
} from "@/lib/csv";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type CsvExportKind =
  | "participants"
  | "survey-responses"
  | "survey-respondents"
  | "draw-winners"
  | "qna"
  | "operation-logs";

type SurveyStatus = "draft" | "open" | "closed" | "archived";
type SurveyQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "rating";

type SurveyExportForm = {
  id: string;
  title: string;
  status: SurveyStatus;
  response_count: number;
};

export type EventExportSummary = {
  participant_count: number;
  draw_winner_count: number;
  qna_count: number;
  operation_log_count: number;
  surveys: SurveyExportForm[];
};

export type EventExportPermissions = {
  participants: boolean;
  surveyResponses: boolean;
  surveyRespondents: boolean;
  drawWinners: boolean;
  qna: boolean;
  operationLogs: boolean;
};

type ParticipantDisplayRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
};

const EXPORT_PAGE_SIZE = 1000;
const CHUNK_SIZE = 500;

function canExportResultDataByRole(role: EventAccessRole | null) {
  return role === "super_admin" || role === "event_admin" || role === "operator";
}

export function canExportParticipantsByRole(role: EventAccessRole | null) {
  return canExportResultDataByRole(role);
}

export function canExportSurveyResponsesByRole(role: EventAccessRole | null) {
  return canManageSurveysByRole(role);
}

export function canExportSurveyRespondentsByRole(role: EventAccessRole | null) {
  return canManageSurveysByRole(role);
}

export function canExportDrawWinnersByRole(role: EventAccessRole | null) {
  return canOperateDrawByRole(role);
}

export function canExportQnaByRole(role: EventAccessRole | null) {
  return canModerateQnaByRole(role);
}

export function canExportOperationLogsByRole(role: EventAccessRole | null) {
  return canViewOperationLogsByRole(role);
}

export function getEventExportPermissions(
  role: EventAccessRole | null
): EventExportPermissions {
  return {
    participants: canExportParticipantsByRole(role),
    surveyResponses: canExportSurveyResponsesByRole(role),
    surveyRespondents: canExportSurveyRespondentsByRole(role),
    drawWinners: canExportDrawWinnersByRole(role),
    qna: canExportQnaByRole(role),
    operationLogs: canExportOperationLogsByRole(role),
  };
}

async function createAuthorizedExportResponse({
  eventId,
  kind,
  canExport,
  build,
}: {
  eventId: string;
  kind: CsvExportKind;
  canExport: (role: EventAccessRole | null) => boolean;
  build: (event: EventRecord) => Promise<Response>;
}) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canExport(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    return await build(event);
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: "Unknown CSV export error" };

    console.error("[csv-export] Failed to build CSV.", {
      eventId,
      kind,
      ...errorInfo,
    });

    return new Response("CSV export failed.", { status: 500 });
  }
}

async function fetchAllRows<T>(
  loadPage: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  }>,
  label: string
) {
  const rows: T[] = [];

  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const to = from + EXPORT_PAGE_SIZE - 1;
    const { data, error } = await loadPage(from, to);

    if (error) {
      throw new Error(`${label}: ${error.code ?? "query_error"}`);
    }

    const pageRows = (data ?? []) as T[];
    rows.push(...pageRows);

    if (pageRows.length < EXPORT_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function chunkArray<T>(items: T[], size = CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[csv-export] Failed to load export count.", {
      table,
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getSurveyExportForms(eventId: string): Promise<SurveyExportForm[]> {
  const supabase = createAdminSupabaseClient();
  const [{ data: forms, error: formsError }, { data: responses, error: responsesError }] =
    await Promise.all([
      supabase
        .from("survey_forms")
        .select("id, title, status, sort_order, created_at")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_responses")
        .select("id, survey_form_id")
        .eq("event_id", eventId),
    ]);

  if (formsError) {
    console.error("[csv-export] Failed to load survey export forms.", {
      eventId,
      message: formsError.message,
      code: formsError.code,
    });

    return [];
  }

  if (responsesError) {
    console.error("[csv-export] Failed to load survey export response counts.", {
      eventId,
      message: responsesError.message,
      code: responsesError.code,
    });
  }

  const responseCounts = new Map<string, number>();
  (responses ?? []).forEach((response) => {
    responseCounts.set(
      response.survey_form_id,
      (responseCounts.get(response.survey_form_id) ?? 0) + 1
    );
  });

  return ((forms ?? []) as Array<{
    id: string;
    title: string;
    status: SurveyStatus;
  }>).map((form) => ({
    id: form.id,
    title: form.title,
    status: form.status,
    response_count: responseCounts.get(form.id) ?? 0,
  }));
}

export async function getEventExportSummary(
  eventId: string
): Promise<EventExportSummary> {
  const [
    participantCount,
    drawWinnerCount,
    qnaCount,
    operationLogCount,
    surveys,
  ] = await Promise.all([
    getExactCount("participants", eventId),
    getExactCount("draw_winners", eventId),
    getExactCount("qna_questions", eventId),
    getExactCount("operation_logs", eventId),
    getSurveyExportForms(eventId),
  ]);

  return {
    participant_count: participantCount,
    draw_winner_count: drawWinnerCount,
    qna_count: qnaCount,
    operation_log_count: operationLogCount,
    surveys,
  };
}

function participantDisplayName(participant: ParticipantDisplayRow | undefined) {
  return (
    participant?.display_name?.trim() ||
    participant?.name?.trim() ||
    "이름 미확인"
  );
}

async function getParticipantDisplayMap({
  eventId,
  participantIds,
}: {
  eventId: string;
  participantIds: string[];
}) {
  const uniqueIds = Array.from(new Set(participantIds.filter(Boolean)));
  const participantMap = new Map<string, ParticipantDisplayRow>();

  if (uniqueIds.length === 0) {
    return participantMap;
  }

  const supabase = createAdminSupabaseClient();

  for (const ids of chunkArray(uniqueIds)) {
    const rows = await fetchAllRows<ParticipantDisplayRow>(
      (from, to) =>
        supabase
          .from("participants")
          .select("id, name, display_name, organization, group_name")
          .eq("event_id", eventId)
          .in("id", ids)
          .order("name", { ascending: true })
          .range(from, to),
      "participants display"
    );

    rows.forEach((participant) => {
      participantMap.set(participant.id, participant);
    });
  }

  return participantMap;
}

function csvResponseForEvent({
  event,
  parts,
  headers,
  rows,
}: {
  event: EventRecord;
  parts: string[];
  headers: string[];
  rows: CsvCell[][];
}) {
  return createCsvDownloadResponse({
    filename: createCsvFilename({
      eventCode: event.event_code,
      parts,
    }),
    headers,
    rows,
  });
}

export async function exportParticipantsCsv(eventId: string) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "participants",
    canExport: canExportParticipantsByRole,
    build: async (event) => {
      const supabase = createAdminSupabaseClient();
      const participants = await fetchAllRows<{
        name: string;
        display_name: string | null;
        organization: string | null;
        group_name: string | null;
        joined_at: string | null;
      }>(
        (from, to) =>
          supabase
            .from("participants")
            .select("name, display_name, organization, group_name, joined_at")
            .eq("event_id", eventId)
            .order("joined_at", { ascending: true })
            .range(from, to),
        "participants export"
      );

      return csvResponseForEvent({
        event,
        parts: ["participants"],
        headers: [
          "번호",
          "참가자명",
          "표시명",
          "소속/기관",
          "그룹/테이블",
          "입장 시각",
        ],
        rows: participants.map((participant, index) => [
          index + 1,
          participant.name,
          participant.display_name,
          participant.organization,
          participant.group_name,
          formatCsvDateTime(participant.joined_at),
        ]),
      });
    },
  });
}

async function getSurveyFormForExport({
  eventId,
  surveyFormId,
}: {
  eventId: string;
  surveyFormId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .select("id, title, status")
    .eq("event_id", eventId)
    .eq("id", surveyFormId)
    .maybeSingle();

  if (error) {
    throw new Error(`survey form export: ${error.code ?? "query_error"}`);
  }

  return data as { id: string; title: string; status: SurveyStatus } | null;
}

async function getSurveyQuestionsForExport(surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const questions = await fetchAllRows<{
    id: string;
    question_text: string;
    question_type: SurveyQuestionType;
    sort_order: number;
    created_at: string | null;
  }>(
    (from, to) =>
      supabase
        .from("survey_questions")
        .select("id, question_text, question_type, sort_order, created_at")
        .eq("survey_form_id", surveyFormId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, to),
    "survey questions export"
  );

  return questions;
}

async function getSurveyResponsesForExport({
  eventId,
  surveyFormId,
}: {
  eventId: string;
  surveyFormId: string;
}) {
  const supabase = createAdminSupabaseClient();

  return fetchAllRows<{
    id: string;
    participant_id: string;
    submitted_at: string | null;
  }>(
    (from, to) =>
      supabase
        .from("survey_responses")
        .select("id, participant_id, submitted_at")
        .eq("event_id", eventId)
        .eq("survey_form_id", surveyFormId)
        .order("submitted_at", { ascending: true })
        .range(from, to),
    "survey responses export"
  );
}

async function getSurveyAnswersByResponseId(responseIds: string[]) {
  const supabase = createAdminSupabaseClient();
  const answersByResponseId = new Map<string, Map<string, unknown>>();

  for (const ids of chunkArray(Array.from(new Set(responseIds)))) {
    const answers = await fetchAllRows<{
      survey_response_id: string;
      survey_question_id: string;
      answer_value: unknown;
    }>(
      (from, to) =>
        supabase
          .from("survey_answers")
          .select("survey_response_id, survey_question_id, answer_value")
          .in("survey_response_id", ids)
          .range(from, to),
      "survey answers export"
    );

    answers.forEach((answer) => {
      const answersByQuestion =
        answersByResponseId.get(answer.survey_response_id) ?? new Map();
      answersByQuestion.set(answer.survey_question_id, answer.answer_value);
      answersByResponseId.set(answer.survey_response_id, answersByQuestion);
    });
  }

  return answersByResponseId;
}

function formatSurveyAnswerValue(value: unknown, questionType: SurveyQuestionType) {
  if (value === null || value === undefined) {
    return "";
  }

  if (questionType === "multiple_choice") {
    const values = Array.isArray(value) ? value : [value];

    return values
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean)
      .join(", ");
  }

  if (questionType === "rating") {
    const score = typeof value === "number" ? value : Number(value);

    return Number.isFinite(score) ? `${score}점` : "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean)
      .join(", ");
  }

  return "";
}

function surveyQuestionHeaders(
  questions: Array<{ question_text: string }>
) {
  return questions.map(
    (question, index) => `질문 ${index + 1}: ${question.question_text}`
  );
}

export async function exportSurveyResponsesCsv({
  eventId,
  surveyFormId,
}: {
  eventId: string;
  surveyFormId: string | null;
}) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "survey-responses",
    canExport: canExportSurveyResponsesByRole,
    build: async (event) => {
      if (!surveyFormId) {
        return new Response("surveyFormId is required.", { status: 400 });
      }

      const survey = await getSurveyFormForExport({ eventId, surveyFormId });

      if (!survey) {
        return new Response("Not found.", { status: 404 });
      }

      const [questions, responses] = await Promise.all([
        getSurveyQuestionsForExport(survey.id),
        getSurveyResponsesForExport({ eventId, surveyFormId: survey.id }),
      ]);
      const participantMap = await getParticipantDisplayMap({
        eventId,
        participantIds: responses.map((response) => response.participant_id),
      });
      const answersByResponseId = await getSurveyAnswersByResponseId(
        responses.map((response) => response.id)
      );

      return csvResponseForEvent({
        event,
        parts: ["survey-responses", survey.title],
        headers: [
          "번호",
          "설문명",
          "제출자명",
          "소속/기관",
          "그룹/테이블",
          "제출 시각",
          ...surveyQuestionHeaders(questions),
        ],
        rows: responses.map((response, index) => {
          const participant = participantMap.get(response.participant_id);
          const answersByQuestion =
            answersByResponseId.get(response.id) ?? new Map<string, unknown>();

          return [
            index + 1,
            survey.title,
            participantDisplayName(participant),
            participant?.organization,
            participant?.group_name,
            formatCsvDateTime(response.submitted_at),
            ...questions.map((question) =>
              formatSurveyAnswerValue(
                answersByQuestion.get(question.id),
                question.question_type
              )
            ),
          ];
        }),
      });
    },
  });
}

export async function exportSurveyRespondentsCsv({
  eventId,
  surveyFormId,
}: {
  eventId: string;
  surveyFormId: string | null;
}) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "survey-respondents",
    canExport: canExportSurveyRespondentsByRole,
    build: async (event) => {
      if (!surveyFormId) {
        return new Response("surveyFormId is required.", { status: 400 });
      }

      const survey = await getSurveyFormForExport({ eventId, surveyFormId });

      if (!survey) {
        return new Response("Not found.", { status: 404 });
      }

      const responses = await getSurveyResponsesForExport({
        eventId,
        surveyFormId: survey.id,
      });
      const participantMap = await getParticipantDisplayMap({
        eventId,
        participantIds: responses.map((response) => response.participant_id),
      });

      return csvResponseForEvent({
        event,
        parts: ["survey-respondents", survey.title],
        headers: [
          "번호",
          "설문명",
          "제출자명",
          "소속/기관",
          "그룹/테이블",
          "제출 시각",
          "추첨 대상 여부",
        ],
        rows: responses.map((response, index) => {
          const participant = participantMap.get(response.participant_id);

          return [
            index + 1,
            survey.title,
            participantDisplayName(participant),
            participant?.organization,
            participant?.group_name,
            formatCsvDateTime(response.submitted_at),
            "대상",
          ];
        }),
      });
    },
  });
}

export function drawSourceTypeLabel(sourceType: string | null | undefined) {
  const labels: Record<string, string> = {
    all_participants: "전체 입장자",
    correct_answers: "정답자",
    question_correct_answers: "특정 문제 정답자",
    survey_respondents: "설문 제출자",
  };

  return sourceType ? labels[sourceType] ?? "기타 추첨 대상" : "";
}

function drawWinnerStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: "수령 대기",
    claimed: "수령 완료",
    cancelled: "취소",
    redrawn: "재추첨 완료",
  };

  return status ? labels[status] ?? "상태 미확인" : "";
}

async function getNameMap({
  table,
  ids,
}: {
  table: "prizes" | "survey_forms";
  ids: string[];
}) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const map = new Map<string, string>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();

  for (const chunk of chunkArray(uniqueIds)) {
    const rows = await fetchAllRows<{ id: string; name?: string; title?: string }>(
      (from, to) =>
        supabase
          .from(table)
          .select(table === "prizes" ? "id, name" : "id, title")
          .in("id", chunk)
          .range(from, to),
      `${table} name export`
    );

    rows.forEach((row) => {
      map.set(row.id, row.name ?? row.title ?? "");
    });
  }

  return map;
}

async function getQuestionTextMap(questionIds: string[]) {
  const uniqueIds = Array.from(new Set(questionIds.filter(Boolean)));
  const map = new Map<string, string>();

  if (uniqueIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();

  for (const chunk of chunkArray(uniqueIds)) {
    const rows = await fetchAllRows<{ id: string; question_text: string }>(
      (from, to) =>
        supabase
          .from("questions")
          .select("id, question_text")
          .in("id", chunk)
          .range(from, to),
      "questions text export"
    );

    rows.forEach((row) => {
      map.set(row.id, row.question_text);
    });
  }

  return map;
}

export async function exportDrawWinnersCsv(eventId: string) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "draw-winners",
    canExport: canExportDrawWinnersByRole,
    build: async (event) => {
      const supabase = createAdminSupabaseClient();
      const winners = await fetchAllRows<{
        prize_id: string | null;
        participant_id: string;
        source_type: string;
        source_question_id: string | null;
        survey_form_id: string | null;
        status: string;
        created_at: string | null;
        claimed_at: string | null;
      }>(
        (from, to) =>
          supabase
            .from("draw_winners")
            .select(
              "prize_id, participant_id, source_type, source_question_id, survey_form_id, status, created_at, claimed_at"
            )
            .eq("event_id", eventId)
            .order("created_at", { ascending: true })
            .range(from, to),
        "draw winners export"
      );

      const [prizeMap, participantMap, surveyMap, questionMap] = await Promise.all([
        getNameMap({
          table: "prizes",
          ids: winners
            .map((winner) => winner.prize_id)
            .filter((id): id is string => Boolean(id)),
        }),
        getParticipantDisplayMap({
          eventId,
          participantIds: winners.map((winner) => winner.participant_id),
        }),
        getNameMap({
          table: "survey_forms",
          ids: winners
            .map((winner) => winner.survey_form_id)
            .filter((id): id is string => Boolean(id)),
        }),
        getQuestionTextMap(
          winners
            .map((winner) => winner.source_question_id)
            .filter((id): id is string => Boolean(id))
        ),
      ]);

      return csvResponseForEvent({
        event,
        parts: ["draw-winners"],
        headers: [
          "번호",
          "당첨 시각",
          "경품명",
          "당첨자명",
          "소속/기관",
          "그룹/테이블",
          "추첨 대상 유형",
          "관련 설문명",
          "비고",
        ],
        rows: winners.map((winner, index) => {
          const participant = participantMap.get(winner.participant_id);
          const noteParts = [
            drawWinnerStatusLabel(winner.status),
            winner.source_question_id
              ? `관련 문제: ${questionMap.get(winner.source_question_id) ?? "확인 필요"}`
              : "",
            winner.claimed_at
              ? `수령 시각: ${formatCsvDateTime(winner.claimed_at)}`
              : "",
          ].filter(Boolean);

          return [
            index + 1,
            formatCsvDateTime(winner.created_at),
            winner.prize_id ? prizeMap.get(winner.prize_id) ?? "경품 미확인" : "",
            participantDisplayName(participant),
            participant?.organization,
            participant?.group_name,
            drawSourceTypeLabel(winner.source_type),
            winner.survey_form_id ? surveyMap.get(winner.survey_form_id) ?? "" : "",
            noteParts.join(" / "),
          ];
        }),
      });
    },
  });
}

function qnaStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: "검토 중",
    approved: "승인",
    hidden: "숨김",
    deleted: "삭제 상태",
  };

  return status ? labels[status] ?? "상태 미확인" : "";
}

export async function exportQnaCsv(eventId: string) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "qna",
    canExport: canExportQnaByRole,
    build: async (event) => {
      const supabase = createAdminSupabaseClient();
      const questions = await fetchAllRows<{
        participant_id: string | null;
        question_text: string;
        status: string;
        is_pinned: boolean | null;
        created_at: string | null;
        approved_at: string | null;
      }>(
        (from, to) =>
          supabase
            .from("qna_questions")
            .select(
              "participant_id, question_text, status, is_pinned, created_at, approved_at"
            )
            .eq("event_id", eventId)
            .order("created_at", { ascending: true })
            .range(from, to),
        "qna export"
      );
      const participantMap = await getParticipantDisplayMap({
        eventId,
        participantIds: questions
          .map((question) => question.participant_id)
          .filter((id): id is string => Boolean(id)),
      });

      return csvResponseForEvent({
        event,
        parts: ["qna"],
        headers: [
          "번호",
          "제출 시각",
          "질문자명",
          "소속/기관",
          "그룹/테이블",
          "질문 내용",
          "상태",
          "승인 여부",
          "고정 여부",
          "답변/메모",
        ],
        rows: questions.map((question, index) => {
          const participant = question.participant_id
            ? participantMap.get(question.participant_id)
            : undefined;

          return [
            index + 1,
            formatCsvDateTime(question.created_at),
            participantDisplayName(participant),
            participant?.organization,
            participant?.group_name,
            question.question_text,
            qnaStatusLabel(question.status),
            question.status === "approved" ? "승인" : "미승인",
            question.is_pinned ? "고정" : "",
            "",
          ];
        }),
      });
    },
  });
}

type OperationLogRow = {
  admin_user_id: string | null;
  action: string;
  detail: unknown;
  created_at: string | null;
};

type AdminDisplayRow = {
  id: string;
  name: string | null;
  role: string;
};

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    event_created: "행사 생성",
    event_cloned: "행사 복제 생성",
    event_updated: "행사 수정",
    quiz_session_created: "퀴즈 세션 생성",
    quiz_session_updated: "퀴즈 세션 수정",
    quiz_session_deleted: "퀴즈 세션 삭제",
    question_created: "문제 생성",
    question_updated: "문제 수정",
    question_deleted: "문제 삭제",
    participant_registered: "참가자 등록",
    answer_submitted: "참가자 답안 제출",
    qna_question_submitted: "Q&A 질문 접수",
    qna_question_deleted: "Q&A 질문 삭제 상태 변경",
    qna_question_approved: "Q&A 질문 승인",
    qna_question_hidden: "Q&A 질문 숨김",
    qna_question_pinned: "Q&A 질문 고정",
    qna_question_unpinned: "Q&A 질문 고정 해제",
    qna_question_screened: "승인 질문 스크린 송출",
    qna_question_shown_on_screen: "승인 질문 스크린 송출",
    live_question_started: "퀴즈 문제 송출",
    live_question_closed: "답변 마감",
    live_result_shown: "결과 화면 송출",
    live_screen_set_waiting: "대기 화면 송출",
    live_screen_set_join_qr: "QR 참여 안내 화면 송출",
    live_screen_set_break: "휴식 화면 송출",
    live_screen_set_lucky_draw: "럭키드로우 준비 화면 송출",
    live_screen_set_qna_waiting: "Q&A 대기 화면 송출",
    live_screen_set_quiz: "퀴즈 화면 송출",
    live_answer_revealed: "정답 공개",
    survey_created: "설문 생성",
    survey_updated: "설문 수정",
    survey_deleted: "설문 삭제",
    survey_archived: "설문 보관",
    survey_started: "설문 시작",
    survey_closed: "설문 마감",
    survey_default_questions_created: "기본 설문 질문 생성",
    live_screen_set_survey_intro: "설문 안내 화면 송출",
    live_screen_set_survey_status: "설문 제출 현황 화면 송출",
    prize_created: "경품 생성",
    prize_updated: "경품 수정",
    prize_deleted: "경품 삭제",
    draw_winner_created: "당첨자 추첨",
    draw_winner_selected: "럭키드로우 당첨자 선정",
    draw_winner_screened: "당첨자 스크린 송출",
    draw_winner_status_updated: "당첨자 상태 변경",
  };

  return labels[action.toLowerCase()] ?? "기타 작업";
}

function modeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "답변 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
    survey: "설문",
  };

  return value ? labels[value] ?? "기타 모드" : "";
}

function sceneLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    join_qr: "QR 참여 안내",
    question: "퀴즈 문제 화면",
    quiz_question: "퀴즈 문제 화면",
    closed: "답변 마감 화면",
    result: "결과 화면",
    quiz_results: "결과 화면",
    qna: "Q&A 접수 화면",
    qna_waiting: "Q&A 접수 화면",
    qna_question: "승인 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    lucky_draw_ready: "럭키드로우 준비 화면",
    draw_winner: "당첨자 발표 화면",
    lucky_draw_winner: "당첨자 발표 화면",
    survey_intro: "설문 참여 안내 화면",
    survey_active: "설문 진행 화면",
    survey_status: "설문 제출 현황 화면",
    survey_closed: "설문 마감 화면",
  };

  return value ? labels[value] ?? "기타 화면" : "";
}

function statusLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    pending: "대기",
    approved: "승인",
    hidden: "숨김",
    deleted: "삭제 상태",
    claimed: "수령 완료",
    cancelled: "취소",
    redrawn: "재추첨 완료",
    draft: "작성 중",
    open: "응답 가능",
    closed: "마감",
    archived: "보관",
  };

  return value ? labels[value] ?? "상태 미확인" : "";
}

function detailRecord(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return {};
  }

  return detail as Record<string, unknown>;
}

function detailString(detail: Record<string, unknown>, key: string) {
  const value = detail[key];

  return typeof value === "string" ? value : "";
}

function detailNumber(detail: Record<string, unknown>, key: string) {
  const value = detail[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function detailBoolean(detail: Record<string, unknown>, key: string) {
  const value = detail[key];

  return typeof value === "boolean" ? value : null;
}

function operationModeScene(detail: Record<string, unknown>) {
  const mode = modeLabel(detailString(detail, "mode"));
  const scene = sceneLabel(
    detailString(detail, "screen_scene") || detailString(detail, "screenScene")
  );

  return [mode, scene].filter(Boolean).join(" / ");
}

function operationDescription(action: string, detail: Record<string, unknown>) {
  const descriptionParts = [
    detailString(detail, "status")
      ? `상태: ${statusLabel(detailString(detail, "status"))}`
      : "",
    detailString(detail, "source_type")
      ? `추첨 대상: ${drawSourceTypeLabel(detailString(detail, "source_type"))}`
      : "",
  ];
  const participantCount = detailNumber(detail, "participant_count");
  const pinned = detailBoolean(detail, "is_pinned");
  const changedAt = detailString(detail, "changed_at");

  if (participantCount !== null) {
    descriptionParts.push(`대상 인원: ${participantCount.toLocaleString("ko-KR")}명`);
  }

  if (pinned !== null) {
    descriptionParts.push(pinned ? "질문 고정" : "질문 고정 해제");
  }

  if (changedAt) {
    descriptionParts.push(`변경 시각: ${formatCsvDateTime(changedAt)}`);
  }

  return descriptionParts.filter(Boolean).join(" / ") || actionLabel(action);
}

async function getAdminDisplayMap(logs: OperationLogRow[]) {
  const adminIds = Array.from(
    new Set(
      logs
        .map((log) => log.admin_user_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const map = new Map<string, AdminDisplayRow>();

  if (adminIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();

  for (const ids of chunkArray(adminIds)) {
    const rows = await fetchAllRows<AdminDisplayRow>(
      (from, to) =>
        supabase
          .from("admin_profiles")
          .select("id, name, role")
          .in("id", ids)
          .range(from, to),
      "admin display export"
    );

    rows.forEach((admin) => {
      map.set(admin.id, admin);
    });
  }

  return map;
}

function adminLabel(adminUserId: string | null, adminMap: Map<string, AdminDisplayRow>) {
  if (!adminUserId) {
    return "시스템";
  }

  const admin = adminMap.get(adminUserId);

  if (!admin) {
    return "관리자";
  }

  return admin.name?.trim()
    ? `${admin.name.trim()} (${admin.role})`
    : `관리자 (${admin.role})`;
}

export async function exportOperationLogsCsv(eventId: string) {
  return createAuthorizedExportResponse({
    eventId,
    kind: "operation-logs",
    canExport: canExportOperationLogsByRole,
    build: async (event) => {
      const supabase = createAdminSupabaseClient();
      const logs = await fetchAllRows<OperationLogRow>(
        (from, to) =>
          supabase
            .from("operation_logs")
            .select("admin_user_id, action, detail, created_at")
            .eq("event_id", eventId)
            .order("created_at", { ascending: true })
            .range(from, to),
        "operation logs export"
      );
      const adminMap = await getAdminDisplayMap(logs);

      return csvResponseForEvent({
        event,
        parts: ["operation-logs"],
        headers: [
          "번호",
          "시각",
          "작업 유형",
          "한국어 작업명",
          "화면/모드",
          "설명",
          "관리자/시스템",
        ],
        rows: logs.map((log, index) => {
          const detail = detailRecord(log.detail);

          return [
            index + 1,
            formatCsvDateTime(log.created_at),
            log.action,
            actionLabel(log.action),
            operationModeScene(detail),
            operationDescription(log.action, detail),
            adminLabel(log.admin_user_id, adminMap),
          ];
        }),
      });
    },
  });
}
