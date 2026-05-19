import {
  AdminPanel,
  AdminShell,
  OperatorLink,
  StatusBadge,
} from "@/components/quiz/ui";

export default function AdminPage() {
  return (
    <AdminShell
      title="운영자 홈"
      description="행사 운영자가 주요 화면과 배포 전 점검 화면을 빠르게 찾을 수 있는 관리자 콘솔입니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          <OperatorLink
            href="/admin/events"
            title="이벤트 관리"
            description="행사 목록과 각 행사 운영 화면으로 이동합니다."
          />
          <OperatorLink
            href="/screen/dorae2026"
            title="송출 화면 확인"
            description="현장 스크린에 표시될 화면을 미리 확인합니다."
          />
          <OperatorLink
            href="/admin/health"
            title="시스템 헬스체크"
            description="환경변수와 Supabase 연결 상태를 값 노출 없이 확인합니다."
          />
        </div>
        <AdminPanel title="오늘의 운영 상태">
          <div className="grid gap-3">
            <StatusBadge tone="green">시스템 준비</StatusBadge>
            <StatusBadge tone="green">관리자 인증 활성</StatusBadge>
            <StatusBadge tone="amber">배포 전 헬스체크 필요</StatusBadge>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
