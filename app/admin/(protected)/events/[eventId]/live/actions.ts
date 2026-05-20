"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  canOperateLiveScreenByRole,
  canOperateLiveByRole,
  canSetQnaScreenByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { buildPublicUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LiveLogAction =
  | "live_screen_set_waiting"
  | "live_screen_set_join_qr"
  | "live_screen_set_qna_waiting"
  | "live_screen_set_break"
  | "live_screen_set_quiz"
  | "live_screen_set_lucky_draw"
  | "live_waiting_set"
  | "live_question_started"
  | "live_question_closed"
  | "live_answer_revealed"
  | "live_result_shown";

function redirectToLive({
  eventId,
  sessionId,
  message,
  error,
}: {
  eventId: string;
  sessionId?: string | null;
  message?: string;
  error?: string;
}): never {
  const params = new URLSearchParams();

  if (sessionId) {
    params.set("sessionId", sessionId);
  }

  if (message) {
    params.set("message", message);
  }

  if (error) {
    params.set("error", error);
  }

  const query = params.toString();

  redirect(`/admin/events/${eventId}/live${query ? `?${query}` : ""}`);
}

async function requireLiveOperation(eventId: string) {
  const currentAdmin = await requireAdmin();
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canOperateLiveByRole(role)) {
    redirectToLive({
      eventId,
      error: "현재 역할은 라이브 진행을 제어할 수 없습니다.",
    });
  }

  return {
    admin: currentAdmin,
    event,
    role,
  };
}

async function requireLiveScreenOperation(
  eventId: string,
  scope: "general" | "qna"
) {
  const currentAdmin = await requireAdmin();
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const allowed =
    scope === "qna"
      ? canSetQnaScreenByRole(role)
      : canOperateLiveScreenByRole(role);

  if (!allowed) {
    redirectToLive({
      eventId,
      error: "현재 역할은 이 스크린 전환을 실행할 수 없습니다.",
    });
  }

  return {
    admin: currentAdmin,
    event,
    role,
  };
}

async function writeOperationLog({
  eventId,
  adminUserId,
  action,
  detail,
}: {
  eventId: string;
  adminUserId: string;
  action: LiveLogAction;
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
    console.error("[admin-live] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

async function getSessionForEvent(eventId: string, sessionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, event_id, title")
    .eq("id", sessionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-live] Failed to load quiz session.", {
      eventId,
      sessionId,
      message: error.message,
      code: error.code,
    });
  }

  return data;
}

async function getQuestionForSession(sessionId: string, questionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, session_id, question_text, time_limit_seconds, is_active")
    .eq("id", questionId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[admin-live] Failed to load question.", {
      sessionId,
      questionId,
      message: error.message,
      code: error.code,
    });
  }

  return data;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
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
    },
    { onConflict: "event_id" }
  );

  return error;
}

