import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type EventRow = {
  id: string;
  event_code: string;
};

type IdRow = {
  id: string;
};

type ParticipantRow = IdRow & {
  name: string;
};

type QuestionRow = {
  id: string;
  order_index: number;
  correct_option: number;
};

type SeedCounts = {
  adminAssignments: number;
  answers: number;
  participants: number;
  prizes: number;
  qnaQuestions: number;
  questions: number;
  quizSessions: number;
  winners: number;
  logs: number;
};

const DEFAULT_EVENT_CODE = "sim-202606";
const SIMULATION_TITLE = "가상 리허설 행사";
const SIMULATION_SUBTITLE = "Dorae Quiz Live 기능 검증용 가상 리허설 행사";

const questionSeeds = [
  {
    text: "오늘 행사의 첫 번째 퀴즈가 곧 시작됩니다. 테스트용 정답은?",
    options: ["정답 A", "정답 B", "정답 C", "정답 D"],
    correct: 1,
  },
  {
    text: "Dorae Quiz Live의 주요 기능이 아닌 것은?",
    options: ["퀴즈 진행", "Q&A 송출", "럭키드로우", "실제 출입 게이트 제어"],
    correct: 4,
  },
  {
    text: "QR로 참여하기 화면은 어떤 URL로 연결되어야 하나요?",
    options: ["관리자 로그인", "참가자 등록 페이지", "운영 로그", "헬스체크"],
    correct: 2,
  },
  {
    text: "정답 공개 전 참가자 화면에 노출되면 안 되는 것은?",
    options: ["문제", "보기", "남은 시간", "correct_option"],
    correct: 4,
  },
  {
    text: "Q&A 질문은 어떤 절차를 거쳐 스크린에 송출되나요?",
    options: ["제출 즉시 송출", "승인 후 송출", "삭제 후 송출", "로그만 남김"],
    correct: 2,
  },
  {
    text: "럭키드로우 당첨자는 무엇을 기준으로 관리되나요?",
    options: ["참가자와 경품", "스크린 해상도", "관리자 브라우저", "행사장 조명"],
    correct: 1,
  },
  {
    text: "운영 로그의 주된 목적은 무엇인가요?",
    options: ["민감정보 공개", "운영 이력 확인", "정답 자동 변경", "참가자 삭제"],
    correct: 2,
  },
  {
    text: "참가자 등록 후 이동해야 하는 화면은?",
    options: ["참가자 play 화면", "관리자 홈", "DB 콘솔", "배포 설정"],
    correct: 1,
  },
  {
    text: "스크린 송출 화면에서 노출되면 안 되는 정보는?",
    options: ["행사명", "QR 안내", "phone/email/secret", "퀴즈 보기"],
    correct: 3,
  },
  {
    text: "라이브 콘솔에서 운영자가 직접 제어하는 항목은?",
    options: ["응답 마감", "정답 공개", "Q&A 송출", "모두 해당"],
    correct: 4,
  },
];

function requireAllowed() {
  if (process.env.ALLOW_TEST_DATA_SEED !== "true") {
    throw new Error(
      "ALLOW_TEST_DATA_SEED=true 환경변수가 있을 때만 테스트 데이터를 생성합니다."
    );
  }
}

