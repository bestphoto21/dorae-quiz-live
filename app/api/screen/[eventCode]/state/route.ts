import { NextResponse } from "next/server";
import {
  emptyAnswerStats,
  getAnswerStatsForQuestion,
} from "@/lib/data/answer-stats";
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

type ScreenQnaQuestionRow = {
  id: string;
  question_text: string;
  participant_id: string | null;
  status: "pending" | "approved" | "hidden" | "deleted";
  created_at: string | null;
};

type ScreenQnaParticipantRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
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
    screen_payload: {},
    question_started_at: null,
    question_ends_at: null,
    reveal_answer: false,
    show_results: false,
  };
}

function toParticipantDisplayName(participant: ScreenQnaParticipantRow | null) {
  return (
    participant?.display_name?.trim() ||
    participant?.name?.trim() ||
    "익명 참가자"
  );
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toSafeDrawPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const winnerId = pickString(source.winner_id);
  const participantDisplayName = pickString(source.participant_display_name);
  const prizeName = pickString(source.prize_name);
  const sourceType = pickString(source.source_type);
  const createdAt = pickString(source.created_at);

  if (!winnerId || !participantDisplayName || !prizeName || !sourceType) {
    return null;
  }

  return {
    winner_id: winnerId,
    participant_display_name: participantDisplayName,
    prize_name: prizeName,
    source_type: sourceType,
    created_at: createdAt,
  };
}

async function getSafeQnaPayload({
  eventId,
  payload,
}: {
  eventId: string;
  payload: unknown;
}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const qnaQuestionId = pickString(source.qna_question_id);

  if (!qnaQuestionId) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data: qnaData, error: qnaError } = await supabase
    .from("qna_questions")
    .select("id, question_text, participant_id, status, created_at")
    .eq("id", qnaQuestionId)
    .eq("event_id", eventId)
    .eq("status", "approved")
    .maybeSingle();

  if (qnaError) {
    console.error("[screen-state] Failed to load approved Q&A question.", {
      eventId,
      qnaQuestionId,
      message: qnaError.message,
      code: qnaError.code,
    });

    return null;
  }

  if (!qnaData) {
    return null;
  }

  const qnaQuestion = qnaData as ScreenQnaQuestionRow;
  let participant: ScreenQnaParticipantRow | null = null;

  if (qnaQuestion.participant_id) {
    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("id, name, display_name, organization, group_name")
      .eq("id", qnaQuestion.participant_id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (participantError) {
      console.error("[screen-state] Failed to load Q&A participant display.", {
        eventId,
        qnaQuestionId,
        message: participantError.message,
        code: participantError.code,
      });
    }

    participant = (participantData as ScreenQnaParticipantRow | null) ?? null;
  }

  return {
    qna_question_id: qnaQuestion.id,
    question_text: qnaQuestion.question_text,
    participant_display_name: toParticipantDisplayName(participant),
    organization: participant?.organization ?? null,
    group_name: participant?.group_name ?? null,
    created_at: qnaQuestion.created_at,
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
      draw: null,
      qna: null,
      stats: emptyAnswerStats(),
    });
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

    return jsonResponse({ message: "Failed to load screen state." }, 500);
  }

  const liveState = (liveStateData as ScreenLiveState | null) ?? {
    ...defaultLiveState(),
    current_question_id: null,
  };
  let question = null;
  let stats = emptyAnswerStats();
  const qna =
    liveState.mode === "qna" || liveState.screen_scene === "qna_question"
      ? await getSafeQnaPayload({
          eventId: screenEvent.id,
          payload: liveState.screen_payload,
        })
      : null;

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
    draw:
      liveState.mode === "draw" || liveState.screen_scene === "draw_winner"
        ? toSafeDrawPayload(liveState.screen_payload)
        : null,
    qna,
    // correct_answers is omitted before reveal_answer to avoid leaking the key.
    stats,
  });
}
