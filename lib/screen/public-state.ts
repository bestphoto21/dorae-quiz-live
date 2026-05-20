import {
  emptyAnswerStats,
  getAnswerStatsForQuestion,
} from "@/lib/data/answer-stats";
import { buildSafeScreenPayload } from "@/lib/screen/safe-state";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
  screen_payload: unknown;
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

export type PublicScreenState = {
  event: ReturnType<typeof toPublicEvent>;
  liveState: {
    mode: ScreenLiveState["mode"];
    screen_scene: string | null;
    question_started_at: string | null;
    question_ends_at: string | null;
    reveal_answer: boolean;
    show_results: boolean;
  };
  question: {
    id: string;
    question_text: string;
    option_1: string;
    option_2: string;
    option_3: string;
    option_4: string;
    question_type: string;
    time_limit_seconds: number;
    correct_option?: number;
  } | null;
  draw: Awaited<ReturnType<typeof buildSafeScreenPayload>>["draw"];
  qna: Awaited<ReturnType<typeof buildSafeScreenPayload>>["qna"];
  notice: Awaited<ReturnType<typeof buildSafeScreenPayload>>["notice"];
  joinQr: Awaited<ReturnType<typeof buildSafeScreenPayload>>["joinQr"];
  stats: ReturnType<typeof emptyAnswerStats>;
};

type PublicScreenStateResult =
  | { status: 200; body: PublicScreenState }
  | { status: 404 | 500; body: { message: string } };

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
    screen_payload: {},
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
  };
}

export async function getPublicScreenState(
  eventCode: string
): Promise<PublicScreenStateResult> {
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

    return { status: 500, body: { message: "Failed to load event." } };
  }

  if (!event) {
    return { status: 404, body: { message: "Event not found." } };
  }

  const screenEvent = event as ScreenEvent;

  if (screenEvent.is_active === false) {
    return {
      status: 200,
      body: {
        event: toPublicEvent(screenEvent),
        liveState: {
          ...defaultLiveState(),
          screen_scene: "inactive",
        },
        question: null,
        draw: null,
        qna: null,
        notice: null,
        joinQr: null,
        stats: emptyAnswerStats(),
      },
    };
  }

  const { data: liveStateData, error: liveStateError } = await supabase
    .from("live_state")
    .select(
      "mode, screen_scene, screen_payload, current_question_id, question_started_at, question_ends_at, reveal_answer, show_results"
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

    return { status: 500, body: { message: "Failed to load screen state." } };
  }

  const liveState = (liveStateData as ScreenLiveState | null) ?? {
    ...defaultLiveState(),
    current_question_id: null,
  };
  const safePayload = await buildSafeScreenPayload({
    eventId: screenEvent.id,
    mode: liveState.mode,
    screenScene: liveState.screen_scene,
    payload: liveState.screen_payload,
  });
  let question = null;
  let stats = emptyAnswerStats();

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
      stats = await getAnswerStatsForQuestion(
        currentQuestion.id,
        liveState.reveal_answer
      );
    }
  }

  return {
    status: 200,
    body: {
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
      draw: safePayload.draw,
      qna: safePayload.qna,
      notice: safePayload.notice,
      joinQr: safePayload.joinQr,
      stats,
    },
  };
}
