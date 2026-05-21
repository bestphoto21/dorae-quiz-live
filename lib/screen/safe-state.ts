import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// SERVER ONLY: screen-state builders may use the service-role admin client to
// re-check approved Q&A questions, but this module must never be imported by
// Client Components.

export type SafeDrawPayload = {
  winner_id: string;
  animation_id: string;
  participant_display_name: string;
  display_name: string;
  winner_name: string;
  organization: string | null;
  prize_name: string;
  prize_title: string;
  source_type: string;
  draw_phase: "ready" | "rolling" | "result";
  candidate_names: string[];
  message: string | null;
  duration_ms: number;
  countdown_seconds: number;
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

export type SafeJoinQrPayload = {
  event_code: string;
  join_url: string;
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

type DrawWinnerRow = {
  id: string;
  prize_id: string | null;
  participant_id: string;
  source_type: string;
  created_at: string | null;
};

type DrawParticipantRow = {
  name: string;
  display_name: string | null;
};

type DrawPrizeRow = {
  name: string;
};

type DrawWinnerSnapshot = {
  displayName: string | null;
  prizeName: string | null;
  sourceType: string | null;
  createdAt: string | null;
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

function pickStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickDrawPhase(value: unknown): SafeDrawPayload["draw_phase"] {
  return value === "ready" || value === "rolling" || value === "result"
    ? value
    : "result";
}

function pickBoundedNumber({
  value,
  fallback,
  min,
  max,
}: {
  value: unknown;
  fallback: number;
  min: number;
  max: number;
}) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function toParticipantDisplayName(participant: QnaParticipantRow | null) {
  return (
    participant?.display_name?.trim() ||
    participant?.name?.trim() ||
    "익명 참가자"
  );
}

function fallbackRollingNames(winnerName: string) {
  return [
    "참가자 후보 01",
    "참가자 후보 02",
    "참가자 후보 03",
    winnerName,
    "참가자 후보 04",
    "참가자 후보 05",
  ];
}

async function getDrawWinnerSnapshot({
  eventId,
  winnerId,
}: {
  eventId: string;
  winnerId: string;
}): Promise<DrawWinnerSnapshot | null> {
  const supabase = createAdminSupabaseClient();
  const { data: winnerData, error: winnerError } = await supabase
    .from("draw_winners")
    .select("id, prize_id, participant_id, source_type, created_at")
    .eq("id", winnerId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (winnerError) {
    console.error("[screen-state] Failed to load draw winner.", {
      eventId,
      winnerId,
      message: winnerError.message,
      code: winnerError.code,
    });

    return null;
  }

  if (!winnerData) {
    return null;
  }

  const winner = winnerData as DrawWinnerRow;
  const [participantResult, prizeResult] = await Promise.all([
    supabase
      .from("participants")
      .select("name, display_name")
      .eq("id", winner.participant_id)
      .eq("event_id", eventId)
      .maybeSingle(),
    winner.prize_id
      ? supabase.from("prizes").select("name").eq("id", winner.prize_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (participantResult.error) {
    console.error("[screen-state] Failed to load draw winner display name.", {
      eventId,
      winnerId,
      message: participantResult.error.message,
      code: participantResult.error.code,
    });
  }

  if (prizeResult.error) {
    console.error("[screen-state] Failed to load draw prize name.", {
      eventId,
      winnerId,
      message: prizeResult.error.message,
      code: prizeResult.error.code,
    });
  }

  const participant = participantResult.data as DrawParticipantRow | null;
  const prize = prizeResult.data as DrawPrizeRow | null;

  return {
    displayName: participant?.display_name?.trim() || participant?.name?.trim() || null,
    prizeName: prize?.name?.trim() || null,
    sourceType: winner.source_type,
    createdAt: winner.created_at,
  };
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

export function toSafeJoinQrPayload(payload: unknown): SafeJoinQrPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const eventCode = pickString(source.event_code);
  const joinUrl = pickString(source.join_url);

  if (!eventCode || !joinUrl) {
    return null;
  }

  return {
    event_code: eventCode,
    join_url: joinUrl,
    title: pickNullableString(source.title),
    message: pickNullableString(source.message),
  };
}

export async function getSafeDrawPayload({
  eventId,
  payload,
}: {
  eventId: string;
  payload: unknown;
}): Promise<SafeDrawPayload | null> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const winnerId = pickString(source.winner_id);

  if (!winnerId) {
    return null;
  }

  const snapshot = await getDrawWinnerSnapshot({ eventId, winnerId });
  const participantDisplayName =
    pickString(source.participant_display_name) ??
    pickString(source.winner_name) ??
    snapshot?.displayName;
  const prizeName =
    pickString(source.prize_name) ?? pickString(source.prize_title) ?? snapshot?.prizeName;
  const sourceType = pickString(source.source_type) ?? snapshot?.sourceType;
  const createdAt = pickString(source.created_at) ?? snapshot?.createdAt ?? null;
  const organization = pickNullableString(source.organization);
  const drawPhase = pickDrawPhase(source.draw_phase);
  const candidateNames = Array.from(
    new Set([
      ...pickStringArray(source.candidate_names),
      participantDisplayName,
    ].filter((name): name is string => Boolean(name)))
  ).slice(0, 30);

  if (!participantDisplayName || !prizeName || !sourceType) {
    return null;
  }

  const safeCandidateNames =
    drawPhase === "rolling" && candidateNames.length < 2
      ? fallbackRollingNames(participantDisplayName)
      : candidateNames.length > 0
        ? candidateNames
        : [participantDisplayName];

  return {
    winner_id: winnerId,
    animation_id:
      pickString(source.animation_id) ??
      `${winnerId}-${createdAt ?? "draw"}`,
    participant_display_name: participantDisplayName,
    display_name: participantDisplayName,
    winner_name: participantDisplayName,
    organization,
    prize_name: prizeName,
    prize_title: prizeName,
    source_type: sourceType,
    draw_phase: drawPhase,
    candidate_names: safeCandidateNames,
    message: pickNullableString(source.message),
    duration_ms: pickBoundedNumber({
      value: source.duration_ms,
      fallback: 7000,
      min: 3000,
      max: 10000,
    }),
    countdown_seconds: pickBoundedNumber({
      value: source.countdown_seconds,
      fallback: 3,
      min: 1,
      max: 5,
    }),
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
        ? await getSafeDrawPayload({ eventId, payload })
        : null,
    qna:
      mode === "qna" || scene === "qna_question"
        ? await getSafeQnaPayload({ eventId, payload })
        : null,
    joinQr: scene === "join_qr" ? toSafeJoinQrPayload(payload) : null,
  };
}
