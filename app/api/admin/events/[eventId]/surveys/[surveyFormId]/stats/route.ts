import { NextResponse } from "next/server";
import {
  canManageSurveysByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { getSurveyStatsSnapshot } from "@/lib/data/surveys";

type SurveyStatsRouteProps = {
  params: Promise<{ eventId: string; surveyFormId: string }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(_request: Request, { params }: SurveyStatsRouteProps) {
  const { eventId, surveyFormId } = await params;
  const { admin } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canManageSurveysByRole(role)) {
    return NextResponse.json(
      { ok: false, message: "Forbidden" },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const stats = await getSurveyStatsSnapshot({ eventId, surveyFormId });

  if (!stats) {
    return NextResponse.json(
      { ok: false, message: "Survey not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      stats,
    },
    { headers: NO_STORE_HEADERS }
  );
}
