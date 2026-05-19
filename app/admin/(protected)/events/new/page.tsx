import { AdminPanel, AdminShell } from "@/components/quiz/ui";
import NewEventForm from "./NewEventForm";

export default function NewEventPage() {
  return (
    <AdminShell
      title="새 행사 만들기"
      description="현장 운영 전에 행사 코드, 송출 색상, 장소와 시간을 먼저 정리합니다. 생성 후 라이브 상태가 자동으로 준비됩니다."
    >
      <AdminPanel
        title="행사 기본 정보"
        description="행사 코드는 참가자 URL과 스크린 URL에 사용되므로 짧고 읽기 쉽게 입력해 주세요."
      >
        <NewEventForm />
      </AdminPanel>
    </AdminShell>
  );
}
