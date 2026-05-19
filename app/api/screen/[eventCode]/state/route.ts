import { NextResponse } from "next/server";
import { getPublicScreenState } from "@/lib/screen/public-state";

type ScreenStateRouteProps = {
  params: Promise<{ eventCode: string }>;
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(_request: Request, { params }: ScreenStateRouteProps) {
  const { eventCode } = await params;
  const result = await getPublicScreenState(eventCode);

  return jsonResponse(result.body, result.status);
}
