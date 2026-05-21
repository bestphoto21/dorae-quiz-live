import { NextResponse } from "next/server";
import { getActiveSurveyPromptForParticipant } from "@/lib/data/surveys";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ActiveSurveyRouteProps = {
  params: Promise<{ eventCode: string }>;
};

type SurveyEventRow = {
  id: string;
  event_code: string;
  is_active: boolean | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(_request: Request, { params }: ActiveSurveyRouteProps) {
  const { eventCode } = await params;
  const normalizedEventCode = eventCode.trim().toLowerCase();
  const session = await readParticipantSessionCookie(normalizedEventCode);

  if (!session) {
    return NextResponse.json(
      { ok: false, survey: null },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, is_active")
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (error) {
    console.error("[participant-survey-active] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: error.message,
      code: error.code,
    });

    return NextResponse.json(
      { ok: false, survey: null },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const event = data as SurveyEventRow | null;

  if (!event || event.is_active === false || event.id !== session.event_id) {
    return NextResponse.json(
      { ok: true, survey: null },
      { headers: NO_STORE_HEADERS }
    );
  }

  const survey = await getActiveSurveyPromptForParticipant({
    eventId: event.id,
    eventCode: event.event_code,
    participantId: session.participant_id,
  });

  return NextResponse.json(
    {
      ok: true,
      survey,
    },
    { headers: NO_STORE_HEADERS }
  );
}
