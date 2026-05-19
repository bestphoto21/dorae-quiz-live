"use server";

import { revalidatePath } from "next/cache";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type SubmitAnswerResult = {
  ok: boolean;
  message: string;
};

type EventRow = {
  id: string;
  event_code: string;
  is_active: boolean | null;
};

type LiveStateRow = {
  mode: string;
  current_session_id: string | null;
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
};

type QuestionRow = {
  id: string;
  session_id: string;
  time_limit_seconds: number;
};

function normalizeEventCode(eventCode: string) {
  return eventCode.trim().toLowerCase();
}

function toSelectedOption(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 4) {
    return null;
  }

  return value;
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "23505" ||
    error?.message?.toLowerCase().includes("duplicate key")
  );
}

function hasQuestionEnded(questionEndsAt: string | null, now: Date) {
  if (!questionEndsAt) {
    return true;
  }

  return new Date(questionEndsAt).getTime() <= now.getTime();
}

function calculateResponseTimeMs({
  questionStartedAt,
  now,
  timeLimitSeconds,
}: {
  questionStartedAt: string | null;
  now: Date;
  timeLimitSeconds: number;
}) {
  if (!questionStartedAt) {
    return null;
  }

  const elapsedMs = now.getTime() - new Date(questionStartedAt).getTime();
  const cappedMs = Math.min(
    Math.max(0, elapsedMs),
    Math.max(0, timeLimitSeconds) * 1000
  );

  return Math.round(cappedMs);
}

async function writeAnswerLog({
  eventId,
  questionId,
  participantId,
}: {
  eventId: string;
  questionId: string;
  participantId: string;
}) {
  const supabase = createAdminSupabaseClient();

  // MVP에서는 현장 디버깅과 감사 추적을 위해 응답 제출도 기록한다.
  // 응답량이 커지는 행사에서는 이 로그를 샘플링하거나 별도 분석 테이블로 분리할 수 있다.
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: null,
    action: "answer_submitted",
    detail: {
      event_id: eventId,
      question_id: questionId,
      participant_id: participantId,
    },
  });

  if (error) {
    console.error("[participant-answer] Failed to write operation log.", {
      eventId,
      questionId,
      participantId,
      message: error.message,
      code: error.code,
    });
  }
}

