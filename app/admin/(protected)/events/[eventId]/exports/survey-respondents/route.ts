import type { NextRequest } from "next/server";
import { exportSurveyRespondentsCsv } from "@/lib/exports/event-results";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ eventId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { eventId } = await params;
  const surveyFormId = request.nextUrl.searchParams.get("surveyFormId");

  return exportSurveyRespondentsCsv({ eventId, surveyFormId });
}
