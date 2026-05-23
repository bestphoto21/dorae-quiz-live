"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageSurveysByRole,
  canModerateQnaByRole,
  canOperateDrawByRole,
  canOperateLiveScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { getTimedSurveyEnd, type SurveyStatus } from "@/lib/data/surveys";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type OperationsLogAction =
  | "live_screen_set_waiting"
  | "live_screen_set_join_qr"
  | "live_screen_set_break"
  | "live_screen_set_lucky_draw"
  | "live_screen_set_survey_active"
  | "live_screen_set_survey_closed"
  | "live_screen_set_survey_status"
  | "qna_question_shown_on_screen"
  | "draw_winner_replayed"
  | "survey_form_started"
  | "survey_form_closed";

type DrawSourceType =
  | "all_participants"
  | "correct_answers"
  | "question_correct_answers"
  | "survey_respondents";

type SurveyScreenSnapshot = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  active_started_at: string | null;
  active_ends_at: string | null;
  closed_at: string | null;
};

type QnaQuestionRow = {
  id: string;
  event_id: string;
  participant_id: string | null;
  question_text: string;
  status: "pending" | "approved" | "hidden" | "deleted";
  is_pinned: boolean | null;
  created_at: string | null;
  approved_at: string | null;
};

type ParticipantDisplayRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
};

type DrawWinnerRow = {
  id: string;
  event_id: string;
  prize_id: string | null;
  participant_id: string;
  source_type: DrawSourceType;
  source_question_id: string | null;
  survey_form_id: string | null;
  status: string;
  created_at: string | null;
};

type PrizeRow = {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
};

function redirectToOperations({
  eventId,
  message,
  error,
}: {
  eventId: string;
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

  redirect(`/admin/events/${eventId}/operations${query ? `?${query}` : ""}`);
}

async function requireScreenOperation(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canOperateLiveScreenByRole(role)) {
    redirectToOperations({
      eventId,
      error: "현재 권한으로는 스크린 화면을 전환할 수 없습니다.",
    });
  }

  return { admin, event };
}

async function requireSurveyOperation(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canManageSurveysByRole(role)) {
    redirectToOperations({
      eventId,
      error: "현재 권한으로는 설문을 시작하거나 마감할 수 없습니다.",
    });
  }

  return { admin, event };
}

async function requireQnaOperation(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canModerateQnaByRole(role)) {
    redirectToOperations({
      eventId,
      error: "현재 권한으로는 Q&A 질문을 스크린에 송출할 수 없습니다.",
    });
  }

  return { admin, event };
}

async function requireDrawOperation(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canOperateDrawByRole(role)) {
    redirectToOperations({
      eventId,
      error: "현재 권한으로는 럭키드로우 화면을 송출할 수 없습니다.",
    });
  }

  return { admin, event };
}

