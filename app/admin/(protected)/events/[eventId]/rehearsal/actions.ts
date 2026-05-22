"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEventScopedRole, requireEventAccess } from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ResetTarget =
  | "participants"
  | "quiz_answers"
  | "survey_responses"
  | "qna_questions"
  | "draw_winners"
  | "survey_status"
  | "live_state";

export type ResetRehearsalFormState = {
  message: string | null;
  fieldErrors?: {
    targets?: string;
    confirmation?: string;
  };
  selectedTargets?: ResetTarget[];
  confirmation?: string;
};

const RESET_TARGETS = new Set<ResetTarget>([
  "participants",
  "quiz_answers",
  "survey_responses",
  "qna_questions",
  "draw_winners",
  "survey_status",
  "live_state",
]);

const RESET_TARGET_LABELS: Record<ResetTarget, string> = {
  participants: "참가자 명단",
  quiz_answers: "퀴즈 답변",
  survey_responses: "설문 응답",
  qna_questions: "Q&A 질문",
  draw_winners: "럭키드로우 당첨 기록",
  survey_status: "설문 진행 상태",
  live_state: "스크린 상태",
};

function isResetTarget(value: FormDataEntryValue): value is ResetTarget {
  return typeof value === "string" && RESET_TARGETS.has(value as ResetTarget);
}

function canResetRehearsalData(role: Awaited<ReturnType<typeof getEventScopedRole>>) {
  return role === "super_admin" || role === "event_admin" || role === "operator";
}

function getConfirmation(formData: FormData) {
  const value = formData.get("confirmation");

  return typeof value === "string" ? value.trim() : "";
}

function getSelectedTargets(formData: FormData) {
  return Array.from(new Set(formData.getAll("targets").filter(isResetTarget)));
}

function chunkArray<T>(items: T[], size = 100) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function safeErrorContext(error: { message?: string; code?: string } | null) {
  return {
    message: error?.message,
    code: error?.code,
  };
}

async function deleteSurveySubmissions(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: responses, error: loadError } = await supabase
    .from("survey_responses")
    .select("id")
    .eq("event_id", eventId);

  if (loadError) {
    console.error("[rehearsal-reset] Failed to load survey responses.", {
      eventId,
      ...safeErrorContext(loadError),
    });
    throw new Error("survey_responses_load_failed");
  }

  const responseIds = (responses ?? [])
    .map((response) => response.id)
    .filter((id): id is string => Boolean(id));

  for (const ids of chunkArray(responseIds)) {
    const { error } = await supabase
      .from("survey_answers")
      .delete()
      .in("survey_response_id", ids);

    if (error) {
      console.error("[rehearsal-reset] Failed to delete survey answers.", {
        eventId,
        ...safeErrorContext(error),
      });
      throw new Error("survey_answers_delete_failed");
    }
  }

  const { error: responseDeleteError } = await supabase
    .from("survey_responses")
    .delete()
    .eq("event_id", eventId);

  if (responseDeleteError) {
    console.error("[rehearsal-reset] Failed to delete survey responses.", {
      eventId,
      ...safeErrorContext(responseDeleteError),
    });
    throw new Error("survey_responses_delete_failed");
  }
}

async function deleteEventRows(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from(table).delete().eq("event_id", eventId);

  if (error) {
    console.error("[rehearsal-reset] Failed to delete event rows.", {
      table,
      eventId,
      ...safeErrorContext(error),
    });
    throw new Error(`${table}_delete_failed`);
  }
}

async function resetSurveyForms(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("survey_forms")
    .update({
      status: "draft",
      active_started_at: null,
      active_ends_at: null,
      closed_at: null,
    })
    .eq("event_id", eventId);

  if (error) {
    console.error("[rehearsal-reset] Failed to reset survey forms.", {
      eventId,
      ...safeErrorContext(error),
    });
    throw new Error("survey_forms_reset_failed");
  }
}

