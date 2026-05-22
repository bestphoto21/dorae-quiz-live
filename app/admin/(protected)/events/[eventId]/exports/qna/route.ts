import { exportQnaCsv } from "@/lib/exports/event-results";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;

  return exportQnaCsv(eventId);
}
