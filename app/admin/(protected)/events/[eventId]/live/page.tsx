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
      description="현장 운영자가 문제 시작, 정답 공개, 결과 송출을 제어할 화면입니다. 실제 제어 기능은 아직 연결하지 않았습니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <AdminPanel title="현재 문제">
          <StatusBadge tone="cyan">대기 중</StatusBadge>
          <p className="mt-5 text-4xl font-black leading-tight text-slate-950">
            라이브 퀴즈 진행 기능은 다음 단계에서 연결합니다.
          </p>
          <p className="mt-4 text-base leading-7 text-slate-600">
            현재는 행사 접근 권한과 운영 화면 구조만 준비된 상태입니다.
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
