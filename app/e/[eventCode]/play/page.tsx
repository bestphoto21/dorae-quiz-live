import { AudienceHero, MobileCard, PrimaryLink } from "@/components/quiz/ui";

type PlayPageProps = {
  params: Promise<{ eventCode: string }>;
};

const answers = ["현장 참여", "온라인 강의", "사전 등록", "결과 발표"];

export default async function PlayPage({ params }: PlayPageProps) {
  const { eventCode } = await params;

  return (
    <div className="grid gap-5">
      <AudienceHero
        label="Question 01"
        title="문제 풀이 화면"
        description="참가자가 손쉽게 누를 수 있도록 선택지를 크게 배치한 더미 화면입니다."
      />

      <MobileCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-700">
            Q1
          </span>
          <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
            30초
          </span>
        </div>
        <h2 className="mt-6 text-3xl font-black leading-tight sm:text-5xl">
          오늘 행사의 실시간 퀴즈 플랫폼에서 가장 중요한 화면은?
        </h2>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {answers.map((answer, index) => (
            <button
              key={answer}
              type="button"
              disabled
              className="min-h-24 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left text-2xl font-black text-slate-700 shadow-sm"
            >
              <span className="mr-3 text-cyan-700">{index + 1}</span>
              {answer}
            </button>
          ))}
        </div>
      </MobileCard>

      <PrimaryLink href={`/e/${eventCode}`} variant="outline">
        이벤트 홈으로
      </PrimaryLink>
    </div>
  );
}
