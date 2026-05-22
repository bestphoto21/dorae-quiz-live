import { redirect } from "next/navigation";
import { AudienceHero, MobileCard } from "@/components/quiz/ui";
import { getActiveSurveyPromptForParticipant } from "@/lib/data/surveys";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import {
  getParticipantScreenDescription,
  getParticipantScreenTitle,
  resolveParticipantFeatureSettings,
  type ParticipantFeatureSettings,
} from "@/lib/participant-settings";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clearParticipantSessionAction } from "../join/actions";
import PlayClient from "./PlayClient";
import { SurveyPromptClient } from "./SurveyPromptClient";

type PlayPageProps = {
  params: Promise<{ eventCode: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlayEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  is_active: boolean | null;
} & ParticipantFeatureSettings;

type PlayParticipant = {
  id: string;
  name: string;
  display_name: string | null;
};

async function getEvent(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, event_code, title, subtitle, participant_title, participant_description, participant_show_quiz, participant_show_qna, participant_show_survey, participant_show_draw, is_active"
    )
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
  const participantSettings = resolveParticipantFeatureSettings(event);
  const participantTitle = getParticipantScreenTitle(event);
  const participantDescription = getParticipantScreenDescription(
    event,
    "운영자의 안내에 따라 참여해 주세요."
  );
  const activeSurveyPrompt = participantSettings.participant_show_survey
    ? await getActiveSurveyPromptForParticipant({
        eventId: event.id,
        eventCode: event.event_code,
        participantId: participant.id,
      })
    : null;

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

      {participantSettings.participant_show_survey && (
        <SurveyPromptClient
          eventCode={event.event_code}
          initialSurvey={activeSurveyPrompt}
        />
      )}

      <PlayClient
        eventCode={event.event_code}
        eventTitle={event.title}
        participantTitle={participantTitle}
        participantDescription={participantDescription}
        featureSettings={participantSettings}
      />
    </div>
  );
}
