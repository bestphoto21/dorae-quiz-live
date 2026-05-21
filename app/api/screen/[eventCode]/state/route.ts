import { NextResponse } from "next/server";
import { getPublicScreenState } from "@/lib/screen/public-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ScreenStateRouteProps = {
  params: Promise<{ eventCode: string }>;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export async function GET(_request: Request, { params }: ScreenStateRouteProps) {
  const { eventCode } = await params;
  const result = await getPublicScreenState(eventCode);

  return jsonResponse(result.body, result.status);
}
