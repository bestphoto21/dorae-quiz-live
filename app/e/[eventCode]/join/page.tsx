import { AudienceHero, MobileCard, PrimaryLink } from "@/components/quiz/ui";

type JoinPageProps = {
  params: Promise<{ eventCode: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { eventCode } = await params;

  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      <AudienceHero
        label="Join"
        title="닉네임을 입력하세요"
        description="실제 참가 기능은 다음 단계에서 연결합니다. 지금은 입력 폼과 대기 상태만 보여줍니다."
      />

      <MobileCard>
        <label htmlFor="nickname" className="text-sm font-black text-slate-500">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          placeholder="예: 도래팀"
          className="mt-3 w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-2xl font-black text-slate-950 placeholder:text-slate-400"
        />
        <button
          type="button"
          disabled
          className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-100 px-5 py-4 text-lg font-black text-slate-400"
        >
          참가하기 준비 중
        </button>
      </MobileCard>

      <PrimaryLink href={`/e/${eventCode}/play`} variant="outline">
        문제 화면 미리보기
      </PrimaryLink>
    </div>
  );
}
