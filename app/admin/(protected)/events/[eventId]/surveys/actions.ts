"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageSurveysByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
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
  | "survey_form_started"
  | "survey_form_closed"
  | "survey_form_reopened_draft"
  | "survey_question_created"
  | "survey_question_updated"
  | "survey_question_deleted"
  | "survey_question_reordered"
  | "live_screen_set_waiting"
  | "live_screen_set_join_qr"
  | "live_screen_set_break"
  | "live_screen_set_survey_intro"
  | "live_screen_set_survey_status";

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

async function getSurveyScreenSnapshot(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .select("id, event_id, title, description, status")
    .eq("id", surveyFormId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-surveys] Failed to load survey screen snapshot.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });
  }

  return data as
    | {
        id: string;
        event_id: string;
        title: string;
        description: string | null;
        status: SurveyStatus;
      }
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

async function getParticipantCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-surveys] Failed to count participants for screen.", {
      eventId,
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

function revalidateSurveyPaths(eventId: string, eventCode?: string | null) {
  revalidatePath(`/admin/events/${eventId}/surveys`);

  if (eventCode) {
    revalidatePath(`/screen/${eventCode}`);
    revalidatePath(`/api/screen/${eventCode}/state`);
  }
}

async function updateSurveyStatus({
  eventId,
  surveyFormId,
  status,
  adminUserId,
}: {
  eventId: string;
  surveyFormId: string;
  status: SurveyStatus;
  adminUserId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_forms")
    .update({ status })
    .eq("id", surveyFormId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-surveys] Failed to update survey status.", {
      eventId,
      surveyFormId,
      adminUserId,
      status,
      message: error.message,
      code: error.code,
    });
  }

  return error;
}

async function upsertSurveyLiveState(
  eventId: string,
  values: Record<string, unknown>
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("live_state").upsert(
    {
      event_id: eventId,
      ...values,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" }
  );

  return error;
}

function screenLogDetail({
  eventId,
  mode,
  screenScene,
}: {
  eventId: string;
  mode: string;
  screenScene: string;
}) {
  return {
    event_id: eventId,
    mode,
    screen_scene: screenScene,
    changed_at: new Date().toISOString(),
  };
}

async function buildSurveyScreenPayload({
  eventId,
  eventCode,
  survey,
  scene,
}: {
  eventId: string;
  eventCode: string;
  survey: {
    id: string;
    title: string;
    description: string | null;
    status: SurveyStatus;
  };
  scene: "survey_intro" | "survey_status";
}) {
  const [submittedCount, participantCount] = await Promise.all([
    getSurveyResponseCount(eventId, survey.id),
    getParticipantCount(eventId),
  ]);

  return {
    survey_form_id: survey.id,
    event_code: eventCode,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    submitted_count: submittedCount,
    participant_count: participantCount,
    survey_url: buildPublicUrl(`/e/${eventCode}/survey/${survey.id}`),
    message:
      scene === "survey_status"
        ? "설문 제출 현황을 확인하고 있습니다."
        : "모바일로 QR 입장 후 설문에 참여해주세요.",
  };
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

export async function startSurveyForm(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (form.status === "archived") {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "보관된 설문은 시작할 수 없습니다.",
    });
  }

  if (!(await ensureCanOpenSurvey(eventId, surveyFormId))) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "질문을 1개 이상 추가한 뒤 설문을 시작해주세요.",
    });
  }

  const error = await updateSurveyStatus({
    eventId,
    surveyFormId,
    status: "open",
    adminUserId: admin.id,
  });

  if (error) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 시작 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_started",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      status: "open",
    },
  });

  revalidateSurveyPaths(eventId);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문을 시작했습니다. 참가자가 이 설문을 제출할 수 있습니다.",
  });
}

export async function closeSurveyForm(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (form.status === "archived") {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "보관된 설문은 마감 상태로 변경할 수 없습니다.",
    });
  }

  const error = await updateSurveyStatus({
    eventId,
    surveyFormId,
    status: "closed",
    adminUserId: admin.id,
  });

  if (error) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 마감 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_closed",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      status: "closed",
    },
  });

  revalidateSurveyPaths(eventId);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문을 마감했습니다. 참가자 제출을 중지합니다.",
  });
}

export async function reopenSurveyFormAsDraft(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin } = await requireSurveyManagement(eventId);
  const form = await getSurveyForm(eventId, surveyFormId);

  if (!form) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (form.status === "archived") {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "보관된 설문은 작성 중으로 되돌릴 수 없습니다.",
    });
  }

  const error = await updateSurveyStatus({
    eventId,
    surveyFormId,
    status: "draft",
    adminUserId: admin.id,
  });

  if (error) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 상태 변경 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_reopened_draft",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      status: "draft",
    },
  });

  revalidateSurveyPaths(eventId);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문을 작성 중 상태로 되돌렸습니다.",
  });
}

