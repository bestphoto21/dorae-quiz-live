import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EventRow = {
  id: string;
  event_code: string;
  title: string;
};

const DEFAULT_EVENT_CODE = "sim-202606";

function getSimulationEventCode() {
  const eventCode = (process.env.SIMULATION_EVENT_CODE || DEFAULT_EVENT_CODE)
    .trim()
    .toLowerCase();

  if (!eventCode.startsWith("sim-")) {
    throw new Error("삭제 대상 event_code는 반드시 sim- 접두어로 시작해야 합니다.");
  }

  return eventCode;
}

function createSupabaseClient() {
  nextEnv.loadEnvConfig(process.cwd());

  const requiredKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`누락된 환경변수: ${missingKeys.join(", ")}`);
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function countByEventId(
  supabase: SupabaseClient,
  table: string,
  eventId: string
) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`${table} count 실패: ${error.message}`);
  }

  return count ?? 0;
}

async function countQuestions(supabase: SupabaseClient, eventId: string) {
  const { data: sessions, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("event_id", eventId);

  if (sessionError) {
    throw new Error(`quiz_sessions 조회 실패: ${sessionError.message}`);
  }

  const sessionIds = ((sessions ?? []) as Array<{ id: string }>).map(
    (session) => session.id
  );

  if (sessionIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds);

  if (error) {
    throw new Error(`questions count 실패: ${error.message}`);
  }

  return count ?? 0;
}

async function getSimulationEvent(
  supabase: SupabaseClient,
  eventCode: string
) {
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, title")
    .eq("event_code", eventCode)
    .maybeSingle();

  if (error) {
    throw new Error(`테스트 행사 조회 실패: ${error.message}`);
  }

  return data as EventRow | null;
}

async function main() {
  const eventCode = getSimulationEventCode();
  const supabase = createSupabaseClient();
  const event = await getSimulationEvent(supabase, eventCode);

  if (!event) {
    console.log(`Simulation event not found: ${eventCode}`);
    return;
  }

  const counts = {
    answers: await countByEventId(supabase, "answers", event.id),
    draw_winners: await countByEventId(supabase, "draw_winners", event.id),
    event_admins: await countByEventId(supabase, "event_admins", event.id),
    live_state: await countByEventId(supabase, "live_state", event.id),
    operation_logs: await countByEventId(supabase, "operation_logs", event.id),
    participants: await countByEventId(supabase, "participants", event.id),
    prizes: await countByEventId(supabase, "prizes", event.id),
    qna_questions: await countByEventId(supabase, "qna_questions", event.id),
    questions: await countQuestions(supabase, event.id),
    quiz_sessions: await countByEventId(supabase, "quiz_sessions", event.id),
  };
  const confirmed = process.env.CONFIRM_CLEAR_SIMULATION_DATA === "true";

  console.log("Simulation clear target:");
  console.log(`event_code: ${event.event_code}`);
  console.log(`event_id: ${event.id}`);
  console.log(`title: ${event.title}`);
  console.log(`dry_run: ${confirmed ? "false" : "true"}`);
  console.log(`counts: ${JSON.stringify(counts)}`);

  if (!confirmed) {
    console.log(
      "Dry run only. Set CONFIRM_CLEAR_SIMULATION_DATA=true to delete this sim event."
    );
    return;
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", event.id)
    .eq("event_code", event.event_code);

  if (error) {
    throw new Error(`시뮬레이션 행사 삭제 실패: ${error.message}`);
  }

  console.log("Simulation event deleted.");
  console.log(`event_code: ${event.event_code}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  console.error(`Simulation clear failed: ${message}`);
  process.exit(1);
});
