import { NextResponse } from "next/server";
import {
  emptyAnswerStats,
  getAnswerStatsForQuestion,
} from "@/lib/data/answer-stats";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ParticipantStateRouteProps = {
  params: Promise<{ eventCode: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParticipantEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  primary_color: string | null;
  logo_url: string | null;
  screen_notice: string | null;
  is_active: boolean | null;
};

type ParticipantRow = {
  id: string;
  name: string;
  display_name: string | null;
};

type ParticipantLiveState = {
  mode: "waiting" | "question" | "closed" | "result" | "draw" | "qna";
  screen_scene: string | null;
  current_session_id: string | null;
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
  reveal_answer: boolean;
  show_results: boolean;
  updated_at: string | null;
};

type ParticipantQuestionRow = {
  id: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  question_type: string;
  time_limit_seconds: number;
  correct_option: number;
};

type ParticipantAnswerRow = {
  selected_option: number;
  answered_at: string;
  is_correct: boolean;
};

type ParticipantQnaQuestionRow = {
  id: string;
  question_text: string;
  status: "pending" | "approved" | "hidden" | "deleted";
  created_at: string | null;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function defaultLiveState(): ParticipantLiveState {
  return {
    mode: "waiting",
    screen_scene: "waiting",
    current_session_id: null,
    current_question_id: null,
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
    updated_at: null,
  };
}

function toPublicEvent(event: ParticipantEvent) {
  return {
    id: event.id,
    event_code: event.event_code,
    title: event.title,
    subtitle: event.subtitle,
    primary_color: event.primary_color,
    logo_url: event.logo_url,
    screen_notice: event.screen_notice,
  };
}

function hasQuestionEnded(questionEndsAt: string | null) {
  if (!questionEndsAt) {
    return true;
  }

  return new Date(questionEndsAt).getTime() <= Date.now();
}

async function getRecentOwnQnaQuestions({
  eventId,
  participantId,
}: {
  eventId: string;
  participantId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("qna_questions")
    .select("id, question_text, status, created_at")
    .eq("event_id", eventId)
    .eq("participant_id", participantId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("[participant-state] Failed to load own Q&A questions.", {
      eventId,
      participantId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  return (data ?? []) as ParticipantQnaQuestionRow[];
}

export async function GET(
  _request: Request,
  { params }: ParticipantStateRouteProps
) {
  const { eventCode } = await params;
  const normalizedEventCode = eventCode.trim().toLowerCase();
  const supabase = createAdminSupabaseClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, event_code, title, subtitle, primary_color, logo_url, screen_notice, is_active"
    )
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (eventError) {
    console.error("[participant-state] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: eventError.message,
      code: eventError.code,
    });

    return jsonResponse({ message: "Failed to load event." }, 500);
  }

  if (!event) {
    return jsonResponse({ message: "Event not found." }, 404);
  }

  const participantEvent = event as ParticipantEvent;
  const participantSession =
    await readParticipantSessionCookie(normalizedEventCode);

  if (!participantSession || participantSession.event_id !== participantEvent.id) {
    return jsonResponse({ message: "Participant session required." }, 401);
  }

  const { data: participantData, error: participantError } = await supabase
    .from("participants")
    .select("id, name, display_name")
    .eq("id", participantSession.participant_id)
    .eq("event_id", participantEvent.id)
    .maybeSingle();

  if (participantError) {
    console.error("[participant-state] Failed to load participant.", {
      eventId: participantEvent.id,
      participantId: participantSession.participant_id,
      message: participantError.message,
      code: participantError.code,
    });

    return jsonResponse({ message: "Failed to load participant." }, 500);
  }

  if (!participantData) {
    return jsonResponse({ message: "Participant not found." }, 401);
  }

  const participant = participantData as ParticipantRow;
  const qnaQuestions = await getRecentOwnQnaQuestions({
    eventId: participantEvent.id,
    participantId: participant.id,
  });

  if (participantEvent.is_active === false) {
    return jsonResponse({
      event: toPublicEvent(participantEvent),
      participant: {
        display_name: participant.display_name?.trim() || participant.name,
      },
      state_updated_at: null,
      liveState: {
        mode: "waiting",
        screen_scene: "waiting",
        question_started_at: null,
        question_ends_at: null,
        reveal_answer: false,
        show_results: false,
      },
      question: null,
      answer: null,
      qnaQuestions,
      canAnswer: false,
      stats: emptyAnswerStats(),
    });
  }

  const { data: liveStateData, error: liveStateError } = await supabase
    .from("live_state")
    .select(
      "mode, screen_scene, current_session_id, current_question_id, question_started_at, question_ends_at, reveal_answer, show_results, updated_at"
    )
    .eq("event_id", participantEvent.id)
    .maybeSingle();

  if (liveStateError) {
    console.error("[participant-state] Failed to load live_state.", {
      eventId: participantEvent.id,
      message: liveStateError.message,
      code: liveStateError.code,
    });

    return jsonResponse({ message: "Failed to load state." }, 500);
  }

  const liveState = (liveStateData as ParticipantLiveState | null) ??
    defaultLiveState();
  let question = null;
  let answer = null;
  let stats = emptyAnswerStats();

  if (liveState.current_question_id && liveState.current_session_id) {
    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select(
        "id, question_text, option_1, option_2, option_3, option_4, question_type, time_limit_seconds, correct_option"
      )
      .eq("id", liveState.current_question_id)
      .eq("session_id", liveState.current_session_id)
      .maybeSingle();

    if (questionError) {
      console.error("[participant-state] Failed to load question.", {
        eventId: participantEvent.id,
        questionId: liveState.current_question_id,
        message: questionError.message,
        code: questionError.code,
      });
    }

    if (questionData) {
      const currentQuestion = questionData as ParticipantQuestionRow;

      question = {
        id: currentQuestion.id,
        question_text: currentQuestion.question_text,
        option_1: currentQuestion.option_1,
        option_2: currentQuestion.option_2,
        option_3: currentQuestion.option_3,
        option_4: currentQuestion.option_4,
        question_type: currentQuestion.question_type,
        time_limit_seconds: currentQuestion.time_limit_seconds,
        ...(liveState.reveal_answer
          ? { correct_option: currentQuestion.correct_option }
          : {}),
      };

      stats = await getAnswerStatsForQuestion(
        currentQuestion.id,
        liveState.reveal_answer
      );

      const { data: answerData, error: answerError } = await supabase
        .from("answers")
        .select("selected_option, answered_at, is_correct")
        .eq("participant_id", participant.id)
        .eq("question_id", currentQuestion.id)
        .maybeSingle();

      if (answerError) {
        console.error("[participant-state] Failed to load answer.", {
          eventId: participantEvent.id,
          questionId: currentQuestion.id,
          participantId: participant.id,
          message: answerError.message,
          code: answerError.code,
        });
      }

      if (answerData) {
        const currentAnswer = answerData as ParticipantAnswerRow;

        answer = {
          selected_option: currentAnswer.selected_option,
          answered_at: currentAnswer.answered_at,
          // 정오답 여부는 정답 공개 이후에만 참가자에게 보여준다.
          ...(liveState.reveal_answer
            ? { is_correct: currentAnswer.is_correct }
            : {}),
        };
      }
    }
  }

  const canAnswer =
    liveState.mode === "question" &&
    Boolean(question) &&
    !answer &&
    !hasQuestionEnded(liveState.question_ends_at);

  return jsonResponse({
    event: toPublicEvent(participantEvent),
    participant: {
      display_name: participant.display_name?.trim() || participant.name,
    },
    state_updated_at: liveState.updated_at,
    liveState: {
      mode: liveState.mode,
      screen_scene: liveState.screen_scene,
      question_started_at: liveState.question_started_at,
      question_ends_at: liveState.question_ends_at,
      reveal_answer: liveState.reveal_answer,
      show_results: liveState.show_results,
    },
    question,
    answer,
    qnaQuestions,
    canAnswer,
    stats,
  });
}
