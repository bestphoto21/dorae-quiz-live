import { AdminPanel, AdminShell, EmptyState } from "@/components/quiz/ui";

export default function QuestionsPage() {
  return (
    <AdminShell
      title="문제 관리"
      description="질문, 선택지, 정답, 제한 시간과 노출 순서를 운영자가 준비하는 화면입니다."
    >
      <AdminPanel
        title="문제 목록"
        description="이번 단계에서는 행사 접근 권한만 확인하고, 문제 CRUD는 아직 연결하지 않습니다."
      >
        <EmptyState
          title="등록된 문제가 없습니다."
          description="다음 단계에서 퀴즈 세션과 문제 생성, 수정, 삭제 기능을 연결합니다."
        />
      </AdminPanel>
    </AdminShell>
  );
}
