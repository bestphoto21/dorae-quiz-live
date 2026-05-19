import {
  AdminPanel,
  AdminShell,
  EmptyState,
  OperatorLink,
} from "@/components/quiz/ui";

export default function AdminEventsPage() {
  return (
    <AdminShell
      title="이벤트 관리"
      description="행사별 퀴즈 설정, 라이브 진행, 추첨, Q&A로 들어가는 기본 라우팅 허브입니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          <OperatorLink
            href="/admin/events/dorae2026"
            title="샘플 이벤트"
            description="이벤트 상세와 하위 운영 메뉴를 확인합니다."
          />
          <OperatorLink
            href="/admin/events/dorae2026/live"
            title="바로 라이브 진행"
            description="문제 시작과 송출 제어가 들어갈 화면입니다."
          />
        </div>
        <AdminPanel title="이벤트 목록">
          <EmptyState
            title="데이터 연결 전입니다."
            description="다음 단계에서 DB를 정하면 실제 이벤트 목록으로 바꿉니다."
          />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
