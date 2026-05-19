import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ParticipantStateRouteProps = {
  params: Promise<{ eventCode: string }>;
};

type ParticipantEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  is_active: boolean | null;
};

type ParticipantLiveState = {
  mode: "waiting" | "question" | "closed" | "result" | "draw" | "qna";
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
  reveal_answer: boolean;
  show_results: boolean;
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

const EMPTY_STATS = {
  total_answers: 0,
  option_counts: {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
  },
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
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
    .select("id, event_code, title, subtitle, is_active")
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

  if (participantEvent.is_active === false) {
    return jsonResponse({
      event: {
        id: participantEvent.id,
        event_code: participantEvent.event_code,
        title: participantEvent.title,
        subtitle: participantEvent.subtitle,
      },
      liveState: {
        mode: "waiting",
        question_started_at: null,
        question_ends_at: null,
        reveal_answer: false,
        show_results: false,
      },
      question: null,
      stats: EMPTY_STATS,
    });
  }

  const { data: liveStateData, error: liveStateError } = await supabase
    .from("live_state")
    .select(
      "mode, current_question_id, question_started_at, question_ends_at, reveal_answer, show_results"
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

  const liveState = (liveStateData as ParticipantLiveState | null) ?? {
    mode: "waiting",
    current_question_id: null,
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
  };
  let question = null;

  if (liveState.current_question_id) {
    const { data: questionData, error: questionError } = await supabase
      .from("questions")
      .select(
        "id, question_text, option_1, option_2, option_3, option_4, question_type, time_limit_seconds, correct_option"
      )
      .eq("id", liveState.current_question_id)
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
    }
  }

  return jsonResponse({
    event: {
      id: participantEvent.id,
      event_code: participantEvent.event_code,
      title: participantEvent.title,
      subtitle: participantEvent.subtitle,
    },
    liveState: {
      mode: liveState.mode,
      question_started_at: liveState.question_started_at,
      question_ends_at: liveState.question_ends_at,
      reveal_answer: liveState.reveal_answer,
      show_results: liveState.show_results,
    },
    question,
    stats: EMPTY_STATS,
  });
}
