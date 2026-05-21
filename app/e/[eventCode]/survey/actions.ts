"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  autoCloseExpiredSurveyForm,
  isSurveyAcceptingResponses,
  normalizeSurveyQuestion,
  type SurveyQuestionRecord,
} from "@/lib/data/surveys";

type SurveyEventRow = {
  id: string;
  event_code: string;
  is_active: boolean | null;
};

type ParsedAnswerValue =
  | { value: string | number | string[] }
  | { skip: true }
  | { error: string };

function normalizeEventCode(eventCode: string) {
  return eventCode.trim().toLowerCase();
}

function redirectToSurvey({
  eventCode,
  surveyFormId,
  message,
  error,
}: {
  eventCode: string;
  surveyFormId?: string | null;
  message?: string;
  error?: string;
}): never {
  const params = new URLSearchParams();

  if (message) {
    params.set("message", message);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();
  const path = surveyFormId
    ? `/e/${eventCode}/survey/${surveyFormId}`
    : `/e/${eventCode}/survey`;

  redirect(`${path}${query ? `?${query}` : ""}`);
}

function getTextAnswer(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getArrayAnswer(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" ||
    error?.message?.toLowerCase().includes("duplicate key")
  );
}

function parseAnswerValue(
  question: SurveyQuestionRecord,
  formData: FormData
): ParsedAnswerValue {
  const key = `answer_${question.id}`;

  if (question.question_type === "short_text" || question.question_type === "long_text") {
    const value = getTextAnswer(formData, key);

    if (question.is_required && !value) {
      return { error: `"${question.question_text}" 질문에 답변해 주세요.` };
    }

    return value ? { value } : { skip: true };
  }

  if (question.question_type === "single_choice") {
    const value = getTextAnswer(formData, key);

    if (question.is_required && !value) {
      return { error: `"${question.question_text}" 질문의 선택지를 골라 주세요.` };
    }

    if (!value) {
      return { skip: true };
    }

    if (!question.options.includes(value)) {
      return { error: `"${question.question_text}" 질문의 선택지가 올바르지 않습니다.` };
    }

    return { value };
  }

  if (question.question_type === "multiple_choice") {
    const values = getArrayAnswer(formData, key).filter((value) =>
      question.options.includes(value)
    );

    if (question.is_required && values.length === 0) {
      return { error: `"${question.question_text}" 질문의 선택지를 1개 이상 골라 주세요.` };
    }

    return values.length > 0 ? { value: values } : { skip: true };
  }

  if (question.question_type === "rating") {
    const value = Number(getTextAnswer(formData, key));

    if (!Number.isInteger(value) || value < 1 || value > 5) {
      if (question.is_required) {
        return { error: `"${question.question_text}" 질문의 만족도를 선택해 주세요.` };
      }

      return { skip: true };
    }

    return { value };
  }

  return { error: "지원하지 않는 설문 질문 타입입니다." };
}

async function writeSurveySubmitLog({
  eventId,
  surveyFormId,
  surveyResponseId,
}: {
  eventId: string;
  surveyFormId: string;
  surveyResponseId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: null,
    action: "survey_response_submitted",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      survey_response_id: surveyResponseId,
    },
  });

  if (error) {
    console.error("[participant-survey] Failed to write survey submit log.", {
      eventId,
      surveyFormId,
      surveyResponseId,
      message: error.message,
      code: error.code,
    });
  }
}