function revalidateLivePaths(eventId: string, eventCode: string) {
  revalidatePath(`/admin/events/${eventId}/live`);
  revalidatePath(`/screen/${eventCode}`);
  revalidatePath(`/api/screen/${eventCode}/state`);
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

export async function setWaitingMode(eventId: string, formData: FormData) {
  void formData;

  const { admin, event } = await requireLiveScreenOperation(eventId, "general");
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
    console.error("[admin-live] Failed to set waiting mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      error: "대기 화면 전환 중 오류가 발생했습니다.",
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

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({ eventId, message: "대기 화면으로 전환했습니다." });
}

export async function setJoinQrMode(eventId: string, formData: FormData) {
  void formData;

  const { admin, event } = await requireLiveScreenOperation(eventId, "general");
  const eventCode = event.event_code?.trim();

  if (!eventCode) {
    redirectToLive({
      eventId,
      error: "행사 코드가 없어 QR 참여 안내 화면을 송출할 수 없습니다.",
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
      message: "휴대폰 카메라로 QR을 스캔해 참여해 주세요.",
    },
  });

  if (error) {
    console.error("[admin-live] Failed to set join QR mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      error: "QR 참여 안내 화면 전환 중 오류가 발생했습니다.",
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

  revalidateLivePaths(eventId, eventCode);
  redirectToLive({ eventId, message: "QR 참여 안내 화면으로 전환했습니다." });
}

export async function setQnaWaitingMode(eventId: string, formData: FormData) {
  void formData;

  const { admin, event } = await requireLiveScreenOperation(eventId, "qna");
  const error = await upsertLiveState(eventId, {
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
    console.error("[admin-live] Failed to set Q&A waiting mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      error: "Q&A 대기 화면 전환 중 오류가 발생했습니다.",
    });
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

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({ eventId, message: "Q&A 대기 화면으로 전환했습니다." });
}

export async function setBreakMode(eventId: string, formData: FormData) {
  void formData;

  const { admin, event } = await requireLiveScreenOperation(eventId, "general");
  const error = await upsertLiveState(eventId, {
    current_session_id: null,
    current_question_id: null,
    // The database check constraint does not include a "break" mode yet, so
    // break is represented as a waiting-mode scene.
    mode: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    screen_scene: "break",
    screen_payload: {
      title: "잠시 쉬는 시간입니다",
      message: "곧 다시 시작합니다",
    },
  });

  if (error) {
    console.error("[admin-live] Failed to set break mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      error: "휴식 화면 전환 중 오류가 발생했습니다.",
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

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({ eventId, message: "휴식 화면으로 전환했습니다." });
}

export async function setLuckyDrawMode(eventId: string, formData: FormData) {
  void formData;

  const { admin, event } = await requireLiveScreenOperation(eventId, "general");
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
    console.error("[admin-live] Failed to set lucky draw mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      error: "럭키드로우 준비 화면 전환 중 오류가 발생했습니다.",
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

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({ eventId, message: "럭키드로우 준비 화면으로 전환했습니다." });
}

export async function startQuestion(eventId: string, formData: FormData) {
  const { admin, event } = await requireLiveOperation(eventId);
  const sessionId = getFormString(formData, "session_id");
  const questionId = getFormString(formData, "question_id");

  if (!sessionId || !questionId) {
    redirectToLive({
      eventId,
      error: "시작할 세션과 문제를 선택해 주세요.",
    });
  }

  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToLive({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const question = await getQuestionForSession(sessionId, questionId);

  if (!question) {
    redirectToLive({
      eventId,
      sessionId,
      error: "문제를 찾을 수 없습니다.",
    });
  }

  if (question.is_active === false) {
    redirectToLive({
      eventId,
      sessionId,
      error: "비활성 문제는 시작할 수 없습니다.",
    });
  }

  const startedAt = new Date();
  const endsAt = new Date(
    startedAt.getTime() + Number(question.time_limit_seconds) * 1000
  );
  const error = await upsertLiveState(eventId, {
    current_session_id: sessionId,
    current_question_id: questionId,
    mode: "question",
    question_started_at: startedAt.toISOString(),
    question_ends_at: endsAt.toISOString(),
    reveal_answer: false,
    show_results: false,
    screen_scene: "question",
    screen_payload: {},
  });

  if (error) {
    console.error("[admin-live] Failed to start question.", {
      eventId,
      sessionId,
      questionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      sessionId,
      error: "문제 시작 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_screen_set_quiz",
    detail: {
      event_id: eventId,
      session_id: sessionId,
      question_id: questionId,
      mode: "question",
      screen_scene: "question",
      changed_at: new Date().toISOString(),
    },
  });

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({
    eventId,
    sessionId,
    message: "문제를 시작했습니다.",
  });
}

export async function closeQuestion(eventId: string, formData: FormData) {
  const { admin, event } = await requireLiveOperation(eventId);
  const sessionId = getFormString(formData, "session_id") || null;
  const error = await upsertLiveState(eventId, {
    mode: "closed",
    reveal_answer: false,
    show_results: false,
    screen_scene: "closed",
  });

  if (error) {
    console.error("[admin-live] Failed to close question.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      sessionId,
      error: "응답 마감 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_question_closed",
    detail: {
      event_id: eventId,
      session_id: sessionId,
      mode: "closed",
      screen_scene: "closed",
      changed_at: new Date().toISOString(),
    },
  });

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({
    eventId,
    sessionId,
    message: "응답을 마감했습니다.",
  });
}

export async function revealQuestionAnswer(eventId: string, formData: FormData) {
  const { admin, event } = await requireLiveOperation(eventId);
  const sessionId = getFormString(formData, "session_id") || null;
  const error = await upsertLiveState(eventId, {
    mode: "result",
    reveal_answer: true,
    show_results: true,
    screen_scene: "result",
  });

  if (error) {
    console.error("[admin-live] Failed to reveal answer.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      sessionId,
      error: "정답 공개 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_answer_revealed",
    detail: {
      event_id: eventId,
      session_id: sessionId,
      mode: "result",
      screen_scene: "result",
      changed_at: new Date().toISOString(),
    },
  });

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({
    eventId,
    sessionId,
    message: "정답을 공개했습니다.",
  });
}

export async function showResultMode(eventId: string, formData: FormData) {
  const { admin, event } = await requireLiveOperation(eventId);
  const sessionId = getFormString(formData, "session_id") || null;
  const error = await upsertLiveState(eventId, {
    mode: "result",
    reveal_answer: false,
    show_results: true,
    screen_scene: "result",
  });

  if (error) {
    console.error("[admin-live] Failed to show result mode.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToLive({
      eventId,
      sessionId,
      error: "결과 화면 전환 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "live_result_shown",
    detail: {
      event_id: eventId,
      session_id: sessionId,
      mode: "result",
      screen_scene: "result",
      changed_at: new Date().toISOString(),
    },
  });

  revalidateLivePaths(eventId, event.event_code);
  redirectToLive({
    eventId,
    sessionId,
    message: "결과 화면으로 전환했습니다.",
  });
}