async function writeOperationLog({
  eventId,
  adminUserId,
  action,
  detail,
}: {
  eventId: string;
  adminUserId: string;
  action: OperationsLogAction;
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
    console.error("[admin-operations] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

async function upsertLiveState(
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

function revalidateOperationPaths(eventId: string, eventCode?: string | null) {
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/operations`);
  revalidatePath(`/admin/events/${eventId}/live`);
  revalidatePath(`/admin/events/${eventId}/surveys`);
  revalidatePath(`/admin/events/${eventId}/qna`);
  revalidatePath(`/admin/events/${eventId}/draw`);

  if (eventCode) {
    revalidatePath(`/screen/${eventCode}`);
    revalidatePath(`/api/screen/${eventCode}/state`);
    revalidatePath(`/e/${eventCode}/play`);
    revalidatePath(`/e/${eventCode}/survey`);
  }
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

async function getSurveyScreenSnapshot(
  eventId: string,
  surveyFormId: string
): Promise<SurveyScreenSnapshot | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .select(
      "id, event_id, title, description, status, active_started_at, active_ends_at, closed_at"
    )
    .eq("id", surveyFormId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-operations] Failed to load survey snapshot.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });
  }

  return data as SurveyScreenSnapshot | null;
}

async function getParticipantCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-operations] Failed to count participants.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getSurveyResponseCount(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("survey_form_id", surveyFormId);

  if (error) {
    console.error("[admin-operations] Failed to count survey responses.", {
      eventId,
      surveyFormId,
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
    console.error("[admin-operations] Failed to count survey questions.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });

    return false;
  }

  return (count ?? 0) > 0;
}

async function updateSurveyStatus({
  eventId,
  surveyFormId,
  status,
  values = {},
}: {
  eventId: string;
  surveyFormId: string;
  status: SurveyStatus;
  values?: {
    active_started_at?: string | null;
    active_ends_at?: string | null;
    closed_at?: string | null;
  };
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_forms")
    .update({ status, ...values })
    .eq("id", surveyFormId)
    .eq("event_id", eventId);

  return error;
}

async function buildSurveyScreenPayload({
  eventId,
  eventCode,
  survey,
  scene,
}: {
  eventId: string;
  eventCode: string;
  survey: SurveyScreenSnapshot;
  scene: "survey_active" | "survey_status" | "survey_closed";
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
    started_at: survey.active_started_at,
    ends_at: survey.active_ends_at,
    closed_at: survey.closed_at,
    submitted_count: submittedCount,
    participant_count: participantCount,
    survey_url: buildPublicUrl(`/e/${eventCode}/survey/${survey.id}`),
    message:
      scene === "survey_active"
        ? "1분 설문을 진행 중입니다. 지금 참여해주세요."
        : scene === "survey_closed"
          ? "설문이 마감되었습니다. 참여해주셔서 감사합니다."
          : "설문 제출 현황을 확인하고 있습니다.",
  };
}

async function getLatestApprovedQna(
  eventId: string
): Promise<QnaQuestionRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qna_questions")
    .select(
      "id, event_id, participant_id, question_text, status, is_pinned, created_at, approved_at"
    )
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("is_pinned", { ascending: false })
    .order("approved_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[admin-operations] Failed to load latest approved Q&A.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as QnaQuestionRow | null;
}

async function getParticipantDisplay({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string | null;
}) {
  if (!participantId) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, display_name, organization, group_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-operations] Failed to load participant display.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as ParticipantDisplayRow | null;
}

function participantDisplayName(participant: ParticipantDisplayRow | null) {
  return participant?.display_name?.trim() || participant?.name || "익명 참가자";
}

async function getPrize(eventId: string, prizeId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("prizes")
    .select("id, event_id, name, quantity")
    .eq("id", prizeId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-operations] Failed to load prize.", {
      eventId,
      prizeId,
      message: error.message,
      code: error.code,
    });
  }

  return data as PrizeRow | null;
}

async function getLatestActiveDrawWinner(
  eventId: string
): Promise<DrawWinnerRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("draw_winners")
    .select(
      "id, event_id, prize_id, participant_id, source_type, source_question_id, survey_form_id, status, created_at"
    )
    .eq("event_id", eventId)
    .in("status", ["pending", "claimed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[admin-operations] Failed to load latest draw winner.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as DrawWinnerRow | null;
}

export async function setWaitingScreenFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireScreenOperation(eventId);
  const error = await upsertLiveState(eventId, {
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
    console.error("[admin-operations] Failed to set waiting screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToOperations({
      eventId,
      error: "대기 화면 송출 중 오류가 발생했습니다.",
    });
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

  revalidateOperationPaths(eventId, event.event_code);
  redirectToOperations({ eventId, message: "대기 화면을 송출했습니다." });
}

export async function setBreakScreenFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireScreenOperation(eventId);
  const error = await upsertLiveState(eventId, {
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
    console.error("[admin-operations] Failed to set break screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToOperations({
      eventId,
      error: "휴식 화면 송출 중 오류가 발생했습니다.",
    });
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

  revalidateOperationPaths(eventId, event.event_code);
  redirectToOperations({ eventId, message: "휴식 화면을 송출했습니다." });
}

export async function setJoinQrScreenFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireScreenOperation(eventId);
  const eventCode = event.event_code?.trim();

  if (!eventCode) {
    redirectToOperations({
      eventId,
      error: "행사 코드가 없어 QR 입장 안내 화면을 송출할 수 없습니다.",
    });
  }

  const error = await upsertLiveState(eventId, {
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
      message: "휴대폰 카메라로 QR을 스캔해 참여해주세요.",
    },
  });

  if (error) {
    console.error("[admin-operations] Failed to set join QR screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToOperations({
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

  revalidateOperationPaths(eventId, eventCode);
  redirectToOperations({ eventId, message: "QR 입장 안내 화면을 송출했습니다." });
}

export async function setLuckyDrawReadyScreenFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const error = await upsertLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "draw",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "draw",
    screen_payload: {},
  });

  if (error) {
    console.error("[admin-operations] Failed to set draw ready screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToOperations({
      eventId,
      error: "럭키드로우 준비 화면 송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_lucky_draw",
    detail: screenLogDetail({
      eventId,
      mode: "draw",
      screenScene: "draw",
    }),
  });

  revalidateOperationPaths(eventId, event.event_code);
  redirectToOperations({
    eventId,
    message: "럭키드로우 준비 화면을 송출했습니다.",
  });
}

export async function startSurveyFromOperations(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyOperation(eventId);
  const form = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (!form) {
    redirectToOperations({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (form.status === "archived") {
    redirectToOperations({
      eventId,
      error: "보관된 설문은 시작할 수 없습니다.",
    });
  }

  if (!(await ensureCanOpenSurvey(eventId, surveyFormId))) {
    redirectToOperations({
      eventId,
      error: "질문이 1개 이상 있어야 설문을 시작할 수 있습니다.",
    });
  }

  const startedAt = new Date();
  const endsAt = getTimedSurveyEnd(startedAt);
  const statusError = await updateSurveyStatus({
    eventId,
    surveyFormId,
    status: "open",
    values: {
      active_started_at: startedAt.toISOString(),
      active_ends_at: endsAt.toISOString(),
      closed_at: null,
    },
  });

  if (statusError) {
    console.error("[admin-operations] Failed to start survey.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: statusError.message,
      code: statusError.code,
    });

    redirectToOperations({
      eventId,
      error: "설문 시작 중 오류가 발생했습니다.",
    });
  }

  const eventCode = event.event_code?.trim();
  const screenSurvey = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (eventCode && screenSurvey) {
    const screenError = await upsertLiveState(eventId, {
      current_session_id: null,
      current_question_id: null,
      mode: "survey",
      question_started_at: null,
      question_ends_at: null,
      reveal_answer: false,
      show_results: false,
      screen_scene: "survey_active",
      screen_payload: await buildSurveyScreenPayload({
        eventId,
        eventCode,
        survey: screenSurvey,
        scene: "survey_active",
      }),
    });

    if (screenError) {
      console.error("[admin-operations] Failed to set active survey screen.", {
        eventId,
        surveyFormId,
        adminUserId: admin.id,
        message: screenError.message,
        code: screenError.code,
      });
    } else {
      await writeOperationLog({
        eventId,
        adminUserId: admin.id,
        action: "live_screen_set_survey_active",
        detail: {
          ...screenLogDetail({
            eventId,
            mode: "survey",
            screenScene: "survey_active",
          }),
          survey_form_id: surveyFormId,
        },
      });
    }
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_started",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      status: "open",
      active_started_at: startedAt.toISOString(),
      active_ends_at: endsAt.toISOString(),
    },
  });

  revalidateOperationPaths(eventId, eventCode);
  redirectToOperations({
    eventId,
    message: "1분 설문을 시작하고 스크린에 진행 화면을 송출했습니다.",
  });
}

export async function closeSurveyFromOperations(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyOperation(eventId);
  const form = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (!form) {
    redirectToOperations({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (form.status === "archived") {
    redirectToOperations({
      eventId,
      error: "보관된 설문은 마감할 수 없습니다.",
    });
  }

  const closedAt = new Date().toISOString();
  const statusError = await updateSurveyStatus({
    eventId,
    surveyFormId,
    status: "closed",
    values: {
      closed_at: closedAt,
    },
  });

  if (statusError) {
    console.error("[admin-operations] Failed to close survey.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: statusError.message,
      code: statusError.code,
    });

    redirectToOperations({
      eventId,
      error: "설문 마감 중 오류가 발생했습니다.",
    });
  }

  const eventCode = event.event_code?.trim();
  const screenSurvey = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (eventCode && screenSurvey) {
    const screenError = await upsertLiveState(eventId, {
      current_session_id: null,
      current_question_id: null,
      mode: "survey",
      question_started_at: null,
      question_ends_at: null,
      reveal_answer: false,
      show_results: false,
      screen_scene: "survey_closed",
      screen_payload: await buildSurveyScreenPayload({
        eventId,
        eventCode,
        survey: screenSurvey,
        scene: "survey_closed",
      }),
    });

    if (screenError) {
      console.error("[admin-operations] Failed to set closed survey screen.", {
        eventId,
        surveyFormId,
        adminUserId: admin.id,
        message: screenError.message,
        code: screenError.code,
      });
    } else {
      await writeOperationLog({
        eventId,
        adminUserId: admin.id,
        action: "live_screen_set_survey_closed",
        detail: {
          ...screenLogDetail({
            eventId,
            mode: "survey",
            screenScene: "survey_closed",
          }),
          survey_form_id: surveyFormId,
        },
      });
    }
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "survey_form_closed",
    detail: {
      event_id: eventId,
      survey_form_id: surveyFormId,
      status: "closed",
      closed_at: closedAt,
    },
  });

  revalidateOperationPaths(eventId, eventCode);
  redirectToOperations({ eventId, message: "설문을 마감했습니다." });
}

export async function setSurveyStatusScreenFromOperations(
  eventId: string,
  surveyFormId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireSurveyOperation(eventId);
  const eventCode = event.event_code?.trim();
  const survey = await getSurveyScreenSnapshot(eventId, surveyFormId);

  if (!survey) {
    redirectToOperations({ eventId, error: "설문을 찾을 수 없습니다." });
  }

  if (!eventCode) {
    redirectToOperations({
      eventId,
      error: "행사 코드가 없어 설문 제출 현황을 송출할 수 없습니다.",
    });
  }

  if (survey.status === "draft" || survey.status === "archived") {
    redirectToOperations({
      eventId,
      error: "설문 시작 후 제출 현황을 송출해주세요.",
    });
  }

  const screenError = await upsertLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "survey",
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

  if (screenError) {
    console.error("[admin-operations] Failed to set survey status screen.", {
      eventId,
      surveyFormId,
      adminUserId: admin.id,
      message: screenError.message,
      code: screenError.code,
    });

    redirectToOperations({
      eventId,
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
        mode: "survey",
        screenScene: "survey_status",
      }),
      survey_form_id: surveyFormId,
    },
  });

  revalidateOperationPaths(eventId, eventCode);
  redirectToOperations({
    eventId,
    message: "설문 제출 현황 화면을 송출했습니다.",
  });
}

export async function showLatestApprovedQnaFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireQnaOperation(eventId);
  const question = await getLatestApprovedQna(eventId);

  if (!question) {
    redirectToOperations({
      eventId,
      error: "송출할 승인된 Q&A 질문이 없습니다.",
    });
  }

  const participant = await getParticipantDisplay({
    eventId,
    participantId: question.participant_id,
  });
  const screenError = await upsertLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "qna",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "qna_question",
    screen_payload: {
      qna_question_id: question.id,
      question_text: question.question_text,
      participant_display_name: participantDisplayName(participant),
      organization: participant?.organization ?? null,
      group_name: participant?.group_name ?? null,
      created_at: question.created_at,
    },
  });

  if (screenError) {
    console.error("[admin-operations] Failed to show latest Q&A question.", {
      eventId,
      qnaQuestionId: question.id,
      adminUserId: admin.id,
      message: screenError.message,
      code: screenError.code,
    });

    redirectToOperations({
      eventId,
      error: "Q&A 질문 송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "qna_question_shown_on_screen",
    detail: {
      event_id: eventId,
      qna_question_id: question.id,
      status: question.status,
    },
  });

  revalidateOperationPaths(eventId, event.event_code);
  redirectToOperations({
    eventId,
    message: "최근 승인 Q&A 질문을 스크린에 송출했습니다.",
  });
}

export async function replayLatestWinnerFromOperations(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const winner = await getLatestActiveDrawWinner(eventId);

  if (!winner) {
    redirectToOperations({
      eventId,
      error: "다시 송출할 최근 당첨 결과가 없습니다.",
    });
  }

  const participant = await getParticipantDisplay({
    eventId,
    participantId: winner.participant_id,
  });

  if (!participant) {
    redirectToOperations({
      eventId,
      error: "당첨자 표시 이름을 확인할 수 없어 다시 송출할 수 없습니다.",
    });
  }

  const prize = winner.prize_id ? await getPrize(eventId, winner.prize_id) : null;
  const participantName = participantDisplayName(participant);
  const prizeName = prize?.name ?? "경품 없음";
  const screenError = await upsertLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "draw",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "draw_winner",
    screen_payload: {
      winner_id: winner.id,
      animation_id: `${winner.id}-${Date.now()}`,
      participant_display_name: participantName,
      winner_name: participantName,
      prize_name: prizeName,
      prize_title: prizeName,
      source_type: winner.source_type,
      draw_phase: "result",
      candidate_names: [participantName],
      message: "최근 당첨 결과를 다시 송출합니다.",
      duration_ms: 7000,
      countdown_seconds: 3,
      created_at: winner.created_at,
    },
  });

  if (screenError) {
    console.error("[admin-operations] Failed to replay latest draw winner.", {
      eventId,
      winnerId: winner.id,
      adminUserId: admin.id,
      message: screenError.message,
      code: screenError.code,
    });

    redirectToOperations({
      eventId,
      error: "최근 당첨 결과 재송출 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "draw_winner_replayed",
    detail: {
      event_id: eventId,
      winner_id: winner.id,
      prize_id: winner.prize_id,
      source_type: winner.source_type,
      survey_form_id: winner.survey_form_id,
      screen_scene: "draw_winner",
      draw_phase: "result",
      changed_at: new Date().toISOString(),
    },
  });

  revalidateOperationPaths(eventId, event.event_code);
  redirectToOperations({
    eventId,
    message: "최근 당첨 결과를 다시 송출했습니다.",
  });
}
