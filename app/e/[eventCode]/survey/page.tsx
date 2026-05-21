import Link from "next/link";
import { redirect } from "next/navigation";
import { AudienceHero, MobileCard, PrimaryLink, StatusBadge } from "@/components/quiz/ui";
import {
  getOpenSurveyFormsForParticipant,
  getSurveyRemainingSeconds,
} from "@/lib/data/surveys";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SurveyListPageProps = {
  params: Promise<{ eventCode: string }>;
  searchParams: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

type SurveyEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  is_active: boolean | null;
};

type SurveyParticipant = {
  id: string;
  name: string;
  display_name: string | null;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getEvent(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, title, subtitle, is_active")
    .eq("event_code", eventCode.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[participant-survey] Failed to load event.", {
      eventCode,
      message: error.message,
      code: error.code,
    });
  }

  return data as SurveyEvent | null;
}

async function getParticipant(participantId: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name, display_name")
    .eq("id", participantId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[participant-survey] Failed to load participant.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return data as SurveyParticipant | null;
}

export default async function SurveyListPage({
  params,
  searchParams,
}: SurveyListPageProps) {
  const { eventCode } = await params;
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

  if (event.is_active === false) {
    return (
      <div className="grid gap-5">
        <AudienceHero
          label="Survey"
          title="현재 참여할 수 없습니다"
          description="행사가 비활성 상태라 설문 참여 화면을 사용할 수 없습니다."
        />
      </div>
    );
  }

  const participant = await getParticipant(session.participant_id, event.id);

  if (!participant) {
    redirect(`/e/${event.event_code}/join`);
  }

  const { forms, submittedFormIds } = await getOpenSurveyFormsForParticipant({
    eventId: event.id,
    participantId: participant.id,
  });
  const message = getSingle(query.message);
  const error = getSingle(query.error);

  return (
    <div className="grid gap-5">
      <AudienceHero
        label="설문"
        title="참여 가능한 설문"
        description="QR 등록 후 열려 있는 설문에 참여할 수 있습니다. 같은 설문은 한 번만 제출할 수 있습니다."
      >
        <PrimaryLink href={`/e/${event.event_code}/play`} variant="outline">
          참여 화면으로 돌아가기
        </PrimaryLink>
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

      {forms.length > 0 ? (
        <div className="grid gap-4">
          {forms.map((form) => {
            const submitted = submittedFormIds.has(form.id);
            const remainingSeconds = getSurveyRemainingSeconds(form);

            return (
              <MobileCard key={form.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <StatusBadge tone={submitted ? "green" : "cyan"}>
                      {submitted ? "제출 완료" : "참여 가능"}
                    </StatusBadge>
                    <h2 className="mt-4 text-2xl font-black text-[color:#0a1a38]">
                      {form.title}
                    </h2>
                    {form.description && (
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                        {form.description}
                      </p>
                    )}
                    {!submitted && (
                      <p className="mt-3 text-sm font-black text-cyan-800">
                        남은 시간 {Math.floor(remainingSeconds / 60)
                          .toString()
                          .padStart(2, "0")}
                        :{(remainingSeconds % 60).toString().padStart(2, "0")}
                      </p>
                    )}
                  </div>
                  {submitted ? (
                    <span className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900">
                      이미 제출했습니다
                    </span>
                  ) : (
                    <Link
                      href={`/e/${event.event_code}/survey/${form.id}`}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#10284f]"
                    >
                      설문 참여하기
                    </Link>
                  )}
                </div>
              </MobileCard>
            );
          })}
        </div>
      ) : (
        <MobileCard>
          <StatusBadge tone="amber">설문 없음</StatusBadge>
          <h2 className="mt-5 text-3xl font-black text-[color:#0a1a38]">
            현재 참여 가능한 설문이 없습니다.
          </h2>
          <p className="mt-3 text-base font-bold leading-7 text-slate-700">
            운영자가 설문을 열면 이 화면에 표시됩니다.
          </p>
        </MobileCard>
      )}
    </div>
  );
}
