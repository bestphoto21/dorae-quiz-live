import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ScreenStateRouteProps = {
  params: Promise<{ eventCode: string }>;
};

type ScreenEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  venue: string | null;
  primary_color: string | null;
  logo_url: string | null;
  screen_notice: string | null;
  is_active: boolean | null;
};

type ScreenLiveState = {
  mode: "waiting" | "question" | "closed" | "result" | "draw" | "qna";
  screen_scene: string | null;
  current_question_id: string | null;
  question_started_at: string | null;
  question_ends_at: string | null;
  reveal_answer: boolean;
  show_results: boolean;
};

type ScreenQuestionRow = {
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

function toPublicEvent(event: ScreenEvent) {
  return {
    id: event.id,
    event_code: event.event_code,
    title: event.title,
    subtitle: event.subtitle,
    venue: event.venue,
    primary_color: event.primary_color,
    logo_url: event.logo_url,
    screen_notice: event.screen_notice,
  };
}

function defaultLiveState(): Omit<ScreenLiveState, "current_question_id"> {
  return {
    mode: "waiting",
    screen_scene: "waiting",
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
  };
}

export async function GET(_request: Request, { params }: ScreenStateRouteProps) {
  const { eventCode } = await params;
  const supabase = createAdminSupabaseClient();
  const normalizedEventCode = eventCode.trim().toLowerCase();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "id, event_code, title, subtitle, venue, primary_color, logo_url, screen_notice, is_active"
    )
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (eventError) {
    console.error("[screen-state] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: eventError.message,
      code: eventError.code,
    });

    return jsonResponse({ message: "Failed to load event." }, 500);
  }

  if (!event) {
    return jsonResponse({ message: "Event not found." }, 404);
  }

  const screenEvent = event as ScreenEvent;

  if (screenEvent.is_active === false) {
    return jsonResponse({
      event: toPublicEvent(screenEvent),
      liveState: {
        ...defaultLiveState(),
        screen_scene: "inactive",
      },
      question: null,
      stats: EMPTY_STATS,
    });
  }

  const { data: liveStateData, error: liveStateError } = await supabase
    .from("live_state")
    .select(
      "mode, screen_scene, current_question_id, question_started_at, question_ends_at, reveal_answer, show_results"
    )
    .eq("event_id", screenEvent.id)
    .maybeSingle();

  if (liveStateError) {
    console.error("[screen-state] Failed to load live_state.", {
      eventId: screenEvent.id,
      eventCode: normalizedEventCode,
      message: liveStateError.message,
      code: liveStateError.code,
    });

    return jsonResponse({ message: "Failed to load screen state." }, 500);
  }

  const liveState = (liveStateData as ScreenLiveState | null) ?? {
    ...defaultLiveState(),
    current_question_id: null,
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
      console.error("[screen-state] Failed to load current question.", {
        eventId: screenEvent.id,
        questionId: liveState.current_question_id,
        message: questionError.message,
        code: questionError.code,
      });
    }

    if (questionData) {
      const currentQuestion = questionData as ScreenQuestionRow;

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
    event: toPublicEvent(screenEvent),
    liveState: {
      mode: liveState.mode,
      screen_scene: liveState.screen_scene,
      question_started_at: liveState.question_started_at,
      question_ends_at: liveState.question_ends_at,
      reveal_answer: liveState.reveal_answer,
      show_results: liveState.show_results,
    },
    question,
    // TODO: answers 기반 집계가 구현되면 현재 문제의 선택지별 응답 수를
    // 서버에서 계산해 이 객체만 screen-safe 형태로 반환한다.
    stats: EMPTY_STATS,
  });
}
