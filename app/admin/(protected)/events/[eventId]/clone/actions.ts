"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEventAccess } from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type CloneEventField = "title" | "event_code";

export type CloneEventFormValues = {
  title: string;
  event_code: string;
};

export type CloneEventFormState = {
  message: string | null;
  fieldErrors?: Partial<Record<CloneEventField, string>>;
  values?: CloneEventFormValues;
};

type SourceEventRow = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  venue: string | null;
  primary_color: string | null;
  logo_url: string | null;
  screen_notice: string | null;
};

type QuizSessionRow = {
  id: string;
  title: string;
};

type QuestionRow = {
  session_id: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  time_limit_seconds: number;
  order_index: number;
  is_active: boolean | null;
  question_type: string;
};

type SurveyFormRow = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};

type SurveyQuestionRow = {
  survey_form_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  is_required: boolean;
  sort_order: number;
};

type PrizeRow = {
  name: string;
  quantity: number;
};

const EVENT_CODE_PATTERN = /^[a-z0-9-]+$/;
const DEFAULT_PRIMARY_COLOR = "#0a1a38";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function normalizeEventCode(value: string) {
  return value.trim().toLowerCase();
}

function getCloneFormValues(formData: FormData): CloneEventFormValues {
  return {
    title: getFormString(formData, "title"),
    event_code: normalizeEventCode(getFormString(formData, "event_code")),
  };
}

function validateCloneForm(formData: FormData) {
  const values = getCloneFormValues(formData);
  const fieldErrors: Partial<Record<CloneEventField, string>> = {};

  if (!values.title) {
    fieldErrors.title = "새 행사명을 입력해 주세요.";
  }

  if (!values.event_code) {
    fieldErrors.event_code = "새 행사 코드를 입력해 주세요.";
  } else if (values.event_code.length < 3 || values.event_code.length > 40) {
    fieldErrors.event_code = "행사 코드는 3~40자로 입력해 주세요.";
  } else if (!EVENT_CODE_PATTERN.test(values.event_code)) {
    fieldErrors.event_code =
      "행사 코드는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.";
  } else if (values.event_code.startsWith("-") || values.event_code.endsWith("-")) {
    fieldErrors.event_code = "행사 코드는 하이픈으로 시작하거나 끝날 수 없습니다.";
  }

  return { values, fieldErrors };
}

async function cleanupCreatedEvent(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    console.error("[event-clone] Failed to cleanup incomplete clone.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }
}

async function writeCloneLog({
  eventId,
  adminUserId,
  sourceEvent,
  counts,
}: {
  eventId: string;
  adminUserId: string;
  sourceEvent: SourceEventRow;
  counts: {
    quizSessions: number;
    questions: number;
    surveyForms: number;
    surveyQuestions: number;
    prizes: number;
  };
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: adminUserId,
    action: "event_cloned",
    detail: {
      source_event_id: sourceEvent.id,
      source_event_code: sourceEvent.event_code,
      quiz_session_count: counts.quizSessions,
      question_count: counts.questions,
      survey_form_count: counts.surveyForms,
      survey_question_count: counts.surveyQuestions,
      prize_count: counts.prizes,
    },
  });

  if (error) {
    console.error("[event-clone] Failed to write clone operation log.", {
      eventId,
      adminUserId,
      message: error.message,
      code: error.code,
    });
  }
}

async function loadQuizSessions(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, title")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`quiz_sessions:${error.code ?? "query_error"}`);
  }

  return (data ?? []) as QuizSessionRow[];
}

