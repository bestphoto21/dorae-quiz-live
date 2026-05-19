import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// SERVER ONLY: screen-state builders may use the service-role admin client to
// re-check approved Q&A questions, but this module must never be imported by
// Client Components.

export type SafeDrawPayload = {
  winner_id: string;
  participant_display_name: string;
  display_name: string;
  organization: string | null;
  prize_name: string;
  source_type: string;
  created_at: string | null;
  drawn_at: string | null;
};

export type SafeQnaPayload = {
  qna_question_id: string;
  question_text: string;
  participant_display_name: string;
  organization: string | null;
  group_name: string | null;
  created_at: string | null;
};

export type SafeNoticePayload = {
  title: string | null;
  message: string | null;
};

type QnaQuestionRow = {
  id: string;
  question_text: string;
  participant_id: string | null;
  status: "pending" | "approved" | "hidden" | "deleted";
  created_at: string | null;
};

type QnaParticipantRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Screen safe-state helpers must run on the server only.");
  }
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function pickNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toParticipantDisplayName(participant: QnaParticipantRow | null) {
  return (
    participant?.display_name?.trim() ||
    participant?.name?.trim() ||
    "익명 참가자"
  );
}

export function toSafeNoticePayload(payload: unknown): SafeNoticePayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;

  return {
    title: pickNullableString(source.title),
    message: pickNullableString(source.message),
  };
}

export function toSafeDrawPayload(payload: unknown): SafeDrawPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const winnerId = pickString(source.winner_id);
  const participantDisplayName = pickString(source.participant_display_name);
  const prizeName = pickString(source.prize_name);
  const sourceType = pickString(source.source_type);
  const createdAt = pickString(source.created_at);
  const organization = pickNullableString(source.organization);

  if (!winnerId || !participantDisplayName || !prizeName || !sourceType) {
    return null;
  }

  return {
    winner_id: winnerId,
    participant_display_name: participantDisplayName,
    display_name: participantDisplayName,
    organization,
    prize_name: prizeName,
    source_type: sourceType,
    created_at: createdAt,
    drawn_at: createdAt,
  };
}

export async function getSafeQnaPayload({
  eventId,
  payload,
}: {
  eventId: string;
  payload: unknown;
}): Promise<SafeQnaPayload | null> {
  assertServerOnly();

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

  const qnaQuestion = qnaData as QnaQuestionRow;
  let participant: QnaParticipantRow | null = null;

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

    participant = (participantData as QnaParticipantRow | null) ?? null;
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

export async function buildSafeScreenPayload({
  eventId,
  mode,
  screenScene,
  payload,
}: {
  eventId: string;
  mode: string;
  screenScene: string | null;
  payload: unknown;
}) {
  assertServerOnly();

  const scene = screenScene ?? mode;

  return {
    scene,
    notice:
      scene === "waiting" || scene === "break"
        ? toSafeNoticePayload(payload)
        : null,
    draw:
      mode === "draw" || scene === "draw_winner"
        ? toSafeDrawPayload(payload)
        : null,
    qna:
      mode === "qna" || scene === "qna_question"
        ? await getSafeQnaPayload({ eventId, payload })
        : null,
  };
}
