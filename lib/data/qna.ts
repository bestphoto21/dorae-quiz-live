import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type QnaStatus = "pending" | "approved" | "hidden" | "deleted";

export type QnaQuestionRecord = {
  id: string;
  event_id: string;
  participant_id: string | null;
  question_text: string;
  status: QnaStatus;
  is_pinned: boolean | null;
  created_at: string | null;
  approved_at: string | null;
};

export type QnaQuestionSummary = QnaQuestionRecord & {
  participant_display_name: string;
  organization: string | null;
  group_name: string | null;
};

type ParticipantDisplayRow = {
  id: string;
  name: string;
  display_name: string | null;
  organization: string | null;
  group_name: string | null;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Q&A data helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

export async function getQnaQuestionsForEvent({
  eventId,
  status,
  search,
}: {
  eventId: string;
  status?: QnaStatus | "all";
  search?: string | null;
}): Promise<QnaQuestionSummary[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("qna_questions")
    .select(
      "id, event_id, participant_id, question_text, status, is_pinned, created_at, approved_at"
    )
    .eq("event_id", eventId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    query = query.ilike("question_text", `%${search.trim()}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[qna-data] Failed to load Q&A questions.", {
      eventId,
      status,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  const questions = (data ?? []) as QnaQuestionRecord[];
  const participantIds = Array.from(
    new Set(
      questions
        .map((question) => question.participant_id)
        .filter((participantId): participantId is string => Boolean(participantId))
    )
  );
  const participantMap = await getParticipantDisplayMap(participantIds);

  return questions.map((question) => {
    const participant = question.participant_id
      ? participantMap.get(question.participant_id)
      : null;

    return {
      ...question,
      participant_display_name:
        participant?.display_name?.trim() ||
        participant?.name ||
        "익명 참가자",
      organization: participant?.organization ?? null,
      group_name: participant?.group_name ?? null,
    };
  });
}

async function getParticipantDisplayMap(participantIds: string[]) {
  const map = new Map<string, ParticipantDisplayRow>();

  if (participantIds.length === 0) {
    return map;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, display_name, organization, group_name")
    .in("id", participantIds);

  if (error) {
    console.error("[qna-data] Failed to load participant display info.", {
      message: error.message,
      code: error.code,
    });

    return map;
  }

  (data ?? []).forEach((participant) => {
    map.set(participant.id, participant as ParticipantDisplayRow);
  });

  return map;
}