function getSimulationEventCode() {
  const eventCode = (process.env.SIMULATION_EVENT_CODE || DEFAULT_EVENT_CODE)
    .trim()
    .toLowerCase();

  if (!eventCode.startsWith("sim-")) {
    throw new Error("테스트 event_code는 반드시 sim- 접두어로 시작해야 합니다.");
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

async function expectData<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
  label: string
) {
  if (result.error || result.data === null) {
    throw new Error(`${label} 실패: ${result.error?.message ?? "데이터 없음"}`);
  }

  return result.data;
}

async function deleteByEventId(
  supabase: SupabaseClient,
  table: string,
  eventId: string
) {
  const { error } = await supabase.from(table).delete().eq("event_id", eventId);

  if (error) {
    throw new Error(`${table} 테스트 데이터 정리 실패: ${error.message}`);
  }
}

async function resetSimulationChildren(supabase: SupabaseClient, eventId: string) {
  for (const table of [
    "operation_logs",
    "draw_winners",
    "prizes",
    "answers",
    "qna_questions",
    "participants",
    "quiz_sessions",
    "live_state",
  ]) {
    await deleteByEventId(supabase, table, eventId);
  }
}

async function upsertSimulationEvent(
  supabase: SupabaseClient,
  eventCode: string
) {
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

  const existing = await supabase
    .from("events")
    .select("id, event_code")
    .eq("event_code", eventCode)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`테스트 행사 조회 실패: ${existing.error.message}`);
  }

  if (existing.data) {
    const event = existing.data as EventRow;
    const { error } = await supabase
      .from("events")
      .update({
        title: SIMULATION_TITLE,
        subtitle: SIMULATION_SUBTITLE,
        venue: "가상 리허설홀",
        starts_at: startsAt,
        ends_at: endsAt,
        primary_color: "#0a1a38",
        logo_url: null,
        screen_notice: "가상 리허설 테스트 데이터입니다.",
        is_active: true,
      })
      .eq("id", event.id)
      .eq("event_code", eventCode);

    if (error) {
      throw new Error(`테스트 행사 갱신 실패: ${error.message}`);
    }

    return event;
  }

  return await expectData(
    await supabase
      .from("events")
      .insert({
        event_code: eventCode,
        title: SIMULATION_TITLE,
        subtitle: SIMULATION_SUBTITLE,
        venue: "가상 리허설홀",
        starts_at: startsAt,
        ends_at: endsAt,
        primary_color: "#0a1a38",
        logo_url: null,
        screen_notice: "가상 리허설 테스트 데이터입니다.",
        is_active: true,
      })
      .select("id, event_code")
      .single(),
    "테스트 행사 생성"
  ) as EventRow;
}

async function assignExistingAdmins(supabase: SupabaseClient, eventId: string) {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("is_active", true);

  if (error) {
    throw new Error(`관리자 조회 실패: ${error.message}`);
  }

  const rows = ((data ?? []) as IdRow[]).map((admin) => ({
    event_id: eventId,
    admin_user_id: admin.id,
    role: "event_admin",
  }));

  if (rows.length === 0) {
    return 0;
  }

  const { error: upsertError } = await supabase
    .from("event_admins")
    .upsert(rows, { onConflict: "event_id,admin_user_id" });

  if (upsertError) {
    throw new Error(`테스트 행사 관리자 연결 실패: ${upsertError.message}`);
  }

  return rows.length;
}

async function seedLiveState(supabase: SupabaseClient, eventId: string) {
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
    throw new Error(`live_state 초기화 실패: ${error.message}`);
  }
}

async function seedParticipants(supabase: SupabaseClient, eventId: string) {
  const groups = ["테스트그룹A", "테스트그룹B", "테스트그룹C"];
  const rows = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    const suffix = String(number).padStart(2, "0");
    const phoneSuffix = String(number).padStart(4, "0");

    return {
      event_id: eventId,
      name: `테스트참가자${suffix}`,
      display_name: `테스트참가자${suffix}`,
      phone: `010-0000-${phoneSuffix}`,
      phone_normalized: `0100000${phoneSuffix}`,
      consent_privacy: true,
      organization: "테스트조직",
      group_name: groups[index % groups.length],
    };
  });

  const participants = (await expectData(
    await supabase
      .from("participants")
      .insert(rows)
      .select("id, name"),
    "가상 참가자 생성"
  )) as ParticipantRow[];

  return participants
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"))
    .map(({ id }) => ({ id }));
}

