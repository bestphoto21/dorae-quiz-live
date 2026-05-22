import Link from "next/link";
import { AdminPanel, AdminShell, StatusBadge } from "@/components/quiz/ui";
import { requireEventAccess } from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { cloneEventAction } from "./actions";
import CloneEventForm from "./CloneEventForm";

type CloneEventPageProps = {
  params: Promise<{ eventId: string }>;
};

type ClonePreview = {
  quiz_session_count: number;
  question_count: number;
  survey_form_count: number;
  survey_question_count: number;
  prize_count: number;
};

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[event-clone] Failed to load clone preview count.", {
      table,
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getQuestionCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: sessions, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("event_id", eventId);

  if (sessionError) {
    console.error("[event-clone] Failed to load quiz sessions for preview.", {
      eventId,
      message: sessionError.message,
      code: sessionError.code,
    });

    return 0;
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);

  if (sessionIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds);

  if (error) {
    console.error("[event-clone] Failed to load question preview count.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getSurveyQuestionCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: forms, error: formError } = await supabase
    .from("survey_forms")
    .select("id")
    .eq("event_id", eventId);

  if (formError) {
    console.error("[event-clone] Failed to load survey forms for preview.", {
      eventId,
      message: formError.message,
      code: formError.code,
    });

    return 0;
  }

  const formIds = (forms ?? []).map((form) => form.id);

  if (formIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("survey_questions")
    .select("id", { count: "exact", head: true })
    .in("survey_form_id", formIds);

  if (error) {
    console.error("[event-clone] Failed to load survey question preview count.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getClonePreview(eventId: string): Promise<ClonePreview> {
  const [
    quizSessionCount,
    questionCount,
    surveyFormCount,
    surveyQuestionCount,
    prizeCount,
  ] = await Promise.all([
    getExactCount("quiz_sessions", eventId),
    getQuestionCount(eventId),
    getExactCount("survey_forms", eventId),
    getSurveyQuestionCount(eventId),
    getExactCount("prizes", eventId),
  ]);

  return {
    quiz_session_count: quizSessionCount,
    question_count: questionCount,
    survey_form_count: surveyFormCount,
    survey_question_count: surveyQuestionCount,
    prize_count: prizeCount,
  };
}

function makeDefaultEventCode(eventCode: string) {
  const base = `${eventCode.toLowerCase()}-copy`
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return base || "new-event-copy";
}

function PreviewBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-black text-[color:#0a1a38]">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

export default async function CloneEventPage({ params }: CloneEventPageProps) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId);
  const preview = await getClonePreview(eventId);
  const action = cloneEventAction.bind(null, eventId);

  return (
    <AdminShell
      title="행사 복제"
      description="기존 행사의 설정과 콘텐츠만 복제해서 새 행사를 빠르게 만듭니다."
    >
      <div className="grid gap-5">
        <AdminPanel
          title={event.title}
          description={`원본 행사 코드: ${event.event_code}`}
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="cyan">설정만 복제</StatusBadge>
            <StatusBadge tone="amber">참여/응답/당첨 기록 제외</StatusBadge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <PreviewBadge label="퀴즈 세션" value={preview.quiz_session_count} />
            <PreviewBadge label="퀴즈 문제" value={preview.question_count} />
            <PreviewBadge label="설문지" value={preview.survey_form_count} />
            <PreviewBadge label="설문 질문" value={preview.survey_question_count} />
            <PreviewBadge label="경품" value={preview.prize_count} />
          </div>
        </AdminPanel>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminPanel
            title="복제되는 항목"
            description="새 행사에 설정 데이터로 복사되는 항목입니다."
          >
            <ul className="grid gap-2 text-sm font-bold leading-6 text-slate-700">
              <li>행사 기본 설정: 부제, 장소, 대표 색상, 로고 URL, 스크린 안내 문구</li>
              <li>참가자 화면 제목/설명과 퀴즈, Q&A, 설문, 추첨 안내 ON/OFF 설정</li>
              <li>스크린 화면 제목, 장면별 안내 문구, 푸터 문구, 로고 표시 설정</li>
              <li>퀴즈 세션과 문제, 선택지, 정답, 제한 시간</li>
              <li>설문지와 설문 질문, 선택지, 필수 여부, 순서</li>
              <li>경품명과 수량</li>
              <li>새 행사의 대기 상태 live_state</li>
            </ul>
          </AdminPanel>

          <AdminPanel
            title="복제되지 않는 항목"
            description="운영 데이터와 개인정보는 새 행사로 복사하지 않습니다."
          >
            <ul className="grid gap-2 text-sm font-bold leading-6 text-slate-700">
              <li>참가자 명단과 참가자 세션/쿠키</li>
              <li>퀴즈 답변, 설문 응답, 설문 답변</li>
              <li>Q&A 실제 제출 질문</li>
              <li>럭키드로우 당첨자 기록</li>
              <li>운영 로그와 현재 스크린 상태, 원본 screen payload</li>
              <li>전화번호, 이메일, 내부 참가자 ID 같은 개인정보</li>
            </ul>
          </AdminPanel>
        </div>

        <AdminPanel
          title="새 행사 정보"
          description="행사명과 행사 코드는 새로 입력합니다. 일정은 실수 방지를 위해 비워진 상태로 생성됩니다."
        >
          <CloneEventForm
            eventId={eventId}
            defaultTitle={`${event.title} 복제본`}
            defaultEventCode={makeDefaultEventCode(event.event_code)}
            action={action}
          />
        </AdminPanel>

        <div>
          <Link
            href={`/admin/events/${eventId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm"
          >
            원본 행사로 돌아가기
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
