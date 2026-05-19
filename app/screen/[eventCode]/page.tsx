import ScreenStage from "./ScreenStage";
import { getPublicScreenState } from "@/lib/screen/public-state";

type ScreenPageProps = {
  params: Promise<{ eventCode: string }>;
};

export default async function ScreenPage({ params }: ScreenPageProps) {
  const { eventCode } = await params;
  const result = await getPublicScreenState(eventCode);
  const initialState = result.status === 200 ? result.body : null;

  return <ScreenStage eventCode={eventCode} initialState={initialState} />;
}
