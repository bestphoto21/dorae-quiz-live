import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PrizeRecord = {
  id: string;
  event_id: string;
  name: string;
  quantity: number;
  created_at: string | null;
};

export type PrizeSummary = PrizeRecord & {
  winner_count: number;
  active_winner_count: number;
  remaining: number;
};

export type DrawWinnerStatus = "pending" | "claimed" | "cancelled" | "redrawn";

export type DrawWinnerRecord = {
  id: string;
  event_id: string;
  prize_id: string | null;
  participant_id: string;
  source_type:
    | "all_participants"
    | "correct_answers"
    | "question_correct_answers"
    | "survey_respondents";
  source_question_id: string | null;
  survey_form_id: string | null;
  status: DrawWinnerStatus;
  created_at: string | null;
  claimed_at: string | null;
};

export type DrawWinnerSummary = DrawWinnerRecord & {
  prize_name: string;
  participant_display_name: string;
  source_question_text: string | null;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Draw data helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

export async function getPrizesForEvent(eventId: string): Promise<PrizeSummary[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const [{ data: prizes, error: prizeError }, { data: winners, error: winnerError }] =
    await Promise.all([
      supabase
        .from("prizes")
        .select("id, event_id, name, quantity, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase
        .from("draw_winners")
        .select("id, prize_id, status")
        .eq("event_id", eventId),
    ]);

  if (prizeError) {
    console.error("[draw-data] Failed to load prizes.", {
      eventId,
      message: prizeError.message,
      code: prizeError.code,
    });

    return [];
  }

  if (winnerError) {
    console.error("[draw-data] Failed to load prize winner counts.", {
      eventId,
      message: winnerError.message,
      code: winnerError.code,
    });
  }

  const winnerCounts = new Map<string, number>();
  const activeWinnerCounts = new Map<string, number>();

  (winners ?? []).forEach((winner) => {
    if (!winner.prize_id) {
      return;
    }

    winnerCounts.set(winner.prize_id, (winnerCounts.get(winner.prize_id) ?? 0) + 1);

    if (winner.status === "pending" || winner.status === "claimed") {
      activeWinnerCounts.set(
        winner.prize_id,
        (activeWinnerCounts.get(winner.prize_id) ?? 0) + 1
      );
    }
  });

  return ((prizes ?? []) as PrizeRecord[]).map((prize) => {
    const activeWinnerCount = activeWinnerCounts.get(prize.id) ?? 0;

    return {
      ...prize,
      winner_count: winnerCounts.get(prize.id) ?? 0,
      active_winner_count: activeWinnerCount,
      remaining: Math.max(0, prize.quantity - activeWinnerCount),
    };
  });
}

export async function getDrawWinnersForEvent(
  eventId: string
): Promise<DrawWinnerSummary[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const { data: winners, error } = await supabase
    .from("draw_winners")
    .select(
      "id, event_id, prize_id, participant_id, source_type, source_question_id, survey_form_id, status, created_at, claimed_at"
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[draw-data] Failed to load draw winners.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  const winnerRows = (winners ?? []) as DrawWinnerRecord[];
  const prizeIds = Array.from(
    new Set(winnerRows.map((winner) => winner.prize_id).filter(Boolean))
  ) as string[];
  const participantIds = Array.from(
    new Set(winnerRows.map((winner) => winner.participant_id))
  );
  const questionIds = Array.from(
    new Set(winnerRows.map((winner) => winner.source_question_id).filter(Boolean))
  ) as string[];

  const [prizeMap, participantMap, questionMap] = await Promise.all([
    getPrizeNameMap(prizeIds),
    getParticipantNameMap(participantIds),
    getQuestionTextMap(questionIds),
  ]);

  return winnerRows.map((winner) => ({
    ...winner,
    prize_name: winner.prize_id
      ? prizeMap.get(winner.prize_id) ?? "삭제된 경품"
      : "경품 없음",
    participant_display_name:
      participantMap.get(winner.participant_id) ?? "이름 미확인",
    source_question_text: winner.source_question_id
      ? questionMap.get(winner.source_question_id) ?? "문제 미확인"
      : null,
  }));
}

async function getPrizeNameMap(prizeIds: string[]) {
  const map = new Map<string, string>();

  if (prizeIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("prizes")
    .select("id, name")
    .in("id", prizeIds);

  if (error) {
    console.error("[draw-data] Failed to load prize names.", {
      message: error.message,
      code: error.code,
    });

    return map;
  }

  (data ?? []).forEach((prize) => map.set(prize.id, prize.name));

  return map;
}

async function getParticipantNameMap(participantIds: string[]) {
  const map = new Map<string, string>();

  if (participantIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, display_name")
    .in("id", participantIds);

  if (error) {
    console.error("[draw-data] Failed to load participant display names.", {
      message: error.message,
      code: error.code,
    });

    return map;
  }

  (data ?? []).forEach((participant) => {
    map.set(
      participant.id,
      participant.display_name?.trim() || participant.name || "이름 미확인"
    );
  });

  return map;
}

async function getQuestionTextMap(questionIds: string[]) {
  const map = new Map<string, string>();

  if (questionIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, question_text")
    .in("id", questionIds);

  if (error) {
    console.error("[draw-data] Failed to load question texts.", {
      message: error.message,
      code: error.code,
    });

    return map;
  }

  (data ?? []).forEach((question) => {
    map.set(question.id, question.question_text);
  });

  return map;
}
