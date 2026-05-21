"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canOperateDrawByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type DrawSourceType =
  | "all_participants"
  | "correct_answers"
  | "question_correct_answers"
  | "survey_respondents";

type DrawLogAction =
  | "prize_created"
  | "prize_updated"
  | "prize_deleted"
  | "draw_winner_selected"
  | "draw_winner_claimed"
  | "draw_winner_cancelled"
  | "draw_winner_redrawn"
  | "draw_winner_replayed"
  | "live_screen_set_waiting"
  | "live_screen_set_join_qr"
  | "live_screen_set_break"
  | "live_screen_set_lucky_draw";

type PrizeRow = {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
};

type CandidateParticipant = {
  id: string;
  name: string;
  display_name: string | null;
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

const SOURCE_TYPES = new Set([
  "all_participants",
  "correct_answers",
  "question_correct_answers",
  "survey_respondents",
]);

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key);

  return value.length > 0 ? value : null;
}

function getFormQuantity(formData: FormData) {
  const quantity = Number.parseInt(getFormString(formData, "quantity"), 10);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return null;
  }

  return quantity;
}

function getSourceType(value: string): DrawSourceType | null {
  return SOURCE_TYPES.has(value) ? (value as DrawSourceType) : null;
}

function redirectToDraw({
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

  redirect(`/admin/events/${eventId}/draw${query ? `?${query}` : ""}`);
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" ||
    error?.message?.toLowerCase().includes("duplicate key")
  );
}

function displayName(participant: CandidateParticipant) {
  return participant.display_name?.trim() || participant.name;
}

function candidateNamesForScreen(
  participants: CandidateParticipant[],
  selectedParticipant: CandidateParticipant
) {
  const selectedName = displayName(selectedParticipant);
  const names = participants
    .map(displayName)
    .filter((name) => name.length > 0 && name.length <= 40);
  const uniqueNames = Array.from(new Set(names)).slice(0, 30);

  if (!uniqueNames.includes(selectedName)) {
    uniqueNames.push(selectedName);
  }

  return uniqueNames.length > 0 ? uniqueNames : [selectedName];
}

