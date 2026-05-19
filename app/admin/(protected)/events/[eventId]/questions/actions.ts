"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  canEditEventQuestionsByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { QuestionType, QuizSessionStatus } from "@/lib/data/quiz";

const SESSION_STATUSES: QuizSessionStatus[] = [
  "draft",
  "ready",
  "live",
  "ended",
];

const QUESTION_TYPES: QuestionType[] = [
  "quiz_single",
  "poll_single",
  "poll_multiple",
  "ox",
];

type OperationLogAction =
  | "quiz_session_created"
  | "quiz_session_updated"
  | "quiz_session_deleted"
  | "question_created"
  | "question_updated"
  | "question_deleted"
  | "question_reordered";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectToQuestions({
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

  redirect(`/admin/events/${eventId}/questions${query ? `?${query}` : ""}`);
}

async function requireQuestionMutation(eventId: string) {
  const currentAdmin = await requireAdmin();
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  // Mutation 기준은 행사별 역할을 우선한다. super_admin, event_admin,
  // operator는 문제 은행을 수정할 수 있고 screen_operator/qna_moderator는
  // 현장 화면 확인 목적의 조회만 허용한다.
  if (!canEditEventQuestionsByRole(role)) {
    redirectToQuestions({
      eventId,
      error: "현재 역할은 문제를 생성, 수정, 삭제할 수 없습니다.",
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
  action: OperationLogAction;
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
    console.error("[admin-questions] Failed to write operation log.", {
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
    .select("id, event_id, title, status")
    .eq("id", sessionId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-questions] Failed to load quiz session.", {
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
    .select("id, session_id, question_text, order_index")
    .eq("id", questionId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[admin-questions] Failed to load question.", {
      sessionId,
      questionId,
      message: error.message,
      code: error.code,
    });
  }

  return data;
}

async function normalizeQuestionOrder(sessionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[admin-questions] Failed to load questions for reorder.", {
      sessionId,
      message: error.message,
      code: error.code,
    });

    return false;
  }

  const updates = (data ?? []).map((question, index) =>
    supabase
      .from("questions")
      .update({ order_index: index + 1 })
      .eq("id", question.id)
  );

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error("[admin-questions] Failed to normalize question order.", {
      sessionId,
      message: failed.error.message,
      code: failed.error.code,
    });

    return false;
  }

  return true;
}

function validateSessionForm(formData: FormData) {
  const title = getFormString(formData, "title");
  const rawStatus = getFormString(formData, "status") || "draft";
  const status = SESSION_STATUSES.includes(rawStatus as QuizSessionStatus)
    ? (rawStatus as QuizSessionStatus)
    : null;

  if (!title) {
    return { error: "세션명을 입력해 주세요." };
  }

  if (!status) {
    return { error: "세션 상태를 다시 선택해 주세요." };
  }

  return {
    values: {
      title,
      status,
    },
  };
}

function validateQuestionForm(formData: FormData) {
  const questionText = getFormString(formData, "question_text");
  const option1 = getFormString(formData, "option_1");
  const option2 = getFormString(formData, "option_2");
  const option3 = getFormString(formData, "option_3");
  const option4 = getFormString(formData, "option_4");
  const correctOption = Number(getFormString(formData, "correct_option"));
  const timeLimitSeconds = Number(
    getFormString(formData, "time_limit_seconds") || "20"
  );
  const rawQuestionType = getFormString(formData, "question_type") || "quiz_single";
  const questionType = QUESTION_TYPES.includes(rawQuestionType as QuestionType)
    ? (rawQuestionType as QuestionType)
    : null;

  if (!questionText) {
    return { error: "질문을 입력해 주세요." };
  }

  // 002 migration이 question_type을 확장했지만 questions 테이블은 아직
  // option_1~4가 모두 not null이다. OX도 이번 단계에서는 네 선택지 구조를
  // 유지하고, 참가자용 payload를 만들 때 option_1/2만 노출하는 방식으로
  // 분리할 예정이다.
  if (!option1 || !option2 || !option3 || !option4) {
    return { error: "선택지 1~4를 모두 입력해 주세요." };
  }

  if (![1, 2, 3, 4].includes(correctOption)) {
    return { error: "정답은 1, 2, 3, 4 중 하나여야 합니다." };
  }

  if (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 5) {
    return { error: "제한 시간은 5초 이상이어야 합니다." };
  }

  if (timeLimitSeconds > 300) {
    return { error: "제한 시간은 300초 이하로 입력해 주세요." };
  }

  if (!questionType) {
    return { error: "문제 유형을 다시 선택해 주세요." };
  }

  return {
    values: {
      question_text: questionText,
      option_1: option1,
      option_2: option2,
      option_3: option3,
      option_4: option4,
      correct_option: correctOption,
      time_limit_seconds: timeLimitSeconds,
      question_type: questionType,
      is_active: formData.get("is_active") === "on",
    },
  };
}

