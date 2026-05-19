import { AdminPanel, AdminShell, EmptyState } from "@/components/quiz/ui";

export default function QuestionsPage() {
  return (
    <AdminShell
      title="문제 관리"
      description="질문, 선택지, 정답, 배점, 순서를 다룰 운영 화면의 기본 자리입니다."
    >
      <AdminPanel title="문제 목록" description="아직 실제 문항 데이터는 없습니다.">
        <EmptyState
          title="등록된 문제가 없습니다."
          description="다음 단계에서 문제 생성 폼과 저장 기능을 연결합니다."
        />
      </AdminPanel>
    </AdminShell>
  );
}