export async function submitAnswer(
  eventCode: string,
  questionId: string,
  selectedOptionValue: number
): Promise<SubmitAnswerResult> {
  const normalizedEventCode = normalizeEventCode(eventCode);
  const selectedOption = toSelectedOption(selectedOptionValue);

  if (!selectedOption) {
    return {
      ok: false,
      message: "선택지는 1번부터 4번까지만 제출할 수 있습니다.",
    };
  }

  const participantSession =
    await readParticipantSessionCookie(normalizedEventCode);

  if (!participantSession) {
    return {
      ok: false,
      message: "참가자 등록 정보를 확인할 수 없습니다. 다시 등록해 주세요.",
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id, event_code, is_active")
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (eventError) {
    console.error("[participant-answer] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: eventError.message,
      code: eventError.code,
    });

    return {
      ok: false,
      message: "행사 정보를 확인하는 중 오류가 발생했습니다.",
    };
  }

  const event = eventData as EventRow | null;

  if (
    !event ||
    event.is_active === false ||
    event.id !== participantSession.event_id
  ) {
    return {
      ok: false,
      message: "현재 응답할 수 없는 행사입니다.",
    };
  }

  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantSession.participant_id)
    .eq("event_id", event.id)
    .maybeSingle();

  if (participantError) {
    console.error("[participant-answer] Failed to load participant.", {
      eventId: event.id,
      participantId: participantSession.participant_id,
      message: participantError.message,
      code: participantError.code,
    });

    return {
      ok: false,
      message: "참가자 정보를 확인하는 중 오류가 발생했습니다.",
    };
  }

  if (!participantData) {
    return {
      ok: false,
      message: "참가자 등록 정보를 찾을 수 없습니다. 다시 등록해 주세요.",
    };
  }

  const { data: liveStateData, error: liveStateError } = await supabase
    .from("live_state")
    .select(
      "mode, current_session_id, current_question_id, question_started_at, question_ends_at"
    )
    .eq("event_id", event.id)
    .maybeSingle();

  if (liveStateError) {
    console.error("[participant-answer] Failed to load live_state.", {
      eventId: event.id,
      message: liveStateError.message,
      code: liveStateError.code,
    });

    return {
      ok: false,
      message: "현재 문제 상태를 확인하는 중 오류가 발생했습니다.",
    };
  }

  const liveState = liveStateData as LiveStateRow | null;

  if (
    !liveState ||
    liveState.mode !== "question" ||
    !liveState.current_session_id ||
    !liveState.current_question_id
  ) {
    return {
      ok: false,
      message: "지금은 응답을 제출할 수 없습니다.",
    };
  }

  if (liveState.current_question_id !== questionId) {
    return {
      ok: false,
      message: "현재 진행 중인 문제가 아닙니다.",
    };
  }

  const now = new Date();

  if (hasQuestionEnded(liveState.question_ends_at, now)) {
    return {
      ok: false,
      message: "응답 시간이 마감되었습니다.",
    };
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("id", liveState.current_session_id)
    .eq("event_id", event.id)
    .maybeSingle();

  if (sessionError) {
    console.error("[participant-answer] Failed to load quiz session.", {
      eventId: event.id,
      sessionId: liveState.current_session_id,
      message: sessionError.message,
      code: sessionError.code,
    });
  }

  if (!sessionData) {
    return {
      ok: false,
      message: "현재 세션 정보를 확인할 수 없습니다.",
    };
  }

  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("id, session_id, time_limit_seconds")
    .eq("id", questionId)
    .eq("session_id", liveState.current_session_id)
    .maybeSingle();

  if (questionError) {
    console.error("[participant-answer] Failed to load question.", {
      eventId: event.id,
      questionId,
      message: questionError.message,
      code: questionError.code,
    });

    return {
      ok: false,
      message: "문제 정보를 확인하는 중 오류가 발생했습니다.",
    };
  }

  const question = questionData as QuestionRow | null;

  if (!question) {
    return {
      ok: false,
      message: "현재 문제를 찾을 수 없습니다.",
    };
  }

  const { data: existingAnswer, error: existingAnswerError } = await supabase
    .from("answers")
    .select("id")
    .eq("participant_id", participantSession.participant_id)
    .eq("question_id", question.id)
    .maybeSingle();

  if (existingAnswerError) {
    console.error("[participant-answer] Failed to check existing answer.", {
      eventId: event.id,
      questionId: question.id,
      participantId: participantSession.participant_id,
      message: existingAnswerError.message,
      code: existingAnswerError.code,
    });

    return {
      ok: false,
      message: "응답 여부를 확인하는 중 오류가 발생했습니다.",
    };
  }

  if (existingAnswer) {
    return {
      ok: false,
      message: "이미 응답한 문제입니다.",
    };
  }

  const responseTimeMs = calculateResponseTimeMs({
    questionStartedAt: liveState.question_started_at,
    now,
    timeLimitSeconds: question.time_limit_seconds,
  });

  const { error: insertError } = await supabase.from("answers").insert({
    event_id: event.id,
    question_id: question.id,
    participant_id: participantSession.participant_id,
    selected_option: selectedOption,
    response_time_ms: responseTimeMs,
  });

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return {
        ok: false,
        message: "이미 응답한 문제입니다.",
      };
    }

    console.error("[participant-answer] Failed to insert answer.", {
      eventId: event.id,
      questionId: question.id,
      participantId: participantSession.participant_id,
      message: insertError.message,
      code: insertError.code,
    });

    return {
      ok: false,
      message: "응답 저장 중 오류가 발생했습니다.",
    };
  }

  await writeAnswerLog({
    eventId: event.id,
    questionId: question.id,
    participantId: participantSession.participant_id,
  });

  revalidatePath(`/e/${event.event_code}/play`);
  revalidatePath(`/screen/${event.event_code}`);
  revalidatePath(`/admin/events/${event.id}/live`);

  return {
    ok: true,
    message: "응답이 제출되었습니다.",
  };
}
