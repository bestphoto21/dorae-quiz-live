import ScreenStage from "./ScreenStage";

type ScreenPageProps = {
  params: Promise<{ eventCode: string }>;
};

export default async function ScreenPage({ params }: ScreenPageProps) {
  const { eventCode } = await params;

  return <ScreenStage eventCode={eventCode} />;
}
