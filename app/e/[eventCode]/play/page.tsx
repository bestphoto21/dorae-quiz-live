import { redirect } from "next/navigation";
import Link from "next/link";
import { AudienceHero, MobileCard } from "@/components/quiz/ui";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clearParticipantSessionAction } from "../join/actions";
import PlayClient from "./PlayClient";

type PlayPageProps = {
  params: Promise<{ eventCode: string }>;
};

type PlayEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  is_active: boolean | null;
};

type PlayParticipant = {
  id: string;
  name: string;
  display_name: string | null;
};

async function getEvent(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, title, subtitle, is_active")
    .eq("event_code", eventCode.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[participant-play] Failed to load event.", {
      eventCode,
      message: error.message,
      code: error.code,
    });
  }

  return data as PlayEvent | null;
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
    console.error("[participant-play] Failed to load participant.", {
      eventId,
      participantId,
      message: error.message,
      code: error.code,
    });
  }

  return data as PlayParticipant | null;
}

async function getOpenSurveyCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("survey_forms")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "open");

  if (error) {
    console.error("[participant-play] Failed to count open surveys.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { eventCode } = await params;
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
          label="Play"
          title="현재 참여할 수 없습니다"
          description="행사가 비활성화되어 참가자 화면을 사용할 수 없습니다. 현장 운영자에게 문의해 주세요."
        />
      </div>
    );
  }

  const participant = await getParticipant(session.participant_id, event.id);

  if (!participant) {
    redirect(`/e/${event.event_code}/join`);
  }

  const displayName = participant.display_name?.trim() || participant.name;
  const clearAction = clearParticipantSessionAction.bind(null, event.event_code);
  const openSurveyCount = await getOpenSurveyCount(event.id);

  return (
    <div className="grid gap-5">
      <MobileCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-700">
              참가자
            </p>
            <h1 className="mt-2 text-3xl font-black text-[color:#0a1a38]">
              {displayName}님
            </h1>
          </div>
          <form action={clearAction}>
            <button
              type="submit"
              className="rounded-2xl border border-slate-400 bg-white px-4 py-3 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:border-[#0a1a38] hover:bg-slate-50"
            >
              다른 정보로 다시 등록
            </button>
          </form>
        </div>
      </MobileCard>

      {openSurveyCount > 0 && (
        <MobileCard>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-700">진행 중인 설문</p>
              <h2 className="mt-2 text-2xl font-black text-[color:#0a1a38]">
                참여 가능한 설문 {openSurveyCount.toLocaleString("ko-KR")}개
              </h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                설문은 한 번 제출하면 다시 제출할 수 없습니다.
              </p>
            </div>
            <Link
              href={`/e/${event.event_code}/survey`}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#10284f]"
            >
              진행 중인 설문 참여하기
            </Link>
          </div>
        </MobileCard>
      )}

      <PlayClient eventCode={event.event_code} eventTitle={event.title} />
    </div>
  );
}
