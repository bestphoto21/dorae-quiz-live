import {
  AudienceHero,
  MobileCard,
  PrimaryLink,
  StatusBadge,
} from "@/components/quiz/ui";
import { readParticipantSessionCookie } from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type EventPageProps = {
  params: Promise<{ eventCode: string }>;
};

type PublicEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  screen_notice: string | null;
  is_active: boolean | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

async function getEventByCode(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, event_code, title, subtitle, venue, starts_at, ends_at, screen_notice, is_active"
    )
    .eq("event_code", eventCode.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[participant-event] Failed to load event.", {
      eventCode,
      message: error.message,
      code: error.code,
    });
  }

  return data as PublicEvent | null;
}

function UnavailableEvent({ eventCode }: { eventCode: string }) {
  return (
    <div className="grid gap-5">
      <AudienceHero
        label="Event"
        title="참여할 수 없는 행사입니다"
        description="행사 코드가 올바르지 않거나 현재 참가자 입장이 비활성화되어 있습니다. 현장 운영자에게 문의해 주세요."
      />
      <MobileCard>
        <StatusBadge tone="amber">Event Code</StatusBadge>
        <p className="mt-3 break-all text-3xl font-black">
          {eventCode.toUpperCase()}
        </p>
      </MobileCard>
    </div>
  );
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventCode } = await params;
  const normalizedEventCode = eventCode.trim().toLowerCase();
  const event = await getEventByCode(normalizedEventCode);
  const participantSession =
    event && event.is_active !== false
      ? await readParticipantSessionCookie(normalizedEventCode)
      : null;
  const hasValidSession =
    participantSession?.event_id === event?.id &&
    participantSession?.event_code === event?.event_code;

  if (!event || event.is_active === false) {
    return <UnavailableEvent eventCode={normalizedEventCode} />;
  }

  return (
    <div className="grid gap-5">
      <AudienceHero
        label="Event Lobby"
        title={event.title}
        description={
          event.subtitle ??
          "행사 실시간 퀴즈에 참여하려면 간단한 참가 정보를 등록해 주세요."
        }
      >
        <PrimaryLink href={`/e/${event.event_code}/join`}>
          참여하기
        </PrimaryLink>
        {hasValidSession && (
          <PrimaryLink href={`/e/${event.event_code}/play`} variant="outline">
            참여 화면으로 이동
          </PrimaryLink>
        )}
      </AudienceHero>

      <div className="grid gap-4 sm:grid-cols-3">
        <MobileCard>
          <StatusBadge tone="slate">Event Code</StatusBadge>
          <p className="mt-3 break-all text-4xl font-black">
            {event.event_code.toUpperCase()}
          </p>
        </MobileCard>
        <MobileCard>
          <StatusBadge tone="green">장소</StatusBadge>
          <p className="mt-3 text-3xl font-black">
            {event.venue ?? "현장 안내"}
          </p>
        </MobileCard>
        <MobileCard>
          <StatusBadge tone="amber">일정</StatusBadge>
          <p className="mt-3 text-xl font-black leading-8">
            {formatDateTime(event.starts_at)}
          </p>
        </MobileCard>
      </div>

      <MobileCard>
        <h2 className="text-2xl font-black text-slate-950">
          개인정보 수집 안내
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600">
          참가 확인과 중복 등록 방지를 위해 이름과 휴대폰 번호를 수집합니다.
          휴대폰 번호는 화면 송출이나 공개 결과에 표시하지 않습니다.
        </p>
        {event.screen_notice && (
          <p className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-800">
            {event.screen_notice}
          </p>
        )}
      </MobileCard>
    </div>
  );
}
