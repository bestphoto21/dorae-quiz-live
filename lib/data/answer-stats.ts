import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AnswerStats = {
  total_answers: number;
  option_counts: Record<"1" | "2" | "3" | "4", number>;
  correct_answers?: number;
};

export function emptyAnswerStats(): AnswerStats {
  return {
    total_answers: 0,
    option_counts: {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
    },
  };
}

async function countAnswers(
  questionId: string,
  filters: { selectedOption?: number; isCorrect?: boolean } = {}
) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);

  if (filters.selectedOption !== undefined) {
    query = query.eq("selected_option", filters.selectedOption);
  }

  if (filters.isCorrect !== undefined) {
    query = query.eq("is_correct", filters.isCorrect);
  }

  const { count, error } = await query;

  if (error) {
    console.error("[answer-stats] Failed to count answers.", {
      questionId,
      selectedOption: filters.selectedOption,
      isCorrect: filters.isCorrect,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

export async function getAnswerStatsForQuestion(
  questionId: string,
  includeCorrectAnswers = false
): Promise<AnswerStats> {
  const [
    totalAnswers,
    option1Count,
    option2Count,
    option3Count,
    option4Count,
    correctAnswers,
  ] = await Promise.all([
    countAnswers(questionId),
    countAnswers(questionId, { selectedOption: 1 }),
    countAnswers(questionId, { selectedOption: 2 }),
    countAnswers(questionId, { selectedOption: 3 }),
    countAnswers(questionId, { selectedOption: 4 }),
    includeCorrectAnswers
      ? countAnswers(questionId, { isCorrect: true })
      : Promise.resolve(undefined),
  ]);

  return {
    total_answers: totalAnswers,
    option_counts: {
      "1": option1Count,
      "2": option2Count,
      "3": option3Count,
      "4": option4Count,
    },
    ...(includeCorrectAnswers ? { correct_answers: correctAnswers ?? 0 } : {}),
  };
}
