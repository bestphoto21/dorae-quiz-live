import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type SurveyStatus = "draft" | "open" | "closed" | "archived";

export type SurveyQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "rating";

export type SurveyFormRecord = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type SurveyQuestionRecord = {
  id: string;
  survey_form_id: string;
  question_text: string;
  question_type: SurveyQuestionType;
  options: string[];
  is_required: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type SurveyFormSummary = SurveyFormRecord & {
  questions: SurveyQuestionRecord[];
  response_count: number;
};

export type SurveyResponseRecord = {
  id: string;
  survey_form_id: string;
  participant_id: string;
  submitted_at: string | null;
};

export type SurveyResponseReviewAnswer = {
  question_id: string;
  question_text: string;
  question_type: SurveyQuestionType;
  answer_label: string;
};

export type SurveyResponseReview = {
  id: string;
  participant_name: string;
  organization: string | null;
  submitted_at: string | null;
  answers: SurveyResponseReviewAnswer[];
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Survey data helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

function asStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => (typeof option === "string" ? option.trim() : ""))
    .filter(Boolean);
}

function formatSurveyAnswerValue(value: unknown, questionType: SurveyQuestionType) {
  if (value === null || value === undefined) {
    return "응답 없음";
  }

  if (questionType === "multiple_choice") {
    return Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : String(item)))
          .filter(Boolean)
          .join(", ") || "응답 없음"
      : String(value);
  }

  if (questionType === "rating") {
    const score = typeof value === "number" ? value : Number(value);

    return Number.isFinite(score) ? `${score}점` : "응답 없음";
  }

  if (typeof value === "string") {
    return value.trim() || "응답 없음";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "응답 형식 확인 필요";
}