async function requireDrawOperation(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canOperateDrawByRole(role)) {
    redirectToDraw({
      eventId,
      error: "현재 권한으로는 추첨을 실행하거나 변경할 수 없습니다.",
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
  action: DrawLogAction;
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
    console.error("[admin-draw] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

function revalidateDrawPaths(eventId: string, eventCode: string) {
  revalidatePath(`/admin/events/${eventId}/draw`);
  revalidatePath(`/screen/${eventCode}`);
  revalidatePath(`/api/screen/${eventCode}/state`);
}

async function upsertDrawLiveState(
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

export async function setWaitingScreenFromDraw(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const error = await upsertDrawLiveState(eventId, {
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
    console.error("[admin-draw] Failed to set waiting screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "대기 화면 송출 중 오류가 발생했습니다." });
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

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "대기 화면을 송출했습니다." });
}

export async function setJoinQrScreenFromDraw(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const eventCode = event.event_code?.trim();

  if (!eventCode) {
    redirectToDraw({
      eventId,
      error: "행사 코드가 없어 QR 참여 안내 화면을 송출할 수 없습니다.",
    });
  }

  const error = await upsertDrawLiveState(eventId, {
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
      message: "휴대폰 카메라로 QR을 스캔해 참여해 주세요.",
    },
  });

  if (error) {
    console.error("[admin-draw] Failed to set join QR screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({
      eventId,
      error: "QR 참여 안내 화면 송출 중 오류가 발생했습니다.",
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

  revalidateDrawPaths(eventId, eventCode);
  redirectToDraw({ eventId, message: "QR 참여 안내 화면을 송출했습니다." });
}

export async function setBreakScreenFromDraw(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const error = await upsertDrawLiveState(eventId, {
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
    console.error("[admin-draw] Failed to set break screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "휴식 화면 송출 중 오류가 발생했습니다." });
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

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "휴식 화면을 송출했습니다." });
}

export async function setLuckyDrawReadyScreenFromDraw(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const error = await upsertDrawLiveState(eventId, {
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
    console.error("[admin-draw] Failed to set lucky draw ready screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({
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

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "럭키드로우 준비 화면을 송출했습니다." });
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
    console.error("[admin-draw] Failed to load prize.", {
      eventId,
      prizeId,
      message: error.message,
      code: error.code,
    });
  }

  return data as PrizeRow | null;
}

async function getActiveWinnerCount(eventId: string, prizeId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("draw_winners")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("prize_id", prizeId)
    .in("status", ["pending", "claimed"]);

  if (error) {
    console.error("[admin-draw] Failed to count active winners.", {
      eventId,
      prizeId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getAnyWinnerCountForPrize(eventId: string, prizeId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("draw_winners")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("prize_id", prizeId);

  if (error) {
    console.error("[admin-draw] Failed to count prize winners.", {
      eventId,
      prizeId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getAlreadyWonParticipantIds(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("draw_winners")
    .select("participant_id")
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-draw] Failed to load previous winners.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return new Set<string>();
  }

  // The current DB has a unique constraint on (event_id, participant_id), so
  // cancelled/redrawn rows still prevent duplicate winning until a future
  // migration intentionally changes that policy.
  return new Set((data ?? []).map((winner) => winner.participant_id));
}

async function validateSessionForEvent(eventId: string, sessionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-draw] Failed to validate quiz session.", {
      eventId,
      sessionId,
      message: error.message,
      code: error.code,
    });
  }

  return Boolean(data);
}

async function validateQuestionForEvent(eventId: string, questionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, session_id")
    .eq("id", questionId)
    .maybeSingle();

  if (questionError) {
    console.error("[admin-draw] Failed to load source question.", {
      eventId,
      questionId,
      message: questionError.message,
      code: questionError.code,
    });

    return false;
  }

  if (!question) {
    return false;
  }

  return validateSessionForEvent(eventId, question.session_id);
}

async function validateSurveyFormForEvent(eventId: string, surveyFormId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_forms")
    .select("id")
    .eq("id", surveyFormId)
    .eq("event_id", eventId)
    .in("status", ["open", "closed"])
    .maybeSingle();

  if (error) {
    console.error("[admin-draw] Failed to validate survey form.", {
      eventId,
      surveyFormId,
      message: error.message,
      code: error.code,
    });
  }

  return Boolean(data);
}

async function getQuestionIdsForSession(sessionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("session_id", sessionId);

  if (error) {
    console.error("[admin-draw] Failed to load session question ids.", {
      sessionId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  return (data ?? []).map((question) => question.id);
}

async function getParticipantPool({
  eventId,
  sourceType,
  sourceSessionId,
  sourceQuestionId,
  surveyFormId,
  excludeAlreadyWon,
}: {
  eventId: string;
  sourceType: DrawSourceType;
  sourceSessionId: string | null;
  sourceQuestionId: string | null;
  surveyFormId: string | null;
  excludeAlreadyWon: boolean;
}) {
  const supabase = createAdminSupabaseClient();
  let participantIds: string[] | null = null;

  if (sourceType === "correct_answers") {
    let query = supabase
      .from("answers")
      .select("participant_id")
      .eq("event_id", eventId)
      .eq("is_correct", true);

    if (sourceSessionId) {
      const hasSession = await validateSessionForEvent(eventId, sourceSessionId);

      if (!hasSession) {
        return [];
      }

      const questionIds = await getQuestionIdsForSession(sourceSessionId);

      if (questionIds.length === 0) {
        return [];
      }

      query = query.in("question_id", questionIds);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[admin-draw] Failed to load correct-answer pool.", {
        eventId,
        sourceSessionId,
        message: error.message,
        code: error.code,
      });

      return [];
    }

    participantIds = Array.from(
      new Set((data ?? []).map((answer) => answer.participant_id))
    );
  }

  if (sourceType === "question_correct_answers") {
    if (!sourceQuestionId) {
      return [];
    }

    const hasQuestion = await validateQuestionForEvent(eventId, sourceQuestionId);

    if (!hasQuestion) {
      return [];
    }

    const { data, error } = await supabase
      .from("answers")
      .select("participant_id")
      .eq("event_id", eventId)
      .eq("question_id", sourceQuestionId)
      .eq("is_correct", true);

    if (error) {
      console.error("[admin-draw] Failed to load question-correct pool.", {
        eventId,
        sourceQuestionId,
        message: error.message,
        code: error.code,
      });

      return [];
    }

    participantIds = Array.from(
      new Set((data ?? []).map((answer) => answer.participant_id))
    );
  }

  if (sourceType === "survey_respondents") {
    if (!surveyFormId) {
      return [];
    }

    const hasSurvey = await validateSurveyFormForEvent(eventId, surveyFormId);

    if (!hasSurvey) {
      return [];
    }

    const { data, error } = await supabase
      .from("survey_responses")
      .select("participant_id")
      .eq("event_id", eventId)
      .eq("survey_form_id", surveyFormId);

    if (error) {
      console.error("[admin-draw] Failed to load survey respondent pool.", {
        eventId,
        surveyFormId,
        message: error.message,
        code: error.code,
      });

      return [];
    }

    participantIds = Array.from(
      new Set((data ?? []).map((response) => response.participant_id))
    );
  }

  let participantQuery = supabase
    .from("participants")
    .select("id, name, display_name")
    .eq("event_id", eventId);

  if (participantIds) {
    if (participantIds.length === 0) {
      return [];
    }

    participantQuery = participantQuery.in("id", participantIds);
  }

  const { data: participants, error: participantError } = await participantQuery;

  if (participantError) {
    console.error("[admin-draw] Failed to load participant pool.", {
      eventId,
      sourceType,
      message: participantError.message,
      code: participantError.code,
    });

    return [];
  }

  const excludedIds = excludeAlreadyWon
    ? await getAlreadyWonParticipantIds(eventId)
    : new Set<string>();

  return ((participants ?? []) as CandidateParticipant[]).filter(
    (participant) => !excludedIds.has(participant.id)
  );
}

async function setDrawScreenState({
  eventId,
  eventCode,
  winnerId,
  participantDisplayName,
  prizeName,
  sourceType,
  candidateNames,
  createdAt,
  drawPhase = "rolling",
}: {
  eventId: string;
  eventCode: string;
  winnerId: string;
  participantDisplayName: string;
  prizeName: string;
  sourceType: DrawSourceType;
  candidateNames: string[];
  createdAt: string | null;
  drawPhase?: "rolling" | "result";
}) {
  const supabase = createAdminSupabaseClient();

  // Screen payload deliberately contains only presentation-safe fields. If
  // privacy policy later requires masking names, apply it before this upsert.
  const { error } = await supabase.from("live_state").upsert(
    {
      event_id: eventId,
      current_session_id: null,
      current_question_id: null,
      mode: "draw",
      question_started_at: null,
      question_ends_at: null,
      reveal_answer: false,
      show_results: false,
      screen_scene: "draw_winner",
      updated_at: new Date().toISOString(),
      screen_payload: {
        winner_id: winnerId,
        animation_id: `${winnerId}-${Date.now()}`,
        participant_display_name: participantDisplayName,
        winner_name: participantDisplayName,
        prize_name: prizeName,
        prize_title: prizeName,
        source_type: sourceType,
        draw_phase: drawPhase,
        candidate_names: candidateNames,
        message:
          drawPhase === "rolling"
            ? "두구두구... 곧 당첨자를 공개합니다."
            : "최근 당첨 결과를 다시 송출합니다.",
        duration_ms: 7000,
        countdown_seconds: 3,
        created_at: createdAt,
      },
    },
    { onConflict: "event_id" }
  );

  if (error) {
    console.error("[admin-draw] Failed to update draw screen state.", {
      eventId,
      winnerId,
      message: error.message,
      code: error.code,
    });
  }

  revalidateDrawPaths(eventId, eventCode);
}

async function insertDrawWinner({
  eventId,
  eventCode,
  adminUserId,
  prize,
  sourceType,
  sourceSessionId,
  sourceQuestionId,
  surveyFormId,
  participant,
  candidateNames,
  logAction = "draw_winner_selected",
}: {
  eventId: string;
  eventCode: string;
  adminUserId: string;
  prize: PrizeRow;
  sourceType: DrawSourceType;
  sourceSessionId: string | null;
  sourceQuestionId: string | null;
  surveyFormId: string | null;
  participant: CandidateParticipant;
  candidateNames: string[];
  logAction?: Extract<DrawLogAction, "draw_winner_selected" | "draw_winner_redrawn">;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("draw_winners")
    .insert({
      event_id: eventId,
      prize_id: prize.id,
      participant_id: participant.id,
      source_type: sourceType,
      source_question_id:
        sourceType === "question_correct_answers" ? sourceQuestionId : null,
      survey_form_id: sourceType === "survey_respondents" ? surveyFormId : null,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      redirectToDraw({
        eventId,
        error: "이미 당첨 이력이 있는 참가자입니다. 다른 후보로 다시 시도해 주세요.",
      });
    }

    console.error("[admin-draw] Failed to insert draw winner.", {
      eventId,
      prizeId: prize.id,
      participantId: participant.id,
      sourceType,
      sourceQuestionId,
      message: error?.message,
      code: error?.code,
    });

    redirectToDraw({
      eventId,
      error: "당첨자 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId,
    action: logAction,
    detail: {
      event_id: eventId,
      prize_id: prize.id,
      source_type: sourceType,
      source_session_id: sourceSessionId,
      source_question_id: sourceQuestionId,
      survey_form_id: surveyFormId,
      winner_id: data.id,
      screen_scene: "draw_winner",
      draw_phase: "rolling",
      changed_at: new Date().toISOString(),
    },
  });

  await setDrawScreenState({
    eventId,
    eventCode,
    winnerId: data.id,
    participantDisplayName: displayName(participant),
    prizeName: prize.name,
    sourceType,
    candidateNames,
    createdAt: data.created_at,
  });
}

export async function createPrize(eventId: string, formData: FormData) {
  const { admin, event } = await requireDrawOperation(eventId);
  const name = getFormString(formData, "name");
  const quantity = getFormQuantity(formData);

  if (!name) {
    redirectToDraw({ eventId, error: "경품명을 입력해 주세요." });
  }

  if (!quantity) {
    redirectToDraw({ eventId, error: "수량은 1 이상이어야 합니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("prizes")
    .insert({
      event_id: eventId,
      name,
      quantity,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[admin-draw] Failed to create prize.", {
      eventId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToDraw({ eventId, error: "경품 생성 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "prize_created",
    detail: {
      event_id: eventId,
      prize_id: data.id,
    },
  });

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "경품이 생성되었습니다." });
}

export async function updatePrize(
  eventId: string,
  prizeId: string,
  formData: FormData
) {
  const { admin, event } = await requireDrawOperation(eventId);
  const name = getFormString(formData, "name");
  const quantity = getFormQuantity(formData);

  if (!name) {
    redirectToDraw({ eventId, error: "경품명을 입력해 주세요." });
  }

  if (!quantity) {
    redirectToDraw({ eventId, error: "수량은 1 이상이어야 합니다." });
  }

  const prize = await getPrize(eventId, prizeId);

  if (!prize) {
    redirectToDraw({ eventId, error: "경품을 찾을 수 없습니다." });
  }

  const activeWinnerCount = await getActiveWinnerCount(eventId, prizeId);

  if (quantity < activeWinnerCount) {
    redirectToDraw({
      eventId,
      error: "이미 확정된 당첨자 수보다 적은 수량으로 줄일 수 없습니다.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("prizes")
    .update({ name, quantity })
    .eq("id", prizeId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-draw] Failed to update prize.", {
      eventId,
      prizeId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "경품 수정 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "prize_updated",
    detail: {
      event_id: eventId,
      prize_id: prizeId,
    },
  });

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "경품이 수정되었습니다." });
}

export async function deletePrize(eventId: string, prizeId: string) {
  const { admin, event } = await requireDrawOperation(eventId);
  const prize = await getPrize(eventId, prizeId);

  if (!prize) {
    redirectToDraw({ eventId, error: "경품을 찾을 수 없습니다." });
  }

  const winnerCount = await getAnyWinnerCountForPrize(eventId, prizeId);

  if (winnerCount > 0) {
    redirectToDraw({
      eventId,
      error: "이미 당첨자와 연결된 경품은 삭제할 수 없습니다.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("prizes")
    .delete()
    .eq("id", prizeId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-draw] Failed to delete prize.", {
      eventId,
      prizeId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "경품 삭제 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "prize_deleted",
    detail: {
      event_id: eventId,
      prize_id: prizeId,
    },
  });

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "경품이 삭제되었습니다." });
}

export async function drawWinner(eventId: string, formData: FormData) {
  const { admin, event } = await requireDrawOperation(eventId);
  const prizeId = getFormString(formData, "prize_id");
  const sourceType = getSourceType(getFormString(formData, "source_type"));
  const sourceSessionId = getOptionalFormString(formData, "source_session_id");
  const sourceQuestionId = getOptionalFormString(formData, "source_question_id");
  const surveyFormId = getOptionalFormString(formData, "survey_form_id");
  const excludeAlreadyWon = formData.get("exclude_already_won") === "on";

  if (!prizeId || !sourceType) {
    redirectToDraw({ eventId, error: "경품과 추첨 대상을 선택해 주세요." });
  }

  if (sourceType === "question_correct_answers" && !sourceQuestionId) {
    redirectToDraw({ eventId, error: "특정 문제 정답자 추첨은 문제 선택이 필요합니다." });
  }

  if (sourceType === "survey_respondents" && !surveyFormId) {
    redirectToDraw({ eventId, error: "설문 제출자 추첨은 설문 선택이 필요합니다." });
  }

  const prize = await getPrize(eventId, prizeId);

  if (!prize) {
    redirectToDraw({ eventId, error: "경품을 찾을 수 없습니다." });
  }

  const activeWinnerCount = await getActiveWinnerCount(eventId, prize.id);

  if (activeWinnerCount >= prize.quantity) {
    redirectToDraw({ eventId, error: "해당 경품의 남은 수량이 없습니다." });
  }

  const pool = await getParticipantPool({
    eventId,
    sourceType,
    sourceSessionId,
    sourceQuestionId,
    surveyFormId,
    excludeAlreadyWon,
  });

  if (pool.length === 0) {
    redirectToDraw({ eventId, error: "추첨 가능한 대상자가 없습니다." });
  }

  const selectedParticipant = pool[randomInt(pool.length)];

  await insertDrawWinner({
    eventId,
    eventCode: event.event_code,
    adminUserId: admin.id,
    prize,
    sourceType,
    sourceSessionId,
    sourceQuestionId,
    surveyFormId,
    participant: selectedParticipant,
    candidateNames: candidateNamesForScreen(pool, selectedParticipant),
  });

  redirectToDraw({
    eventId,
    message: `${displayName(selectedParticipant)}님이 당첨자로 선정되었습니다.`,
  });
}

async function getDrawWinner(eventId: string, winnerId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("draw_winners")
    .select(
      "id, event_id, prize_id, participant_id, source_type, source_question_id, survey_form_id, status, created_at"
    )
    .eq("id", winnerId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-draw] Failed to load draw winner.", {
      eventId,
      winnerId,
      message: error.message,
      code: error.code,
    });
  }

  return data as DrawWinnerRow | null;
}

async function getParticipantForWinner(eventId: string, participantId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, display_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-draw] Failed to load winner display participant.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as CandidateParticipant | null;
}

async function getLatestActiveDrawWinner(eventId: string) {
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
    console.error("[admin-draw] Failed to load latest draw winner.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as DrawWinnerRow | null;
}

export async function replayLatestWinnerOnScreen(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireDrawOperation(eventId);
  const winner = await getLatestActiveDrawWinner(eventId);

  if (!winner) {
    redirectToDraw({
      eventId,
      error: "다시 송출할 최근 당첨 결과가 없습니다.",
    });
  }

  const participant = await getParticipantForWinner(eventId, winner.participant_id);

  if (!participant) {
    redirectToDraw({
      eventId,
      error: "당첨자 표시 이름을 확인할 수 없어 다시 송출할 수 없습니다.",
    });
  }

  const prize = winner.prize_id ? await getPrize(eventId, winner.prize_id) : null;
  const participantName = displayName(participant);
  const prizeName = prize?.name ?? "경품 없음";

  await setDrawScreenState({
    eventId,
    eventCode: event.event_code,
    winnerId: winner.id,
    participantDisplayName: participantName,
    prizeName,
    sourceType: winner.source_type,
    candidateNames: candidateNamesForScreen([participant], participant),
    createdAt: winner.created_at,
    drawPhase: "result",
  });

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

  redirectToDraw({ eventId, message: "최근 당첨 결과를 다시 송출했습니다." });
}

export async function markWinnerClaimed(eventId: string, winnerId: string) {
  const { admin, event } = await requireDrawOperation(eventId);
  const winner = await getDrawWinner(eventId, winnerId);

  if (!winner) {
    redirectToDraw({ eventId, error: "당첨자를 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("draw_winners")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
    })
    .eq("id", winnerId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-draw] Failed to mark winner claimed.", {
      eventId,
      winnerId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "수령 완료 처리 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "draw_winner_claimed",
    detail: {
      event_id: eventId,
      winner_id: winnerId,
      prize_id: winner.prize_id,
      source_type: winner.source_type,
      source_question_id: winner.source_question_id,
    },
  });

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "수령 완료로 처리되었습니다." });
}

export async function cancelWinner(eventId: string, winnerId: string) {
  const { admin, event } = await requireDrawOperation(eventId);
  const winner = await getDrawWinner(eventId, winnerId);

  if (!winner) {
    redirectToDraw({ eventId, error: "당첨자를 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("draw_winners")
    .update({
      status: "cancelled",
      claimed_at: null,
    })
    .eq("id", winnerId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-draw] Failed to cancel winner.", {
      eventId,
      winnerId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToDraw({ eventId, error: "당첨 취소 처리 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "draw_winner_cancelled",
    detail: {
      event_id: eventId,
      winner_id: winnerId,
      prize_id: winner.prize_id,
      source_type: winner.source_type,
      source_question_id: winner.source_question_id,
    },
  });

  revalidateDrawPaths(eventId, event.event_code);
  redirectToDraw({ eventId, message: "당첨이 취소되었습니다." });
}

export async function redrawWinner(eventId: string, winnerId: string) {
  const { admin, event } = await requireDrawOperation(eventId);
  const winner = await getDrawWinner(eventId, winnerId);

  if (!winner || !winner.prize_id) {
    redirectToDraw({ eventId, error: "재추첨할 당첨 내역을 찾을 수 없습니다." });
  }

  const prize = await getPrize(eventId, winner.prize_id);

  if (!prize) {
    redirectToDraw({ eventId, error: "경품을 찾을 수 없습니다." });
  }

  const pool = await getParticipantPool({
    eventId,
    sourceType: winner.source_type,
    sourceSessionId: null,
    sourceQuestionId: winner.source_question_id,
    surveyFormId: winner.survey_form_id,
    excludeAlreadyWon: true,
  });

  if (pool.length === 0) {
    redirectToDraw({ eventId, error: "재추첨 가능한 대상자가 없습니다." });
  }

  const selectedParticipant = pool[randomInt(pool.length)];
  const supabase = createAdminSupabaseClient();
  const { error: updateError } = await supabase
    .from("draw_winners")
    .update({
      status: "redrawn",
      claimed_at: null,
    })
    .eq("id", winnerId)
    .eq("event_id", eventId);

  if (updateError) {
    console.error("[admin-draw] Failed to mark winner redrawn.", {
      eventId,
      winnerId,
      adminUserId: admin.id,
      message: updateError.message,
      code: updateError.code,
    });

    redirectToDraw({ eventId, error: "기존 당첨자 재추첨 처리 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "draw_winner_redrawn",
    detail: {
      event_id: eventId,
      winner_id: winnerId,
      prize_id: winner.prize_id,
      source_type: winner.source_type,
      source_question_id: winner.source_question_id,
      survey_form_id: winner.survey_form_id,
      status: "redrawn",
    },
  });

  await insertDrawWinner({
    eventId,
    eventCode: event.event_code,
    adminUserId: admin.id,
    prize,
    sourceType: winner.source_type,
    sourceSessionId: null,
    sourceQuestionId: winner.source_question_id,
    surveyFormId: winner.survey_form_id,
    participant: selectedParticipant,
    candidateNames: candidateNamesForScreen(pool, selectedParticipant),
    logAction: "draw_winner_selected",
  });

  redirectToDraw({
    eventId,
    message: `${displayName(selectedParticipant)}님이 재추첨 당첨자로 선정되었습니다.`,
  });
}