async function seedQuestions(supabase: SupabaseClient, eventId: string) {
  const session = (await expectData(
    await supabase
      .from("quiz_sessions")
      .insert({
        event_id: eventId,
        title: "가상 리허설 퀴즈 세션",
        status: "ready",
      })
      .select("id")
      .single(),
    "퀴즈 세션 생성"
  )) as IdRow;

  const questions = questionSeeds.map((question, index) => ({
    session_id: session.id,
    question_text: question.text,
    option_1: question.options[0],
    option_2: question.options[1],
    option_3: question.options[2],
    option_4: question.options[3],
    correct_option: question.correct,
    time_limit_seconds: 20,
    order_index: index + 1,
    is_active: true,
    question_type: "quiz_single",
  }));

  const rows = (await expectData(
    await supabase
      .from("questions")
      .insert(questions)
      .select("id, order_index, correct_option")
      .order("order_index", { ascending: true }),
    "가상 퀴즈 질문 생성"
  )) as QuestionRow[];

  return {
    session,
    questions: rows,
  };
}

async function seedAnswers({
  supabase,
  eventId,
  participants,
  questions,
}: {
  supabase: SupabaseClient;
  eventId: string;
  participants: IdRow[];
  questions: QuestionRow[];
}) {
  const rows = questions.slice(0, 4).flatMap((question, questionIndex) =>
    participants.slice(0, 15).map((participant, participantIndex) => ({
      event_id: eventId,
      question_id: question.id,
      participant_id: participant.id,
      selected_option: ((participantIndex + questionIndex) % 4) + 1,
      response_time_ms: 3200 + participantIndex * 170 + questionIndex * 90,
    }))
  );

  const data = (await expectData(
    await supabase.from("answers").insert(rows).select("id"),
    "가상 답변 생성"
  )) as IdRow[];

  return data.length;
}

async function seedQnaQuestions({
  supabase,
  eventId,
  participants,
}: {
  supabase: SupabaseClient;
  eventId: string;
  participants: IdRow[];
}) {
  const statuses = [
    "approved",
    "pending",
    "approved",
    "approved",
    "hidden",
    "pending",
    "approved",
    "pending",
    "approved",
    "approved",
  ];
  const rows = statuses.map((status, index) => ({
    event_id: eventId,
    participant_id: participants[index]?.id ?? null,
    question_text: `가상 Q&A 질문 ${String(index + 1).padStart(2, "0")} - 리허설 중 확인할 운영 질문입니다.`,
    status,
    is_pinned: index === 0 || index === 6,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  }));

  const data = (await expectData(
    await supabase.from("qna_questions").insert(rows).select("id, status"),
    "가상 Q&A 질문 생성"
  )) as Array<IdRow & { status: string }>;

  return data;
}

async function seedPrizes(supabase: SupabaseClient, eventId: string) {
  const rows = [
    { event_id: eventId, name: "가상 리허설 경품 1등", quantity: 1 },
    { event_id: eventId, name: "가상 리허설 경품 2등", quantity: 1 },
    { event_id: eventId, name: "가상 리허설 경품 3등", quantity: 1 },
  ];

  return (await expectData(
    await supabase.from("prizes").insert(rows).select("id, name"),
    "가상 럭키드로우 상품 생성"
  )) as Array<IdRow & { name: string }>;
}

async function seedDrawWinners({
  supabase,
  eventId,
  participants,
  prizes,
  questions,
}: {
  supabase: SupabaseClient;
  eventId: string;
  participants: IdRow[];
  prizes: IdRow[];
  questions: QuestionRow[];
}) {
  const rows = [
    {
      event_id: eventId,
      prize_id: prizes[0]?.id,
      participant_id: participants[1]?.id,
      source_type: "all_participants",
      source_question_id: null,
      status: "pending",
    },
    {
      event_id: eventId,
      prize_id: prizes[1]?.id,
      participant_id: participants[6]?.id,
      source_type: "correct_answers",
      source_question_id: null,
      status: "pending",
    },
    {
      event_id: eventId,
      prize_id: prizes[2]?.id,
      participant_id: participants[11]?.id,
      source_type: "question_correct_answers",
      source_question_id: questions[0]?.id,
      status: "pending",
    },
  ].filter((row) => row.prize_id && row.participant_id);

  const data = (await expectData(
    await supabase.from("draw_winners").insert(rows).select("id"),
    "가상 당첨자 생성"
  )) as IdRow[];

  return data.length;
}