export function normalizeSurveyQuestion(row: {
  id: string;
  survey_form_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  is_required: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}): SurveyQuestionRecord {
  return {
    id: row.id,
    survey_form_id: row.survey_form_id,
    question_text: row.question_text,
    question_type: row.question_type as SurveyQuestionType,
    options: asStringOptions(row.options),
    is_required: row.is_required,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSurveyFormsForEvent(
  eventId: string
): Promise<SurveyFormSummary[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const [{ data: forms, error: formsError }, { data: questions, error: questionsError }, { data: responses, error: responsesError }] =
    await Promise.all([
      supabase
        .from("survey_forms")
        .select(
          "id, event_id, title, description, status, sort_order, created_at, updated_at"
        )
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_questions")
        .select(
          "id, survey_form_id, question_text, question_type, options, is_required, sort_order, created_at, updated_at"
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_responses")
        .select("id, survey_form_id")
        .eq("event_id", eventId),
    ]);

  if (formsError) {
    console.error("[survey-data] Failed to load survey forms.", {
      eventId,
      message: formsError.message,
      code: formsError.code,
    });

    return [];
  }

  if (questionsError) {
    console.error("[survey-data] Failed to load survey questions.", {
      eventId,
      message: questionsError.message,
      code: questionsError.code,
    });
  }

  if (responsesError) {
    console.error("[survey-data] Failed to load survey response counts.", {
      eventId,
      message: responsesError.message,
      code: responsesError.code,
    });
  }

  const formRows = (forms ?? []) as SurveyFormRecord[];
  const formIds = new Set(formRows.map((form) => form.id));
  const questionsByForm = new Map<string, SurveyQuestionRecord[]>();

  ((questions ?? []) as Array<Parameters<typeof normalizeSurveyQuestion>[0]>)
    .filter((question) => formIds.has(question.survey_form_id))
    .forEach((question) => {
      const normalized = normalizeSurveyQuestion(question);
      const list = questionsByForm.get(normalized.survey_form_id) ?? [];
      list.push(normalized);
      questionsByForm.set(normalized.survey_form_id, list);
    });

  const responseCounts = new Map<string, number>();
  (responses ?? []).forEach((response) => {
    responseCounts.set(
      response.survey_form_id,
      (responseCounts.get(response.survey_form_id) ?? 0) + 1
    );
  });

  return formRows.map((form) => ({
    ...form,
    questions: questionsByForm.get(form.id) ?? [],
    response_count: responseCounts.get(form.id) ?? 0,
  }));
}

export async function getOpenSurveyFormsForParticipant({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const [{ data: forms, error: formsError }, { data: responses, error: responsesError }] =
    await Promise.all([
      supabase
        .from("survey_forms")
        .select(
          "id, event_id, title, description, status, sort_order, created_at, updated_at"
        )
        .eq("event_id", eventId)
        .eq("status", "open")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("survey_responses")
        .select("id, survey_form_id, participant_id, submitted_at")
        .eq("event_id", eventId)
        .eq("participant_id", participantId),
    ]);

  if (formsError) {
    console.error("[survey-data] Failed to load participant survey list.", {
      eventId,
      message: formsError.message,
      code: formsError.code,
    });

    return { forms: [], submittedFormIds: new Set<string>() };
  }

  if (responsesError) {
    console.error("[survey-data] Failed to load participant survey responses.", {
      eventId,
      participantId,
      message: responsesError.message,
      code: responsesError.code,
    });
  }

  return {
    forms: (forms ?? []) as SurveyFormRecord[],
    submittedFormIds: new Set(
      ((responses ?? []) as SurveyResponseRecord[]).map(
        (response) => response.survey_form_id
      )
    ),
  };
}

export async function getSurveyResponseReviews({
  eventId,
  surveyFormId,
  limit = 100,
}: {
  eventId: string;
  surveyFormId: string;
  limit?: number;
}): Promise<SurveyResponseReview[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const { data: responses, error: responseError } = await supabase
    .from("survey_responses")
    .select("id, participant_id, submitted_at")
    .eq("event_id", eventId)
    .eq("survey_form_id", surveyFormId)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  if (responseError) {
    console.error("[survey-data] Failed to load survey response reviews.", {
      eventId,
      surveyFormId,
      message: responseError.message,
      code: responseError.code,
    });

    return [];
  }

  const responseRows = (responses ?? []) as Array<{
    id: string;
    participant_id: string;
    submitted_at: string | null;
  }>;

  if (responseRows.length === 0) {
    return [];
  }

  const responseIds = responseRows.map((response) => response.id);
  const participantIds = Array.from(
    new Set(responseRows.map((response) => response.participant_id))
  );

  const [
    { data: participants, error: participantError },
    { data: questions, error: questionError },
    { data: answers, error: answerError },
  ] = await Promise.all([
    supabase
      .from("participants")
      .select("id, name, display_name, organization")
      .eq("event_id", eventId)
      .in("id", participantIds),
    supabase
      .from("survey_questions")
      .select(
        "id, survey_form_id, question_text, question_type, options, is_required, sort_order, created_at, updated_at"
      )
      .eq("survey_form_id", surveyFormId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("survey_answers")
      .select("survey_response_id, survey_question_id, answer_value")
      .in("survey_response_id", responseIds),
  ]);

  if (participantError) {
    console.error("[survey-data] Failed to load survey response participants.", {
      eventId,
      surveyFormId,
      message: participantError.message,
      code: participantError.code,
    });
  }

  if (questionError) {
    console.error("[survey-data] Failed to load survey review questions.", {
      eventId,
      surveyFormId,
      message: questionError.message,
      code: questionError.code,
    });
  }

  if (answerError) {
    console.error("[survey-data] Failed to load survey review answers.", {
      eventId,
      surveyFormId,
      message: answerError.message,
      code: answerError.code,
    });
  }

  const participantsById = new Map(
    ((participants ?? []) as Array<{
      id: string;
      name: string;
      display_name: string | null;
      organization: string | null;
    }>).map((participant) => [
      participant.id,
      {
        participant_name:
          participant.display_name?.trim() ||
          participant.name?.trim() ||
          "이름 없는 참가자",
        organization: participant.organization?.trim() || null,
      },
    ])
  );
  const questionRows = ((questions ?? []) as Array<
    Parameters<typeof normalizeSurveyQuestion>[0]
  >).map(normalizeSurveyQuestion);
  const questionsById = new Map(questionRows.map((question) => [question.id, question]));
  const answersByResponseId = new Map<
    string,
    Array<{
      survey_question_id: string;
      answer_value: unknown;
    }>
  >();

  ((answers ?? []) as Array<{
    survey_response_id: string;
    survey_question_id: string;
    answer_value: unknown;
  }>).forEach((answer) => {
    const list = answersByResponseId.get(answer.survey_response_id) ?? [];
    list.push({
      survey_question_id: answer.survey_question_id,
      answer_value: answer.answer_value,
    });
    answersByResponseId.set(answer.survey_response_id, list);
  });

  return responseRows.map((response) => {
    const participant = participantsById.get(response.participant_id);
    const answersForResponse = answersByResponseId.get(response.id) ?? [];
    const answersByQuestionId = new Map(
      answersForResponse.map((answer) => [answer.survey_question_id, answer])
    );

    return {
      id: response.id,
      participant_name: participant?.participant_name ?? "이름 없는 참가자",
      organization: participant?.organization ?? null,
      submitted_at: response.submitted_at,
      answers: questionRows.map((question) => {
        const answer = answersByQuestionId.get(question.id);
        const normalizedQuestion = questionsById.get(question.id) ?? question;

        return {
          question_id: normalizedQuestion.id,
          question_text: normalizedQuestion.question_text,
          question_type: normalizedQuestion.question_type,
          answer_label: answer
            ? formatSurveyAnswerValue(
                answer.answer_value,
                normalizedQuestion.question_type
              )
            : "응답 없음",
        };
      }),
    };
  });
}