async function resetLiveState(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("live_state").upsert(
    {
      event_id: eventId,
      current_session_id: null,
      current_question_id: null,
      mode: "waiting",
      question_started_at: null,
      question_ends_at: null,
      reveal_answer: false,
      show_results: false,
      screen_scene: "waiting",
      screen_payload: {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" }
  );

  if (error) {
    console.error("[rehearsal-reset] Failed to reset live_state.", {
      eventId,
      ...safeErrorContext(error),
    });
    throw new Error("live_state_reset_failed");
  }
}

async function writeResetLog({
  eventId,
  adminUserId,
  selectedTargets,
}: {
  eventId: string;
  adminUserId: string;
  selectedTargets: ResetTarget[];
}) {
  const supabase = createAdminSupabaseClient();
  const resetTargetLabels = selectedTargets.map(
    (target) => RESET_TARGET_LABELS[target]
  );
  const resetLiveState = selectedTargets.includes("live_state");
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: adminUserId,
    action: "reset_rehearsal_data",
    detail: {
      reset_targets: resetTargetLabels,
      reset_target_keys: selectedTargets,
      reset_target_count: selectedTargets.length,
      changed_at: new Date().toISOString(),
      ...(resetLiveState
        ? {
            mode: "waiting",
            screen_scene: "waiting",
          }
        : {}),
    },
  });

  if (error) {
    console.error("[rehearsal-reset] Failed to write reset operation log.", {
      eventId,
      adminUserId,
      ...safeErrorContext(error),
    });
  }
}

function revalidateEventPages(eventId: string) {
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/rehearsal`);
  revalidatePath(`/admin/events/${eventId}/surveys`);
  revalidatePath(`/admin/events/${eventId}/draw`);
  revalidatePath(`/admin/events/${eventId}/qna`);
  revalidatePath(`/admin/events/${eventId}/live`);
  revalidatePath(`/admin/events/${eventId}/logs`);
  revalidatePath(`/admin/events/${eventId}/exports`);
}

export async function resetRehearsalDataAction(
  eventId: string,
  _previousState: ResetRehearsalFormState,
  formData: FormData
): Promise<ResetRehearsalFormState> {
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const selectedTargets = getSelectedTargets(formData);
  const confirmation = getConfirmation(formData);
  const expectedConfirmation = `RESET ${event.event_code}`;
  const fieldErrors: ResetRehearsalFormState["fieldErrors"] = {};

  if (!canResetRehearsalData(role)) {
    return {
      message: "리허설 데이터 초기화 권한이 없습니다.",
      selectedTargets,
      confirmation,
    };
  }

  if (selectedTargets.length === 0) {
    fieldErrors.targets = "초기화할 항목을 하나 이상 선택해주세요.";
  }

  if (confirmation !== expectedConfirmation) {
    fieldErrors.confirmation = `확인 문구를 정확히 입력해주세요: ${expectedConfirmation}`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "초기화 항목과 확인 문구를 다시 확인해주세요.",
      fieldErrors,
      selectedTargets,
      confirmation,
    };
  }

  const shouldDeleteParticipantDependents = selectedTargets.includes("participants");

  try {
    if (
      selectedTargets.includes("survey_responses") ||
      shouldDeleteParticipantDependents
    ) {
      await deleteSurveySubmissions(eventId);
    }

    if (
      selectedTargets.includes("quiz_answers") ||
      shouldDeleteParticipantDependents
    ) {
      await deleteEventRows("answers", eventId);
    }

    if (
      selectedTargets.includes("draw_winners") ||
      shouldDeleteParticipantDependents
    ) {
      await deleteEventRows("draw_winners", eventId);
    }

    if (selectedTargets.includes("qna_questions")) {
      await deleteEventRows("qna_questions", eventId);
    }

    if (selectedTargets.includes("participants")) {
      await deleteEventRows("participants", eventId);
    }

    if (selectedTargets.includes("survey_status")) {
      await resetSurveyForms(eventId);
    }

    if (selectedTargets.includes("live_state")) {
      await resetLiveState(eventId);
    }

    await writeResetLog({
      eventId,
      adminUserId: admin.id,
      selectedTargets,
    });
  } catch (error) {
    const errorInfo =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "UnknownError", message: "Unknown reset error" };

    console.error("[rehearsal-reset] Failed to reset selected data.", {
      eventId,
      targetCount: selectedTargets.length,
      ...errorInfo,
    });

    return {
      message:
        "선택한 리허설 데이터 초기화 중 오류가 발생했습니다. 데이터 상태를 확인한 뒤 다시 시도해주세요.",
      selectedTargets,
      confirmation,
    };
  }

  revalidateEventPages(eventId);
  redirect(
    `/admin/events/${eventId}/rehearsal?message=${encodeURIComponent(
      "선택한 리허설 데이터 초기화가 완료되었습니다."
    )}`
  );
}