async function seedOperationLog(
  supabase: SupabaseClient,
  event: EventRow,
  counts: SeedCounts
) {
  const { data, error } = await supabase
    .from("operation_logs")
    .insert({
      event_id: event.id,
      admin_user_id: null,
      action: "simulation_data_seeded",
      detail: {
        event_id: event.id,
        event_code: event.event_code,
        participants: counts.participants,
        quiz_sessions: counts.quizSessions,
        questions: counts.questions,
        answers: counts.answers,
        qna_questions: counts.qnaQuestions,
        prizes: counts.prizes,
        winners: counts.winners,
        admin_assignments: counts.adminAssignments,
        seeded_at: new Date().toISOString(),
      },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`운영 로그 생성 실패: ${error?.message ?? "데이터 없음"}`);
  }

  return 1;
}

function relativeUrl(path: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";

  return siteUrl ? `${siteUrl}${path}` : path;
}

async function main() {
  requireAllowed();

  const eventCode = getSimulationEventCode();
  const supabase = createSupabaseClient();
  const event = await upsertSimulationEvent(supabase, eventCode);

  await resetSimulationChildren(supabase, event.id);
  await seedLiveState(supabase, event.id);

  const adminAssignments = await assignExistingAdmins(supabase, event.id);
  const participants = await seedParticipants(supabase, event.id);
  const { questions } = await seedQuestions(supabase, event.id);
  const answers = await seedAnswers({
    supabase,
    eventId: event.id,
    participants,
    questions,
  });
  const qnaQuestions = await seedQnaQuestions({
    supabase,
    eventId: event.id,
    participants,
  });
  const prizes = await seedPrizes(supabase, event.id);
  const winners = await seedDrawWinners({
    supabase,
    eventId: event.id,
    participants,
    prizes,
    questions,
  });
  const counts: SeedCounts = {
    adminAssignments,
    answers,
    participants: participants.length,
    prizes: prizes.length,
    qnaQuestions: qnaQuestions.length,
    questions: questions.length,
    quizSessions: 1,
    winners,
    logs: 0,
  };
  counts.logs = await seedOperationLog(supabase, event, counts);

  console.log("Simulation data ready.");
  console.log(`event_code: ${event.event_code}`);
  console.log(`event_id: ${event.id}`);
  console.log(`admin: ${relativeUrl(`/admin/events/${event.id}`)}`);
  console.log(`live: ${relativeUrl(`/admin/events/${event.id}/live`)}`);
  console.log(`questions: ${relativeUrl(`/admin/events/${event.id}/questions`)}`);
  console.log(`qna: ${relativeUrl(`/admin/events/${event.id}/qna`)}`);
  console.log(`draw: ${relativeUrl(`/admin/events/${event.id}/draw`)}`);
  console.log(`logs: ${relativeUrl(`/admin/events/${event.id}/logs`)}`);
  console.log(`join: ${relativeUrl(`/e/${event.event_code}/join`)}`);
  console.log(`play: ${relativeUrl(`/e/${event.event_code}/play`)}`);
  console.log(`screen: ${relativeUrl(`/screen/${event.event_code}`)}`);
  console.log(
    `counts: participants=${counts.participants}, questions=${counts.questions}, answers=${counts.answers}, qna=${counts.qnaQuestions}, prizes=${counts.prizes}, winners=${counts.winners}, logs=${counts.logs}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  console.error(`Simulation seed failed: ${message}`);
  process.exit(1);
});