export async function createQuizSession(eventId: string, formData: FormData) {
  const { admin } = await requireQuestionMutation(eventId);
  const validated = validateSessionForm(formData);

  if ("error" in validated) {
    redirectToQuestions({ eventId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .insert({
      event_id: eventId,
      title: validated.values.title,
      status: validated.values.status,
    })
    .select("id, title, status")
    .single();

  if (error || !data) {
    console.error("[admin-questions] Failed to create quiz session.", {
      eventId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToQuestions({
      eventId,
      error: "세션 생성 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "quiz_session_created",
    detail: {
      session_id: data.id,
      title: data.title,
      status: data.status,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId: data.id,
    message: "퀴즈 세션을 생성했습니다.",
  });
}

export async function updateQuizSession(
  eventId: string,
  sessionId: string,
  formData: FormData
) {
  const { admin } = await requireQuestionMutation(eventId);
  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const validated = validateSessionForm(formData);

  if ("error" in validated) {
    redirectToQuestions({ eventId, sessionId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("quiz_sessions")
    .update({
      title: validated.values.title,
      status: validated.values.status,
    })
    .eq("id", sessionId);

  if (error) {
    console.error("[admin-questions] Failed to update quiz session.", {
      eventId,
      sessionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "세션 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "quiz_session_updated",
    detail: {
      session_id: sessionId,
      title: validated.values.title,
      status: validated.values.status,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId,
    message: "세션 정보를 저장했습니다.",
  });
}

export async function deleteQuizSession(
  eventId: string,
  sessionId: string,
  formData: FormData
) {
  const { admin } = await requireQuestionMutation(eventId);
  const confirmed = formData.get("confirm_delete") === "yes";

  if (!confirmed) {
    redirectToQuestions({
      eventId,
      sessionId,
      error: "세션 삭제 확인을 체크해 주세요.",
    });
  }

  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { count, error: countError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countError) {
    console.error("[admin-questions] Failed to count questions before delete.", {
      eventId,
      sessionId,
      message: countError.message,
      code: countError.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "세션 삭제 전 문제 수 확인에 실패했습니다.",
    });
  }

  if ((count ?? 0) > 0) {
    redirectToQuestions({
      eventId,
      sessionId,
      error:
        "문제가 연결된 세션은 삭제하지 않았습니다. 먼저 문제를 삭제한 뒤 다시 시도해 주세요.",
    });
  }

  const { error } = await supabase
    .from("quiz_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("[admin-questions] Failed to delete quiz session.", {
      eventId,
      sessionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "세션 삭제 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "quiz_session_deleted",
    detail: {
      session_id: sessionId,
      title: session.title,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    message: "퀴즈 세션을 삭제했습니다.",
  });
}

export async function createQuestion(
  eventId: string,
  sessionId: string,
  formData: FormData
) {
  const { admin } = await requireQuestionMutation(eventId);
  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const validated = validateQuestionForm(formData);

  if ("error" in validated) {
    redirectToQuestions({ eventId, sessionId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { data: lastQuestion, error: orderError } = await supabase
    .from("questions")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError) {
    console.error("[admin-questions] Failed to read last question order.", {
      eventId,
      sessionId,
      message: orderError.message,
      code: orderError.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 순서 확인 중 오류가 발생했습니다.",
    });
  }

  const nextOrderIndex =
    typeof lastQuestion?.order_index === "number"
      ? lastQuestion.order_index + 1
      : 1;

  const { data, error } = await supabase
    .from("questions")
    .insert({
      session_id: sessionId,
      ...validated.values,
      order_index: nextOrderIndex,
    })
    .select("id, question_text, order_index")
    .single();

  if (error || !data) {
    console.error("[admin-questions] Failed to create question.", {
      eventId,
      sessionId,
      adminUserId: admin.id,
      message: error?.message,
      code: error?.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 생성 중 오류가 발생했습니다.",
    });
  }

  await normalizeQuestionOrder(sessionId);
  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "question_created",
    detail: {
      session_id: sessionId,
      question_id: data.id,
      question_text: data.question_text,
      order_index: data.order_index,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId,
    message: "문제를 추가했습니다.",
  });
}

export async function updateQuestion(
  eventId: string,
  sessionId: string,
  questionId: string,
  formData: FormData
) {
  const { admin } = await requireQuestionMutation(eventId);
  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const question = await getQuestionForSession(sessionId, questionId);

  if (!question) {
    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제를 찾을 수 없습니다.",
    });
  }

  const validated = validateQuestionForm(formData);

  if ("error" in validated) {
    redirectToQuestions({ eventId, sessionId, error: validated.error });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("questions")
    .update(validated.values)
    .eq("id", questionId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[admin-questions] Failed to update question.", {
      eventId,
      sessionId,
      questionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "question_updated",
    detail: {
      session_id: sessionId,
      question_id: questionId,
      question_text: validated.values.question_text,
      question_type: validated.values.question_type,
      is_active: validated.values.is_active,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId,
    message: "문제를 저장했습니다.",
  });
}

export async function deleteQuestion(
  eventId: string,
  sessionId: string,
  questionId: string,
  formData: FormData
) {
  const { admin } = await requireQuestionMutation(eventId);
  const confirmed = formData.get("confirm_delete") === "yes";

  if (!confirmed) {
    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 삭제 확인을 체크해 주세요.",
    });
  }

  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const question = await getQuestionForSession(sessionId, questionId);

  if (!question) {
    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제를 찾을 수 없습니다.",
    });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[admin-questions] Failed to delete question.", {
      eventId,
      sessionId,
      questionId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 삭제 중 오류가 발생했습니다.",
    });
  }

  await normalizeQuestionOrder(sessionId);
  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "question_deleted",
    detail: {
      session_id: sessionId,
      question_id: questionId,
      question_text: question.question_text,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId,
    message: "문제를 삭제했습니다.",
  });
}

export async function moveQuestionOrder(
  eventId: string,
  sessionId: string,
  questionId: string,
  direction: "up" | "down",
  _formData: FormData
) {
  void _formData;

  const { admin } = await requireQuestionMutation(eventId);
  const session = await getSessionForEvent(eventId, sessionId);

  if (!session) {
    redirectToQuestions({ eventId, error: "세션을 찾을 수 없습니다." });
  }

  const supabase = createAdminSupabaseClient();
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (questionsError) {
    console.error("[admin-questions] Failed to load questions for move.", {
      eventId,
      sessionId,
      questionId,
      message: questionsError.message,
      code: questionsError.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 순서 변경 중 오류가 발생했습니다.",
    });
  }

  const orderedQuestions = questions ?? [];
  const currentIndex = orderedQuestions.findIndex(
    (question) => question.id === questionId
  );
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= orderedQuestions.length
  ) {
    redirectToQuestions({
      eventId,
      sessionId,
      message: "문제 순서를 변경할 위치가 없습니다.",
    });
  }

  const reordered = [...orderedQuestions];
  const [currentQuestion] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, currentQuestion);

  const results = await Promise.all(
    reordered.map((question, index) =>
      supabase
        .from("questions")
        .update({ order_index: index + 1 })
        .eq("id", question.id)
    )
  );
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error("[admin-questions] Failed to move question order.", {
      eventId,
      sessionId,
      questionId,
      message: failed.error.message,
      code: failed.error.code,
    });

    redirectToQuestions({
      eventId,
      sessionId,
      error: "문제 순서 저장 중 오류가 발생했습니다.",
    });
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "question_reordered",
    detail: {
      session_id: sessionId,
      question_id: questionId,
      direction,
      from_index: currentIndex + 1,
      to_index: targetIndex + 1,
    },
  });

  revalidatePath(`/admin/events/${eventId}/questions`);
  redirectToQuestions({
    eventId,
    sessionId,
    message: "문제 순서를 변경했습니다.",
  });
}
