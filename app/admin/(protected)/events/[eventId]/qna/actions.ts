"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canOperateLiveScreenByRole,
  canModerateQnaByRole,
  canSetQnaScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type QnaLogAction =
  | "qna_question_approved"
  | "qna_question_hidden"
  | "qna_question_deleted"
  | "qna_question_pinned"
  | "qna_question_unpinned"
  | "qna_question_shown_on_screen"
  | "live_screen_set_waiting"
  | "live_screen_set_join_qr"
  | "live_screen_set_qna_waiting"
  | "live_screen_set_break";

type QnaQuestionRow = {
  id: string;
  event_id: string;
  participant_id: string | null;
  question_text: string;
  status: "pending" | "approved" | "hidden" | "deleted";
  is_pinned: boolean | null;
  created_at: string | null;
};

type ParticipantDisplayRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
};

function redirectToQna({
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

  redirect(`/admin/events/${eventId}/qna${query ? `?${query}` : ""}`);
}

async function requireQnaModeration(eventId: string) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canModerateQnaByRole(role)) {
    redirectToQna({
      eventId,
      error: "현재 권한으로는 Q&A 질문을 변경할 수 없습니다.",
    });
  }

  return { admin, event };
}

async function requireQnaScreenOperation(
  eventId: string,
  scope: "general" | "qna"
) {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const allowed =
    scope === "qna"
      ? canSetQnaScreenByRole(role)
      : canOperateLiveScreenByRole(role);

  if (!allowed) {
    redirectToQna({
      eventId,
      error: "현재 역할은 이 스크린 전환을 실행할 수 없습니다.",
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
  action: QnaLogAction;
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
    console.error("[admin-qna] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

function revalidateQnaPaths(eventId: string, eventCode: string) {
  revalidatePath(`/admin/events/${eventId}/qna`);
  revalidatePath(`/screen/${eventCode}`);
  revalidatePath(`/api/screen/${eventCode}/state`);
}

async function upsertQnaLiveState(
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

export async function setWaitingScreenFromQna(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireQnaScreenOperation(eventId, "general");
  const error = await upsertQnaLiveState(eventId, {
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
    console.error("[admin-qna] Failed to set waiting screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "대기 화면 송출 중 오류가 발생했습니다." });
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

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({ eventId, message: "대기 화면을 송출했습니다." });
}

export async function setJoinQrScreenFromQna(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireQnaScreenOperation(eventId, "general");
  const eventCode = event.event_code?.trim();

  if (!eventCode) {
    redirectToQna({
      eventId,
      error: "행사 코드가 없어 QR 참여 안내 화면을 송출할 수 없습니다.",
    });
  }

  const error = await upsertQnaLiveState(eventId, {
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
    console.error("[admin-qna] Failed to set join QR screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({
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

  revalidateQnaPaths(eventId, eventCode);
  redirectToQna({ eventId, message: "QR 참여 안내 화면을 송출했습니다." });
}

export async function setBreakScreenFromQna(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireQnaScreenOperation(eventId, "general");
  const error = await upsertQnaLiveState(eventId, {
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
    console.error("[admin-qna] Failed to set break screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "휴식 화면 송출 중 오류가 발생했습니다." });
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

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({ eventId, message: "휴식 화면을 송출했습니다." });
}

export async function clearQnaScreenFromQna(
  eventId: string,
  formData: FormData
) {
  void formData;

  const { admin, event } = await requireQnaScreenOperation(eventId, "qna");
  const error = await upsertQnaLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    mode: "qna",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "qna_waiting",
    screen_payload: {},
  });

  if (error) {
    console.error("[admin-qna] Failed to clear Q&A screen.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "Q&A 송출 해제 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_qna_waiting",
    detail: screenLogDetail({
      eventId,
      mode: "qna",
      screenScene: "qna_waiting",
    }),
  });

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({
    eventId,
    message: "현재 Q&A 송출을 해제하고 질문 접수 화면을 송출했습니다.",
  });
}

async function getQnaQuestion(eventId: string, qnaQuestionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qna_questions")
    .select(
      "id, event_id, participant_id, question_text, status, is_pinned, created_at"
    )
    .eq("id", qnaQuestionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-qna] Failed to load Q&A question.", {
      eventId,
      qnaQuestionId,
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
    console.error("[admin-qna] Failed to load participant display.", {
      eventId,
      participantId,
      message: error.message,
      code: error.code,
    });
  }

  return data as ParticipantDisplayRow | null;
}

function participantDisplayName(participant: ParticipantDisplayRow | null) {
  return participant?.display_name?.trim() || participant?.name || "익명 참가자";
}

async function updateQuestionStatus({
  eventId,
  qnaQuestionId,
  status,
  action,
  message,
}: {
  eventId: string;
  qnaQuestionId: string;
  status: "approved" | "hidden" | "deleted";
  action: QnaLogAction;
  message: string;
}) {
  const { admin, event } = await requireQnaModeration(eventId);
  const question = await getQnaQuestion(eventId, qnaQuestionId);

  if (!question) {
    redirectToQna({ eventId, error: "질문을 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("qna_questions")
    .update({
      status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", qnaQuestionId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-qna] Failed to update Q&A status.", {
      eventId,
      qnaQuestionId,
      status,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "질문 상태 변경 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action,
    detail: {
      event_id: eventId,
      qna_question_id: qnaQuestionId,
      status,
    },
  });

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({ eventId, message });
}

export async function approveQuestion(eventId: string, qnaQuestionId: string) {
  await updateQuestionStatus({
    eventId,
    qnaQuestionId,
    status: "approved",
    action: "qna_question_approved",
    message: "질문이 승인되었습니다.",
  });
}

export async function hideQuestion(eventId: string, qnaQuestionId: string) {
  await updateQuestionStatus({
    eventId,
    qnaQuestionId,
    status: "hidden",
    action: "qna_question_hidden",
    message: "질문이 숨김 처리되었습니다.",
  });
}

export async function deleteQuestion(eventId: string, qnaQuestionId: string) {
  await updateQuestionStatus({
    eventId,
    qnaQuestionId,
    status: "deleted",
    action: "qna_question_deleted",
    message: "질문이 삭제 상태로 변경되었습니다.",
  });
}

async function updatePinned({
  eventId,
  qnaQuestionId,
  isPinned,
}: {
  eventId: string;
  qnaQuestionId: string;
  isPinned: boolean;
}) {
  const { admin, event } = await requireQnaModeration(eventId);
  const question = await getQnaQuestion(eventId, qnaQuestionId);

  if (!question) {
    redirectToQna({ eventId, error: "질문을 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("qna_questions")
    .update({ is_pinned: isPinned })
    .eq("id", qnaQuestionId)
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-qna] Failed to update Q&A pin.", {
      eventId,
      qnaQuestionId,
      isPinned,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "핀 상태 변경 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: isPinned ? "qna_question_pinned" : "qna_question_unpinned",
    detail: {
      event_id: eventId,
      qna_question_id: qnaQuestionId,
      is_pinned: isPinned,
    },
  });

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({
    eventId,
    message: isPinned ? "질문을 고정했습니다." : "질문 고정을 해제했습니다.",
  });
}

export async function pinQuestion(eventId: string, qnaQuestionId: string) {
  await updatePinned({ eventId, qnaQuestionId, isPinned: true });
}

export async function unpinQuestion(eventId: string, qnaQuestionId: string) {
  await updatePinned({ eventId, qnaQuestionId, isPinned: false });
}

export async function showQuestionOnScreen(
  eventId: string,
  qnaQuestionId: string
) {
  const { admin, event } = await requireQnaModeration(eventId);
  const question = await getQnaQuestion(eventId, qnaQuestionId);

  if (!question) {
    redirectToQna({ eventId, error: "질문을 찾을 수 없습니다." });
  }

  if (question.status !== "approved") {
    redirectToQna({
      eventId,
      error: "승인된 질문만 스크린에 송출할 수 있습니다.",
    });
  }

  const participant = await getParticipantDisplay({
    eventId,
    participantId: question.participant_id,
  });
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("live_state").upsert(
    {
      event_id: eventId,
      current_session_id: null,
      current_question_id: null,
      mode: "qna",
      question_started_at: null,
      question_ends_at: null,
      reveal_answer: false,
      show_results: false,
      screen_scene: "qna_question",
      updated_at: new Date().toISOString(),
      screen_payload: {
        qna_question_id: question.id,
        question_text: question.question_text,
        participant_display_name: participantDisplayName(participant),
        organization: participant?.organization ?? null,
        group_name: participant?.group_name ?? null,
        created_at: question.created_at,
      },
    },
    { onConflict: "event_id" }
  );

  if (error) {
    console.error("[admin-qna] Failed to show Q&A question on screen.", {
      eventId,
      qnaQuestionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQna({ eventId, error: "스크린 송출 중 오류가 발생했습니다." });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "qna_question_shown_on_screen",
    detail: {
      event_id: eventId,
      qna_question_id: qnaQuestionId,
      status: question.status,
    },
  });

  revalidateQnaPaths(eventId, event.event_code);
  redirectToQna({ eventId, message: "질문을 스크린에 송출했습니다." });
}
