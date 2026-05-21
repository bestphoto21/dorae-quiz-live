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
