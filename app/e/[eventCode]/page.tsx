import {
  AudienceHero,
  MobileCard,
  PrimaryLink,
  StatusBadge,
} from "@/components/quiz/ui";

type EventPageProps = {
  params: Promise<{ eventCode: string }>;
};

export default async function EventPage({ params }: EventPageProps) {
  const { eventCode } = await params;

  return (
    <div className="grid gap-5">
      <AudienceHero
        label="Event Lobby"
        title="퀴즈 입장 대기"
        description="행사 코드를 확인하고 참가자 등록 또는 문제 풀이 화면으로 이동하는 모바일 중심 화면입니다."
      >
        <PrimaryLink href={`/e/${eventCode}/join`}>참가 등록</PrimaryLink>
        <PrimaryLink href={`/e/${eventCode}/play`} variant="outline">
          플레이 화면
        </PrimaryLink>
      </AudienceHero>

      <div className="grid gap-4 sm:grid-cols-3">
        <MobileCard>
          <StatusBadge tone="slate">Event Code</StatusBadge>
          <p className="mt-3 text-4xl font-black">{eventCode.toUpperCase()}</p>
        </MobileCard>
        <MobileCard>
          <StatusBadge tone="green">Status</StatusBadge>
          <p className="mt-3 text-4xl font-black">READY</p>
        </MobileCard>
        <MobileCard>
          <StatusBadge tone="amber">Round</StatusBadge>
          <p className="mt-3 text-4xl font-black">01</p>
        </MobileCard>
      </div>
    </div>
  );
}