export async function setWaitingScreenFromSurveys(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyManagement(eventId);
  const error = await upsertSurveyLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "waiting",
    screen_payload: {},
  });

  if (error) {
    console.error("[admin-surveys] Failed to set waiting screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({ eventId, error: "대기 화면 송출 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_waiting",
    detail: screenLogDetail({
      eventId,
      mode: "waiting",
      screenScene: "waiting",
    }),
  });

  revalidateSurveyPaths(eventId, event.event_code);
  redirectToSurveys({ eventId, message: "대기 화면을 송출했습니다." });
}

export async function setBreakScreenFromSurveys(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyManagement(eventId);
  const error = await upsertSurveyLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "break",
    screen_payload: {
      title: "잠시 쉬는 시간입니다",
      message: "곧 다시 시작합니다.",
    },
  });

  if (error) {
    console.error("[admin-surveys] Failed to set break screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({ eventId, error: "휴식 화면 송출 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_break",
    detail: screenLogDetail({
      eventId,
      mode: "waiting",
      screenScene: "break",
    }),
  });

  revalidateSurveyPaths(eventId, event.event_code);
  redirectToSurveys({ eventId, message: "휴식 화면을 송출했습니다." });
}

export async function setJoinQrScreenFromSurveys(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyManagement(eventId);
  const eventCode = event.event_code?.trim();

  if (!eventCode) {
    redirectToSurveys({
      eventId,
      error: "행사 코드가 없어 QR 입장 안내 화면을 송출할 수 없습니다.",
    });
  }

  const error = await upsertSurveyLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "join_qr",
    screen_payload: {
      event_code: eventCode,
      join_url: buildPublicUrl(`/e/${eventCode}/join`),
      title: event.title,
      message: "휴대폰 카메라로 QR을 스캔해 참여해 주세요",
    },
  });

  if (error) {
    console.error("[admin-surveys] Failed to set join QR screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      error: "QR 입장 안내 화면 송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_join_qr",
    detail: screenLogDetail({
      eventId,
      mode: "waiting",
      screenScene: "join_qr",
    }),
  });

  revalidateSurveyPaths(eventId, eventCode);
  redirectToSurveys({ eventId, message: "QR 입장 안내 화면을 송출했습니다." });
}

export async function setSurveyIntroScreenFromSurveys(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyManagement(eventId);
  const eventCode = event.event_code?.trim();
  const survey = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (!survey) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (!eventCode) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "행사 코드가 없어 설문 안내 화면을 송출할 수 없습니다.",
    });
  }

  if (survey.status !== "open") {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 시작 후 송출해주세요.",
    });
  }

  const error = await upsertSurveyLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "survey_intro",
    screen_payload: await buildSurveyScreenPayload({
      eventId,
      eventCode,
      survey,
      scene: "survey_intro",
    }),
  });

  if (error) {
    console.error("[admin-surveys] Failed to set survey intro screen.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 참여 안내 송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_survey_intro",
    detail: {
      ...screenLogDetail({
        eventId,
        mode: "waiting",
        screenScene: "survey_intro",
      }),
      survey_form_id: surveyFormId,
    },
  });

  revalidateSurveyPaths(eventId, eventCode);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문 참여 안내 화면을 송출했습니다.",
  });
}

export async function setSurveyStatusScreenFromSurveys(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyManagement(eventId);
  const eventCode = event.event_code?.trim();
  const survey = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (!survey) {
    redirectToSurveys({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (!eventCode) {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "행사 코드가 없어 제출 현황 화면을 송출할 수 없습니다.",
    });
  }

  if (survey.status === "draft" || survey.status === "archived") {
    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 시작 후 제출 현황을 송출해주세요.",
    });
  }

  const error = await upsertSurveyLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "survey_status",
    screen_payload: await buildSurveyScreenPayload({
      eventId,
      eventCode,
      survey,
      scene: "survey_status",
    }),
  });

  if (error) {
    console.error("[admin-surveys] Failed to set survey status screen.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToSurveys({
      eventId,
      surveyId: surveyFormId,
      error: "설문 제출 현황 송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_survey_status",
    detail: {
      ...screenLogDetail({
        eventId,
        mode: "waiting",
        screenScene: "survey_status",
      }),
      survey_form_id: surveyFormId,
    },
  });

  revalidateSurveyPaths(eventId, eventCode);
  redirectToSurveys({
    eventId,
    surveyId: surveyFormId,
    message: "설문 제출 현황 화면을 송출했습니다.",
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
