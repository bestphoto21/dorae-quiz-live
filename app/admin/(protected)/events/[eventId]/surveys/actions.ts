"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageSurveysByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SurveyQuestionType, SurveyStatus } from "@/lib/data/surveys";

const SURVEY_STATUSES: SurveyStatus[] = [
  "draft",
  "open",
  "closed",
  "archived",
];

const QUESTION_TYPES: SurveyQuestionType[] = [
  "short_text",
  "long_text",
  "single_choice",
  "multiple_choice",
  "rating",
];

type SurveyLogAction =
  | "survey_starter_forms_created"
  | "survey_form_created"
  | "survey_form_updated"
  | "survey_form_archived"
  | "survey_form_deleted"
  | "survey_question_created"
  | "survey_question_updated"
  | "survey_question_deleted"
  | "survey_question_reordered";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function redirectToSurveys({
  eventId,
  surveyId,
  message,
  error,
}: {
  eventId: string;
  surveyId?: string | null;
  message?: string;
  error?: string;
}): never {
  const params = new URLSearchParams();

  if (surveyId) {
    params.set("surveyId", surveyId);
  }

  if (message) {
    params.set("message", message);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();

  redirect(`/admin/events/${eventId}/surveys${query ? `?${query}` : ""}`);
}

async function requireSurveyManagement(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canManageSurveysByRole(role)) {
    redirectToSurveys({
      eventId,
      error: "현재 권한으로는 설문을 변경할 수 없습니다.",
    });
  }

  return { admin, event, role };
}

async function writeOperationLog({
  eventId,
  adminUserId,
  action,
  detail,
}: {
  eventId: string;
  adminUserId: string;
  action: SurveyLogAction;
  detail: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: adminUserId,
    action,
    detail,
  });

  if (error) {
    console.error("[admin-surveys] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

function parseStatus(value: string): SurveyStatus | null {
  return SURVEY_STATUSES.includes(value as SurveyStatus)
    ? (value as SurveyStatus)
    : null;
}

function parseQuestionType(value: string): SurveyQuestionType | null {
  return QUESTION_TYPES.includes(value as SurveyQuestionType)
    ? (value as SurveyQuestionType)
    : null;
}

function parseOptions(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

function validateSurveyForm(formData: FormData) {
  const title = getFormString(formData, "title");
  const description = getFormString(formData, "description");
  const status = parseStatus(getFormString(formData, "status") || "draft");
  const sortOrder = Number(getFormString(formData, "sort_order") || "0");

  if (!title) {
    return { error: "설문 제목을 입력해 주세요." };
  }

  if (!status) {
    return { error: "설문 상태를 다시 선택해 주세요." };
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { error: "정렬 순서는 0 이상의 숫자로 입력해 주세요." };
  }

  return {
    values: {
      title,
      description: nullable(description),
      status,
      sort_order: sortOrder,
    },
  };
}

function validateQuestionForm(formData: FormData) {
  const questionText = getFormString(formData, "question_text");
  const questionType = parseQuestionType(
    getFormString(formData, "question_type") || "short_text"
  );
  const options = parseOptions(getFormString(formData, "options"));
  const sortOrder = Number(getFormString(formData, "sort_order") || "0");
  const isRequired = formData.get("is_required") === "on";

  if (!questionText) {
    return { error: "질문 내용을 입력해 주세요." };
  }

  if (!questionType) {
    return { error: "질문 타입을 다시 선택해 주세요." };
  }

  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return { error: "정렬 순서는 0 이상의 숫자로 입력해 주세요." };
  }

  if (
    (questionType === "single_choice" || questionType === "multiple_choice") &&
    options.length < 2
  ) {
    return { error: "객관식 질문은 선택지를 2개 이상 입력해 주세요." };
  }

  return {
    values: {
      question_text: questionText,
      question_type: questionType,
      options:
        questionType === "single_choice" || questionType === "multiple_choice"
          ? options
          : [],
      is_required: isRequired,
      sort_order: sortOrder,
    },
  };
}

async function getSurveyForm(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .select("id, event_id, title, status")
    .eq("id", surveyFormId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-surveys] Failed to load survey form.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });
  }

  return data as
    | { id: string; event_id: string; title: string; status: SurveyStatus }
    | null;
}

