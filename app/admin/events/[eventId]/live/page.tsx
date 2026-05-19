import {
  AdminActionButton,
  AdminPanel,
  AdminShell,
  StatusBadge,
} from "@/components/quiz/ui";

export default function LivePage() {
  return (
    <AdminShell
      title="라이브 진행"
      description="운영자가 실수하지 않도록 현재 상태와 주요 진행 버튼을 크게 배치한 더미 화면입니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <AdminPanel title="현재 문제">
          <StatusBadge tone="cyan">Question 01</StatusBadge>
          <p className="mt-5 text-4xl font-black leading-tight">
            현장 송출 중인 문제 카드가 여기에 표시됩니다.
          </p>
        </AdminPanel>
        <AdminPanel title="진행 버튼">
          <div className="grid gap-3">
            <AdminActionButton tone="cyan">문제 시작</AdminActionButton>
            <AdminActionButton tone="amber">정답 공개</AdminActionButton>
            <AdminActionButton>다음 문제</AdminActionButton>
            <AdminActionButton tone="rose">라운드 종료</AdminActionButton>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