export async function submitSurveyResponse(
  eventCode: string,
  surveyFormId: string,
  formData: FormData
) {
  const normalizedEventCode = normalizeEventCode(eventCode);
  const participantSession =
    await readParticipantSessionCookie(normalizedEventCode);

  if (!participantSession) {
    redirect(`/e/${normalizedEventCode}/join`);
  }

  const supabase = createAdminSupabaseClient();
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id, event_code, is_active")
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (eventError) {
    console.error("[participant-survey] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: eventError.message,
      code: eventError.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "행사 정보를 확인하는 중 오류가 발생했습니다.",
    });
  }

  const event = eventData as SurveyEventRow | null;

  if (
    !event ||
    event.is_active === false ||
    event.id !== participantSession.event_id
  ) {
    redirectToSurvey({
      eventCode: normalizedEventCode,
      error: "현재 설문에 참여할 수 없는 행사입니다.",
    });
  }

  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantSession.participant_id)
    .eq("event_id", event.id)
    .maybeSingle();

  if (participantError) {
    console.error("[participant-survey] Failed to load participant.", {
      eventId: event.id,
      message: participantError.message,
      code: participantError.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "참가자 정보를 확인하는 중 오류가 발생했습니다.",
    });
  }

  if (!participantData) {
    redirect(`/e/${normalizedEventCode}/join`);
  }

  await autoCloseExpiredSurveyForm({
    eventId: event.id,
    surveyFormId,
  });

  const { data: surveyData, error: surveyError } = await supabase
    .from("survey_forms")
    .select("id, event_id, title, status, active_started_at, active_ends_at, closed_at")
    .eq("id", surveyFormId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (surveyError) {
    console.error("[participant-survey] Failed to load survey form.", {
      eventId: event.id,
      surveyFormId,
      message: surveyError.message,
      code: surveyError.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "설문 정보를 확인하는 중 오류가 발생했습니다.",
    });
  }

  const survey = surveyData as
    | {
        id: string;
        event_id: string;
        title: string;
        status: "draft" | "open" | "closed" | "archived";
        active_started_at: string | null;
        active_ends_at: string | null;
        closed_at: string | null;
      }
    | null;

  if (!survey || !isSurveyAcceptingResponses(survey)) {
    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "설문 시간이 종료되었거나 현재 제출할 수 없는 설문입니다.",
    });
  }

  const { data: existingResponse, error: existingError } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("survey_form_id", surveyFormId)
    .eq("participant_id", participantSession.participant_id)
    .maybeSingle();

  if (existingError) {
    console.error("[participant-survey] Failed to check existing response.", {
      eventId: event.id,
      surveyFormId,
      message: existingError.message,
      code: existingError.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "제출 여부를 확인하는 중 오류가 발생했습니다.",
    });
  }

  if (existingResponse) {
    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      message: "이미 제출한 설문입니다.",
    });
  }

  const { data: questionData, error: questionError } = await supabase
    .from("survey_questions")
    .select(
      "id, survey_form_id, question_text, question_type, options, is_required, sort_order, created_at, updated_at"
    )
    .eq("survey_form_id", surveyFormId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (questionError) {
    console.error("[participant-survey] Failed to load survey questions.", {
      eventId: event.id,
      surveyFormId,
      message: questionError.message,
      code: questionError.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "설문 질문을 확인하는 중 오류가 발생했습니다.",
    });
  }

  const questions = (questionData ?? []).map(normalizeSurveyQuestion);

  if (questions.length === 0) {
    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "이 설문에는 아직 질문이 없습니다.",
    });
  }

  const answerRows: Array<{
    survey_question_id: string;
    answer_value: string | number | string[];
  }> = [];

  for (const question of questions) {
    const parsed = parseAnswerValue(question, formData);

    if ("error" in parsed) {
      redirectToSurvey({
        eventCode: normalizedEventCode,
        surveyFormId,
        error: parsed.error,
      });
    }

    if ("value" in parsed) {
      answerRows.push({
        survey_question_id: question.id,
        answer_value: parsed.value,
      });
    }
  }

  const { data: responseData, error: responseError } = await supabase
    .from("survey_responses")
    .insert({
      event_id: event.id,
      survey_form_id: surveyFormId,
      participant_id: participantSession.participant_id,
    })
    .select("id")
    .single();

  if (responseError || !responseData) {
    if (isUniqueViolation(responseError)) {
      redirectToSurvey({
        eventCode: normalizedEventCode,
        surveyFormId,
        message: "이미 제출한 설문입니다.",
      });
    }

    console.error("[participant-survey] Failed to insert survey response.", {
      eventId: event.id,
      surveyFormId,
      message: responseError?.message,
      code: responseError?.code,
    });

    redirectToSurvey({
      eventCode: normalizedEventCode,
      surveyFormId,
      error: "설문 제출 중 오류가 발생했습니다.",
    });
  }

  if (answerRows.length > 0) {
    const { error: answersError } = await supabase.from("survey_answers").insert(
      answerRows.map((answer) => ({
        survey_response_id: responseData.id,
        survey_question_id: answer.survey_question_id,
        answer_value: answer.answer_value,
      }))
    );

    if (answersError) {
      await supabase.from("survey_responses").delete().eq("id", responseData.id);
      console.error("[participant-survey] Failed to insert survey answers.", {
        eventId: event.id,
        surveyFormId,
        surveyResponseId: responseData.id,
        message: answersError.message,
        code: answersError.code,
      });

      redirectToSurvey({
        eventCode: normalizedEventCode,
        surveyFormId,
        error: "답변 저장 중 오류가 발생했습니다. 다시 제출해 주세요.",
      });
    }
  }

  await writeSurveySubmitLog({
    eventId: event.id,
    surveyFormId,
    surveyResponseId: responseData.id,
  });

  revalidatePath(`/e/${event.event_code}/survey`);
  revalidatePath(`/e/${event.event_code}/survey/${surveyFormId}`);
  revalidatePath(`/admin/events/${event.id}/surveys`);

  redirectToSurvey({
    eventCode: event.event_code,
    message: "설문 제출이 완료되었습니다. 감사합니다.",
  });
}