async function getSurveyQuestion(
  surveyFormId: string,
  surveyQuestionId: string
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_questions")
    .select("id, survey_form_id, question_text, sort_order")
    .eq("id", surveyQuestionId)
    .eq("survey_form_id", surveyFormId)
    .maybeSingle();

  if (error) {
    console.error("[admin-surveys] Failed to load survey question.", {
      surveyFormId,
      surveyQuestionId,
      message: error.message,
      code: error.code,
    });
  }

  return data as
    | {
        id: string;
        survey_form_id: string;
        question_text: string;
        sort_order: number;
      }
    | null;
}

async function getSurveyResponseCount(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("survey_form_id", surveyFormId);

  if (error) {
    console.error("[admin-surveys] Failed to count survey responses.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getQuestionAnswerCount(surveyQuestionId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("survey_answers")
    .select("id", { count: "exact", head: true })
    .eq("survey_question_id", surveyQuestionId);

  if (error) {
    console.error("[admin-surveys] Failed to count question answers.", {
      surveyQuestionId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function ensureCanOpenSurvey(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("survey_questions")
    .select("id", { count: "exact", head: true })
    .eq("survey_form_id", surveyFormId);

  if (error) {
    console.error("[admin-surveys] Failed to count questions before open.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });

    return false;
  }

  return (count ?? 0) > 0;
}

async function normalizeQuestionOrder(surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_questions")
    .select("id")
    .eq("survey_form_id", surveyFormId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin-surveys] Failed to load survey questions for reorder.", {
      surveyFormId,
      message: error.message,
      code: error.code,
    });

    return false;
  }

  const results = await Promise.all(
    (data ?? []).map((question, index) =>
      supabase
        .from("survey_questions")
        .update({ sort_order: index + 1 })
        .eq("id", question.id)
    )
  );
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error("[admin-surveys] Failed to normalize survey question order.", {
      surveyFormId,
      message: failed.error.message,
      code: failed.error.code,
    });

    return false;
  }

  return true;
}

export async function createStarterSurveys(eventId: string, formData: FormData) {
  void formData;

  const { admin } = await requireSurveyManagement(eventId);
  const supabase = createAdminSupabaseClient();
  const { count, error: countError } = await supabase
    .from("survey_forms")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (countError) {
    console.error("[admin-surveys] Failed to count survey forms.", {
      eventId,
      adminUserId: admin.id,
      message: countError.message,
      code: countError.code,
    });

    redirectToSurveys({
      eventId,
      error: "기본 설문 생성 전 현재 설문 수를 확인하지 못했습니다.",
    });
  }

  if ((count ?? 0) > 0) {
    redirectToSurveys({
      eventId,
      error: "이미 설문이 있어 기본 설문 4개를 자동 생성하지 않았습니다.",
    });
  }

  const { data, error } = await supabase
    .from("survey_forms")
    .insert(
      [1, 2, 3, 4].map((number) => ({
        event_id: eventId,
        title: `설문 ${number}`,
        status: "draft",
        sort_order: number,
      }))
    )
    .select("id, title");

  if (error || !data) {
    console.error("[admin-surveys] Failed to create starter surveys.", {
      eventId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToSurveys({
      eventId,
      error: "기본 설문 생성 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_starter_forms_created",
    detail: {
      event_id: eventId,
      survey_count: data.length,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: data[0]?.id,
    message: "기본 설문 4개를 만들었습니다.",
  });
}

export async function createSurveyForm(eventId: string, formData: FormData) {
  const { admin } = await requireSurveyManagement(eventId);
  const validated = validateSurveyForm(formData);

  if ("error" in validated) {
    redirectToSurveys({ eventId, error: validated.error });
  }

  if (validated.values.status === "open") {
    redirectToSurveys({
      eventId,
      error: "새 설문은 질문을 추가한 뒤 응답 가능 상태로 전환해 주세요.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .insert({
      event_id: eventId,
      ...validated.values,
    })
    .select("id, title, status")
    .single();

  if (error || !data) {
    console.error("[admin-surveys] Failed to create survey form.", {
      eventId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToSurveys({
      eventId,
      error: "설문 생성 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_created",
    detail: {
      event_id: eventId,
      survey_form_id: data.id,
      title: data.title,
      status: data.status,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: data.id,
    message: "설문을 추가했습니다.",
  });
}

export async function updateSurveyForm(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const validated = validateSurveyForm(formData);

  if ("error" in validated) {
    redirectToSurveys({ eventId, surveyId: surveyFormId, error: validated.error });
  }

  if (
    validated.values.status === "open" &&
    !(await ensureCanOpenSurvey(eventId, surveyFormId))
  ) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문을 1개 이상 추가해야 설문을 응답 가능 상태로 열 수 있습니다.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_forms")
    .update(validated.values)
    .eq("id", surveyFormId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-surveys] Failed to update survey form.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_updated",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      title: validated.values.title,
      status: validated.values.status,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문 설정을 저장했습니다.",
  });
}

export async function deleteOrArchiveSurveyForm(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  const { admin } = await requireSurveyManagement(eventId);
  const confirmed = formData.get("confirm_delete") === "yes";

  if (!confirmed) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 삭제 또는 보관 확인을 체크해 주세요.",
    });
  }

  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const responseCount = await getSurveyResponseCount(eventId, surveyFormId);
  const supabase = createAdminSupabaseClient();

  if (responseCount > 0) {
    const { error } = await supabase
      .from("survey_forms")
      .update({ status: "archived" })
      .eq("id", surveyFormId)
      .eq("event_id", eventId);

    if (error) {
      console.error("[admin-surveys] Failed to archive survey form.", {
        eventId,
        surveyFormId,
        adminUserId: admin.id,
        message: error.message,
        code: error.code,
      });

      redirectToSurveys({
        eventId,
        surveyId: surveyFormId,
        error: "응답이 있는 설문을 보관 처리하는 중 오류가 발생했습니다.",
      });
    }

    await writeOperationLog({
      eventId,
      adminUserId: admin.id,
      action: "survey_form_archived",
      detail: {
        event_id: eventId,
        survey_form_id: surveyFormId,
        response_count: responseCount,
      },
    });

    revalidatePath(`/admin/events/${eventId}/surveys`);
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      message: "응답이 있어 설문을 삭제하지 않고 보관 상태로 전환했습니다.",
    });
  }

  const { error } = await supabase
    .from("survey_forms")
    .delete()
    .eq("id", surveyFormId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-surveys] Failed to delete survey form.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 삭제 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_deleted",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      title: form.title,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({ eventId, message: "설문을 삭제했습니다." });
}

export async function createSurveyQuestion(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const validated = validateQuestionForm(formData);

  if ("error" in validated) {
    redirectToSurveys({ eventId, surveyId: surveyFormId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { data: lastQuestion, error: orderError } = await supabase
    .from("survey_questions")
    .select("sort_order")
    .eq("survey_form_id", surveyFormId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("[admin-surveys] Failed to read last question order.", {
      eventId,
      surveyFormId,
      message: orderError.message,
      code: orderError.code,
    });
  }

  const nextSortOrder =
    typeof lastQuestion?.sort_order === "number"
      ? lastQuestion.sort_order + 1
      : 1;

  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_form_id: surveyFormId,
      ...validated.values,
      sort_order: validated.values.sort_order || nextSortOrder,
    })
    .select("id, question_text")
    .single();

  if (error || !data) {
    console.error("[admin-surveys] Failed to create survey question.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 추가 중 오류가 발생했습니다.",
    });
  }

  await normalizeQuestionOrder(surveyFormId);
  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_question_created",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      survey_question_id: data.id,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "질문을 추가했습니다.",
  });
}

export async function updateSurveyQuestion(
  eventId: string,
  surveyFormId: string,
  surveyQuestionId: string,
  formData: FormData
) {
  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const question = await getSurveyQuestion(surveyFormId, surveyQuestionId);

  if (!question) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문을 찾을 수 없습니다.",
    });
  }

  const validated = validateQuestionForm(formData);

  if ("error" in validated) {
    redirectToSurveys({ eventId, surveyId: surveyFormId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_questions")
    .update(validated.values)
    .eq("id", surveyQuestionId)
    .eq("survey_form_id", surveyFormId);

  if (error) {
    console.error("[admin-surveys] Failed to update survey question.", {
      eventId,
      surveyFormId,
      surveyQuestionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 저장 중 오류가 발생했습니다.",
    });
  }

  await normalizeQuestionOrder(surveyFormId);
  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_question_updated",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      survey_question_id: surveyQuestionId,
      question_type: validated.values.question_type,
      is_required: validated.values.is_required,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "질문을 저장했습니다.",
  });
}

export async function deleteSurveyQuestion(
  eventId: string,
  surveyFormId: string,
  surveyQuestionId: string,
  formData: FormData
) {
  const { admin } = await requireSurveyManagement(eventId);
  const confirmed = formData.get("confirm_delete") === "yes";

  if (!confirmed) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 삭제 확인을 체크해 주세요.",
    });
  }

  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const question = await getSurveyQuestion(surveyFormId, surveyQuestionId);

  if (!question) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문을 찾을 수 없습니다.",
    });
  }

  const answerCount = await getQuestionAnswerCount(surveyQuestionId);

  if (answerCount > 0) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "이미 응답이 있는 질문은 삭제할 수 없습니다.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_questions")
    .delete()
    .eq("id", surveyQuestionId)
    .eq("survey_form_id", surveyFormId);

  if (error) {
    console.error("[admin-surveys] Failed to delete survey question.", {
      eventId,
      surveyFormId,
      surveyQuestionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 삭제 중 오류가 발생했습니다.",
    });
  }

  await normalizeQuestionOrder(surveyFormId);
  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_question_deleted",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      survey_question_id: surveyQuestionId,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "질문을 삭제했습니다.",
  });
}

