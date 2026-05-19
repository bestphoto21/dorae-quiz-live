import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// SERVER ONLY: quiz data is read through the service-role admin client after
// admin/event authorization has been checked by the calling page or action.
// Do not import this module from Client Components.

export type QuizSessionStatus = "draft" | "ready" | "live" | "ended";

export type QuestionType = "quiz_single" | "poll_single" | "poll_multiple" | "ox";

export type QuizSessionRecord = {
  id: string;
  event_id: string;
  title: string;
  status: QuizSessionStatus;
  created_at: string | null;
  updated_at: string | null;
};

export type QuestionRecord = {
  id: string;
  session_id: string;
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: number;
  time_limit_seconds: number;
  order_index: number;
  is_active: boolean | null;
  question_type: QuestionType;
  created_at: string | null;
  updated_at: string | null;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Quiz data helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

export async function getQuizSessionsForEvent(
  eventId: string
): Promise<QuizSessionRecord[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, event_id, title, status, created_at, updated_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[quiz-data] Failed to load quiz sessions.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  return (data ?? []) as QuizSessionRecord[];
}

export async function getQuestionsForSession(
  sessionId: string
): Promise<QuestionRecord[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select(
      `
        id,
        session_id,
        question_text,
        option_1,
        option_2,
        option_3,
        option_4,
        correct_option,
        time_limit_seconds,
        order_index,
        is_active,
        question_type,
        created_at,
        updated_at
      `
    )
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[quiz-data] Failed to load questions.", {
      sessionId,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  return (data ?? []) as QuestionRecord[];
}

export async function getQuestionCountsBySession(eventId: string) {
  assertServerOnly();

  const sessions = await getQuizSessionsForEvent(eventId);
  const sessionIds = sessions.map((session) => session.id);
  const counts = new Map<string, number>();

  sessionIds.forEach((sessionId) => counts.set(sessionId, 0));

  if (sessionIds.length === 0) {
    return counts;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("session_id")
    .in("session_id", sessionIds);

  if (error) {
    console.error("[quiz-data] Failed to load question counts.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return counts;
  }

  (data ?? []).forEach((question) => {
    const sessionId = question.session_id;

    counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
  });

  return counts;
}
