import { AdminPanel, AdminShell, EmptyState } from "@/components/quiz/ui";

export default function QnaPage() {
  return (
    <AdminShell
      title="현장 Q&A"
      description="참가자가 보낸 질문을 검토하고 송출 대기 상태로 관리할 더미 화면입니다."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <AdminPanel title="새 질문">
          <EmptyState
            title="접수된 질문이 없습니다."
            description="다음 단계에서 질문 등록과 실시간 목록을 연결합니다."
          />
        </AdminPanel>
        <AdminPanel title="송출 대기">
          <EmptyState
            title="선택된 질문이 없습니다."
            description="운영자가 선택한 질문이 현장 스크린에 표시될 예정입니다."
          />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