async function cloneQuizContent({
  sourceEventId,
  newEventId,
}: {
  sourceEventId: string;
  newEventId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const sourceSessions = await loadQuizSessions(sourceEventId);

  if (sourceSessions.length === 0) {
    return { quizSessions: 0, questions: 0 };
  }

  const { data: insertedSessions, error: sessionInsertError } = await supabase
    .from("quiz_sessions")
    .insert(
      sourceSessions.map((session) => ({
        event_id: newEventId,
        title: session.title,
        status: "draft",
      }))
    )
    .select("id");

  if (sessionInsertError || !insertedSessions) {
    throw new Error(
      `quiz_sessions_insert:${sessionInsertError?.code ?? "unknown_error"}`
    );
  }

  const sessionIdMap = new Map<string, string>();
  sourceSessions.forEach((sourceSession, index) => {
    const insertedSession = insertedSessions[index];

    if (insertedSession?.id) {
      sessionIdMap.set(sourceSession.id, insertedSession.id);
    }
  });

  const sourceSessionIds = sourceSessions.map((session) => session.id);
  const { data: questions, error: questionLoadError } = await supabase
    .from("questions")
    .select(
      "session_id, question_text, option_1, option_2, option_3, option_4, correct_option, time_limit_seconds, order_index, is_active, question_type"
    )
    .in("session_id", sourceSessionIds)
    .order("session_id", { ascending: true })
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (questionLoadError) {
    throw new Error(`questions:${questionLoadError.code ?? "query_error"}`);
  }

  const questionRows = (questions ?? []) as QuestionRow[];

  if (questionRows.length === 0) {
    return { quizSessions: sourceSessions.length, questions: 0 };
  }

  const { error: questionInsertError } = await supabase.from("questions").insert(
    questionRows.map((question) => {
      const newSessionId = sessionIdMap.get(question.session_id);

      if (!newSessionId) {
        throw new Error("questions:missing_session_map");
      }

      return {
        session_id: newSessionId,
        question_text: question.question_text,
        option_1: question.option_1,
        option_2: question.option_2,
        option_3: question.option_3,
        option_4: question.option_4,
        correct_option: question.correct_option,
        time_limit_seconds: question.time_limit_seconds,
        order_index: question.order_index,
        is_active: question.is_active,
        question_type: question.question_type,
      };
    })
  );

  if (questionInsertError) {
    throw new Error(`questions_insert:${questionInsertError.code ?? "query_error"}`);
  }

  return {
    quizSessions: sourceSessions.length,
    questions: questionRows.length,
  };
}

async function cloneSurveyContent({
  sourceEventId,
  newEventId,
}: {
  sourceEventId: string;
  newEventId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data: forms, error: formLoadError } = await supabase
    .from("survey_forms")
    .select("id, title, description, sort_order")
    .eq("event_id", sourceEventId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (formLoadError) {
    throw new Error(`survey_forms:${formLoadError.code ?? "query_error"}`);
  }

  const sourceForms = (forms ?? []) as SurveyFormRow[];

  if (sourceForms.length === 0) {
    return { surveyForms: 0, surveyQuestions: 0 };
  }

  const { data: insertedForms, error: formInsertError } = await supabase
    .from("survey_forms")
    .insert(
      sourceForms.map((form) => ({
        event_id: newEventId,
        title: form.title,
        description: form.description,
        status: "draft",
        sort_order: form.sort_order,
        active_started_at: null,
        active_ends_at: null,
        closed_at: null,
      }))
    )
    .select("id");

  if (formInsertError || !insertedForms) {
    throw new Error(`survey_forms_insert:${formInsertError?.code ?? "unknown_error"}`);
  }

  const surveyFormIdMap = new Map<string, string>();
  sourceForms.forEach((sourceForm, index) => {
    const insertedForm = insertedForms[index];

    if (insertedForm?.id) {
      surveyFormIdMap.set(sourceForm.id, insertedForm.id);
    }
  });

  const { data: questions, error: questionLoadError } = await supabase
    .from("survey_questions")
    .select(
      "survey_form_id, question_text, question_type, options, is_required, sort_order"
    )
    .in(
      "survey_form_id",
      sourceForms.map((form) => form.id)
    )
    .order("survey_form_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (questionLoadError) {
    throw new Error(`survey_questions:${questionLoadError.code ?? "query_error"}`);
  }

  const questionRows = (questions ?? []) as SurveyQuestionRow[];

  if (questionRows.length === 0) {
    return {
      surveyForms: sourceForms.length,
      surveyQuestions: 0,
    };
  }

  const { error: questionInsertError } = await supabase
    .from("survey_questions")
    .insert(
      questionRows.map((question) => {
        const newSurveyFormId = surveyFormIdMap.get(question.survey_form_id);

        if (!newSurveyFormId) {
          throw new Error("survey_questions:missing_form_map");
        }

        return {
          survey_form_id: newSurveyFormId,
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
          is_required: question.is_required,
          sort_order: question.sort_order,
        };
      })
    );

  if (questionInsertError) {
    throw new Error(
      `survey_questions_insert:${questionInsertError.code ?? "query_error"}`
    );
  }

  return {
    surveyForms: sourceForms.length,
    surveyQuestions: questionRows.length,
  };
}

async function clonePrizes({
  sourceEventId,
  newEventId,
}: {
  sourceEventId: string;
  newEventId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("prizes")
    .select("name, quantity")
    .eq("event_id", sourceEventId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`prizes:${error.code ?? "query_error"}`);
  }

  const prizes = (data ?? []) as PrizeRow[];

  if (prizes.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase.from("prizes").insert(
    prizes.map((prize) => ({
      event_id: newEventId,
      name: prize.name,
      quantity: prize.quantity,
    }))
  );

  if (insertError) {
    throw new Error(`prizes_insert:${insertError.code ?? "query_error"}`);
  }

  return prizes.length;
}

export async function cloneEventAction(
  sourceEventId: string,
  _previousState: CloneEventFormState,
  formData: FormData
): Promise<CloneEventFormState> {
  const { admin, event: sourceEvent } = await requireEventAccess(sourceEventId);
  const { values, fieldErrors } = validateCloneForm(formData);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "입력값을 확인해 주세요.",
      fieldErrors,
      values,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: duplicatedEvent, error: duplicatedEventError } = await supabase
    .from("events")
    .select("id")
    .eq("event_code", values.event_code)
    .maybeSingle();

  if (duplicatedEventError) {
    console.error("[event-clone] Failed to check duplicate event_code.", {
      sourceEventId,
      eventCode: values.event_code,
      message: duplicatedEventError.message,
      code: duplicatedEventError.code,
    });

    return {
      message: "행사 코드 중복 확인 중 오류가 발생했습니다.",
      values,
    };
  }

  if (duplicatedEvent) {
    return {
      message: "이미 사용 중인 행사 코드입니다.",
      fieldErrors: {
        event_code: "이미 사용 중인 행사 코드입니다.",
      },
      values,
    };
  }

  const { data: newEvent, error: eventInsertError } = await supabase
    .from("events")
    .insert({
      event_code: values.event_code,
      title: values.title,
      subtitle: sourceEvent.subtitle,
      venue: sourceEvent.venue,
      starts_at: null,
      ends_at: null,
      primary_color: sourceEvent.primary_color ?? DEFAULT_PRIMARY_COLOR,
      logo_url: sourceEvent.logo_url,
      screen_notice: sourceEvent.screen_notice,
      is_active: true,
    })
    .select("id, event_code, title")
    .single();

  if (eventInsertError || !newEvent) {
    console.error("[event-clone] Failed to create cloned event.", {
      sourceEventId,
      eventCode: values.event_code,
      message: eventInsertError?.message,
      code: eventInsertError?.code,
    });

    if (eventInsertError?.code === "23505") {
      return {
        message: "이미 사용 중인 행사 코드입니다.",
        fieldErrors: {
          event_code: "이미 사용 중인 행사 코드입니다.",
        },
        values,
      };
    }

    return {
      message: "행사 복제 중 새 행사 생성에 실패했습니다.",
      values,
    };
  }

  try {
    const { error: liveStateError } = await supabase.from("live_state").upsert(
      {
        event_id: newEvent.id,
        current_session_id: null,
        current_question_id: null,
        mode: "waiting",
        question_started_at: null,
        question_ends_at: null,
        reveal_answer: false,
        show_results: false,
        screen_scene: "waiting",
        screen_payload: {},
      },
      { onConflict: "event_id" }
    );

    if (liveStateError) {
      throw new Error(`live_state:${liveStateError.code ?? "query_error"}`);
    }

    const { error: eventAdminError } = await supabase
      .from("event_admins")
      .upsert(
        {
          event_id: newEvent.id,
          admin_user_id: admin.id,
          role: "event_admin",
        },
        { onConflict: "event_id,admin_user_id" }
      );

    if (eventAdminError) {
      throw new Error(`event_admins:${eventAdminError.code ?? "query_error"}`);
    }

    const quizCounts = await cloneQuizContent({
      sourceEventId,
      newEventId: newEvent.id,
    });
    const surveyCounts = await cloneSurveyContent({
      sourceEventId,
      newEventId: newEvent.id,
    });
    const prizeCount = await clonePrizes({
      sourceEventId,
      newEventId: newEvent.id,
    });

    await writeCloneLog({
      eventId: newEvent.id,
      adminUserId: admin.id,
      sourceEvent: sourceEvent as SourceEventRow,
      counts: {
        quizSessions: quizCounts.quizSessions,
        questions: quizCounts.questions,
        surveyForms: surveyCounts.surveyForms,
        surveyQuestions: surveyCounts.surveyQuestions,
        prizes: prizeCount,
      },
    });
  } catch (error) {
    await cleanupCreatedEvent(newEvent.id);

    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: "Unknown clone error" };

    console.error("[event-clone] Failed to clone event content.", {
      sourceEventId,
      newEventId: newEvent.id,
      ...errorInfo,
    });

    return {
      message:
        "행사 복제 중 일부 설정 복사에 실패했습니다. 새 행사는 정리했으니 다시 시도해 주세요.",
      values,
    };
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${sourceEventId}`);
  redirect(
    `/admin/events/${newEvent.id}?message=${encodeURIComponent(
      "행사가 복제되었습니다. 기본 정보를 확인해주세요."
    )}`
  );
}
