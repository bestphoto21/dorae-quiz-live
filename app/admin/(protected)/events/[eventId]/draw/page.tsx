import {
  AdminActionButton,
  AdminPanel,
  AdminShell,
  EmptyState,
} from "@/components/quiz/ui";

export default function DrawPage() {
  return (
    <AdminShell
      title="추첨"
      description="참가자 또는 정답자 기준으로 경품 추첨을 진행할 운영 화면입니다. 실제 추첨 로직은 아직 연결하지 않았습니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <AdminPanel title="추첨 대상">
          <EmptyState
            title="대상자 목록 준비 중"
            description="참가자 데이터와 정답자 필터가 연결되면 이곳에 추첨 후보 목록이 표시됩니다."
          />
        </AdminPanel>
        <AdminPanel title="결과">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-black uppercase text-amber-700">Winner</p>
            <p className="mt-4 text-5xl font-black text-slate-950">대기 중</p>
          </div>
          <div className="mt-4">
            <AdminActionButton tone="amber">추첨 시작</AdminActionButton>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
