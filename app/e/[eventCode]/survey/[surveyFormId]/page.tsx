import Link from "next/link";
import { redirect } from "next/navigation";
import { AudienceHero, MobileCard, StatusBadge } from "@/components/quiz/ui";
import {
  autoCloseExpiredSurveyForm,
  isSurveyAcceptingResponses,
  normalizeSurveyQuestion,
  type SurveyQuestionRecord,
} from "@/lib/data/surveys";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { submitSurveyResponse } from "../actions";
import { SurveySubmitButton } from "./SurveySubmitButton";

type SurveyDetailPageProps = {
  params: Promise<{ eventCode: string; surveyFormId: string }>;
  searchParams: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

type SurveyEvent = {
  id: string;
  event_code: string;
  title: string;
  is_active: boolean | null;
};

type SurveyForm = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  active_started_at: string | null;
  active_ends_at: string | null;
  closed_at: string | null;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getEvent(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, title, is_active")
    .eq("event_code", eventCode.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[participant-survey-detail] Failed to load event.", {
      eventCode,
      message: error.message,
      code: error.code,
    });
  }

  return data as SurveyEvent | null;
}

async function getParticipantExists(participantId: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[participant-survey-detail] Failed to load participant.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return Boolean(data);
}

async function getSurveyDetail({
  eventId,
  surveyFormId,
}: {
  eventId: string;
  surveyFormId: string;
}) {
  await autoCloseExpiredSurveyForm({ eventId, surveyFormId });

  const supabase = createAdminSupabaseClient();
  const [{ data: formData, error: formError }, { data: questionData, error: questionError }] =
    await Promise.all([
      supabase
        .from("survey_forms")
        .select(
          "id, event_id, title, description, status, active_started_at, active_ends_at, closed_at"
        )
        .eq("id", surveyFormId)
        .eq("event_id", eventId)
        .maybeSingle(),
      supabase
        .from("survey_questions")
        .select(
          "id, survey_form_id, question_text, question_type, options, is_required, sort_order, created_at, updated_at"
        )
        .eq("survey_form_id", surveyFormId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  if (formError) {
    console.error("[participant-survey-detail] Failed to load survey form.", {
      eventId,
      surveyFormId,
      message: formError.message,
      code: formError.code,
    });
  }

  if (questionError) {
    console.error("[participant-survey-detail] Failed to load survey questions.", {
      eventId,
      surveyFormId,
      message: questionError.message,
      code: questionError.code,
    });
  }

  return {
    form: formData as SurveyForm | null,
    questions: (questionData ?? []).map(normalizeSurveyQuestion),
  };
}

async function getExistingResponse({
  surveyFormId,
  participantId,
}: {
  surveyFormId: string;
  participantId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, submitted_at")
    .eq("survey_form_id", surveyFormId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) {
    console.error("[participant-survey-detail] Failed to load response.", {
      surveyFormId,
      message: error.message,
      code: error.code,
    });
  }

  return data as { id: string; submitted_at: string | null } | null;
}

function QuestionInput({ question }: { question: SurveyQuestionRecord }) {
  const name = `answer_${question.id}`;

  if (question.question_type === "short_text") {
    return (
      <input
        name={name}
        type="text"
        required={question.is_required}
        placeholder="답변을 입력해 주세요"
        className="mt-3 min-h-12 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
      />
    );
  }

  if (question.question_type === "long_text") {
    return (
      <textarea
        name={name}
        rows={5}
        required={question.is_required}
        placeholder="답변을 입력해 주세요"
        className="mt-3 w-full resize-y rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold leading-7 text-[color:#0a1a38] shadow-sm outline-none placeholder:text-slate-500 focus:border-[#0a1a38]"
      />
    );
  }

  if (question.question_type === "single_choice") {
    return (
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => (
          <label
            key={option}
            className="block cursor-pointer"
          >
            <input
              type="radio"
              name={name}
              value={option}
              required={question.is_required}
              className="peer sr-only"
            />
            <span className="flex min-h-12 items-center rounded-2xl border border-slate-300 bg-white p-4 text-base font-black text-[color:#0a1a38] shadow-sm transition peer-checked:border-[#0a1a38] peer-checked:bg-[#0a1a38] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300">
              {option}
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (question.question_type === "multiple_choice") {
    return (
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => (
          <label
            key={option}
            className="block cursor-pointer"
          >
            <input
              type="checkbox"
              name={name}
              value={option}
              className="peer sr-only"
            />
            <span className="flex min-h-12 items-center rounded-2xl border border-slate-300 bg-white p-4 text-base font-black text-[color:#0a1a38] shadow-sm transition peer-checked:border-[#0a1a38] peer-checked:bg-[#0a1a38] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300">
              {option}
            </span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((score) => (
        <label
          key={score}
          className="block cursor-pointer"
        >
          <input
            type="radio"
            name={name}
            value={score}
            required={question.is_required}
            className="peer sr-only"
          />
          <span className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-xl font-black text-[color:#0a1a38] shadow-sm transition peer-checked:border-[#0a1a38] peer-checked:bg-[#0a1a38] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300">
            {score}
          </span>
        </label>
      ))}
    </div>
  );
}

function SurveyQuestionCard({ question }: { question: SurveyQuestionRecord }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-black leading-7 text-[color:#0a1a38]">
          {question.question_text}
        </h2>
        <StatusBadge tone={question.is_required ? "cyan" : "slate"}>
          {question.is_required ? "필수" : "선택"}
        </StatusBadge>
      </div>
      <QuestionInput question={question} />
    </section>
  );
}

export default async function SurveyDetailPage({
  params,
  searchParams,
}: SurveyDetailPageProps) {
  const { eventCode, surveyFormId } = await params;
  const query = await searchParams;
  const normalizedEventCode = eventCode.trim().toLowerCase();
  const session = await readParticipantSessionCookie(normalizedEventCode);

  if (!session) {
    redirect(`/e/${normalizedEventCode}/join`);
  }

  const event = await getEvent(normalizedEventCode);

  if (!event || event.id !== session.event_id) {
    redirect(`/e/${normalizedEventCode}/join`);
  }

  const participantExists = await getParticipantExists(
    session.participant_id,
    event.id
  );

  if (!participantExists) {
    redirect(`/e/${event.event_code}/join`);
  }

  const [{ form, questions }, existingResponse] = await Promise.all([
    getSurveyDetail({ eventId: event.id, surveyFormId }),
    getExistingResponse({
      surveyFormId,
      participantId: session.participant_id,
    }),
  ]);
  const message = getSingle(query.message);
  const error = getSingle(query.error);

  if (!form || !isSurveyAcceptingResponses(form) || event.is_active === false) {
    return (
      <div className="grid gap-5">
        <AudienceHero
          label="설문"
          title="현재 제출할 수 없는 설문입니다"
          description="설문이 마감되었거나 아직 응답 가능 상태가 아닙니다."
        >
          <Link
            href={`/e/${event.event_code}/survey`}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm"
          >
            설문 목록으로 이동
          </Link>
        </AudienceHero>
      </div>
    );
  }

  if (existingResponse) {
    return (
      <div className="grid gap-5">
        <AudienceHero
          label="제출 완료"
          title="이미 제출한 설문입니다"
          description="같은 설문은 한 번만 제출할 수 있습니다. 참여해 주셔서 감사합니다."
        >
          <Link
            href={`/e/${event.event_code}/survey`}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm"
          >
            설문 목록으로 이동
          </Link>
        </AudienceHero>
      </div>
    );
  }

  const submitAction = submitSurveyResponse.bind(
    null,
    event.event_code,
    form.id
  );

  return (
    <div className="grid gap-5">
      <AudienceHero
        label="설문 작성"
        title={form.title}
        description={form.description ?? "질문을 확인하고 설문을 제출해 주세요."}
      >
        <Link
          href={`/e/${event.event_code}/survey`}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm"
        >
          설문 목록
        </Link>
      </AudienceHero>

      {(message || error) && (
        <MobileCard>
          {message && (
            <p className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">
              {error}
            </p>
          )}
        </MobileCard>
      )}

      <MobileCard>
        {questions.length > 0 ? (
          <form action={submitAction} className="grid gap-4">
            {questions.map((question) => (
              <SurveyQuestionCard key={question.id} question={question} />
            ))}
            <SurveySubmitButton endsAt={form.active_ends_at} />
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-950">
            아직 질문이 없는 설문입니다.
          </div>
        )}
      </MobileCard>
    </div>
  );
}
