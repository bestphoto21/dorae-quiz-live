import Link from "next/link";
import { AudienceHero, MobileCard, StatusBadge } from "@/components/quiz/ui";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { registerParticipantAction } from "./actions";

type JoinPageProps = {
  params: Promise<{ eventCode: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

type JoinEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  is_active: boolean | null;
};

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function getEvent(eventCode: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, event_code, title, subtitle, is_active")
    .eq("event_code", eventCode.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[participant-join] Failed to load event.", {
      eventCode,
      message: error.message,
      code: error.code,
    });
  }

  return data as JoinEvent | null;
}

function labelClasses() {
  return "text-sm font-black text-slate-700";
}

function inputClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-400 bg-white px-5 py-4 text-lg font-bold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-950";
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const { eventCode } = await params;
  const query = await searchParams;
  const normalizedEventCode = eventCode.trim().toLowerCase();
  const event = await getEvent(normalizedEventCode);
  const error = getSingle(query.error);
  const action = registerParticipantAction.bind(null, normalizedEventCode);

  if (!event || event.is_active === false) {
    return (
      <div className="mx-auto grid max-w-2xl gap-5">
        <AudienceHero
          label="Join"
          title="현재 등록할 수 없습니다"
          description="행사 코드가 올바르지 않거나 참가자 입장이 비활성화되어 있습니다."
        />
        <Link
          href={`/e/${normalizedEventCode}`}
          className="rounded-2xl border border-slate-400 bg-white px-5 py-4 text-center text-lg font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
        >
          행사 화면으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <AudienceHero
        label="Join"
        title="참가 정보를 입력해 주세요"
        description={`${event.title} 참여를 위해 이름과 휴대폰 번호를 확인합니다.`}
      />

      <MobileCard>
        <form action={action} className="grid gap-5">
          <div>
            <label htmlFor="name" className={labelClasses()}>
              이름 *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={inputClasses()}
              placeholder="홍길동"
            />
          </div>

          <div>
            <label htmlFor="phone" className={labelClasses()}>
              휴대폰 번호 *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              className={inputClasses()}
              placeholder="010-1234-5678"
            />
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
              중복 등록 확인에만 사용하며 공개 화면에는 표시하지 않습니다.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="organization" className={labelClasses()}>
                소속
              </label>
              <input
                id="organization"
                name="organization"
                type="text"
                className={inputClasses()}
                placeholder="회사/학교"
              />
            </div>
            <div>
              <label htmlFor="group_name" className={labelClasses()}>
                팀/테이블
              </label>
              <input
                id="group_name"
                name="group_name"
                type="text"
                className={inputClasses()}
                placeholder="A팀"
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4">
            <input
              name="consent_privacy"
              type="checkbox"
              required
              className="mt-1 h-5 w-5 rounded border-slate-400"
            />
            <span className="text-sm font-bold leading-6 text-slate-700">
              행사 참여 확인, 중복 등록 방지, 퀴즈 운영을 위한 개인정보 수집 및
              이용에 동의합니다.
            </span>
          </label>

          {error && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="min-h-14 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            등록하고 참여하기
          </button>
        </form>
      </MobileCard>

      <MobileCard>
        <StatusBadge tone="cyan">{event.event_code}</StatusBadge>
        <p className="mt-3 text-sm font-bold leading-6 text-slate-700">
          이미 등록한 경우 같은 휴대폰 번호로 다시 입력하면 기존 참가자 정보가
          최신 입력값으로 갱신됩니다.
        </p>
      </MobileCard>
    </div>
  );
}
