import {
  AdminPanel,
  AdminShell,
  OperatorLink,
  StatusBadge,
} from "@/components/quiz/ui";

type EventDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;

  return (
    <AdminShell
      title="이벤트 개요"
      description="행사 코드, 공개 링크, 운영 메뉴를 한 화면에서 확인하는 더미 상세 페이지입니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          <OperatorLink
            href={`/admin/events/${eventId}/questions`}
            title="문제 관리"
            description="문항과 선택지를 준비합니다."
          />
          <OperatorLink
            href={`/admin/events/${eventId}/live`}
            title="라이브 진행"
            description="문제 시작, 정답 공개, 다음 문제 이동을 제어합니다."
          />
          <OperatorLink
            href={`/admin/events/${eventId}/draw`}
            title="추첨"
            description="참가자 또는 정답자 추첨을 진행합니다."
          />
          <OperatorLink
            href={`/admin/events/${eventId}/qna`}
            title="Q&A"
            description="현장 질문을 검토하고 송출 후보로 관리합니다."
          />
        </div>
        <AdminPanel title="공개 링크">
          <div className="grid gap-3 text-sm font-black text-slate-700">
            <StatusBadge tone="cyan">EVENT ID: {eventId}</StatusBadge>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              참가자: /e/{eventId}
            </p>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              송출: /screen/{eventId}
            </p>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