export async function moveSurveyQuestion(
  eventId: string,
  surveyFormId: string,
  surveyQuestionId: string,
  direction: "up" | "down",
  formData: FormData
) {
  void formData;

  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_questions")
    .select("id, sort_order")
    .eq("survey_form_id", surveyFormId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin-surveys] Failed to load questions for move.", {
      eventId,
      surveyFormId,
      surveyQuestionId,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 순서 변경 중 오류가 발생했습니다.",
    });
  }

  const ordered = data ?? [];
  const currentIndex = ordered.findIndex(
    (question) => question.id === surveyQuestionId
  );
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= ordered.length
  ) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      message: "변경할 수 있는 질문 순서가 없습니다.",
    });
  }

  const reordered = [...ordered];
  const [currentQuestion] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, currentQuestion);

  const results = await Promise.all(
    reordered.map((question, index) =>
      supabase
        .from("survey_questions")
        .update({ sort_order: index + 1 })
        .eq("id", question.id)
    )
  );
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error("[admin-surveys] Failed to move question order.", {
      eventId,
      surveyFormId,
      surveyQuestionId,
      message: failed.error.message,
      code: failed.error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문 순서 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_question_reordered",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      survey_question_id: surveyQuestionId,
      direction,
      from_index: currentIndex + 1,
      to_index: targetIndex + 1,
    },
  });

  revalidatePath(`/admin/events/${eventId}/surveys`);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "질문 순서를 변경했습니다.",
  });
}
