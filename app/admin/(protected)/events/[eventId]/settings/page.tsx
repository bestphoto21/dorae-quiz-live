import { AdminPanel, AdminShell } from "@/components/quiz/ui";
import { requireEventAccess } from "@/lib/auth/events";
import { updateEventAction } from "../../actions";
import SettingsEventForm from "./SettingsEventForm";

type EventSettingsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function EventSettingsPage({
  params,
  searchParams,
}: EventSettingsPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { event } = await requireEventAccess(eventId);
  const action = updateEventAction.bind(null, eventId);
  const message =
    query.message === "updated" ? "변경사항을 저장했습니다." : null;

  return (
    <AdminShell
      title="행사 설정"
      description="현장 운영에 필요한 행사 기본 정보를 수정합니다. 행사 코드는 URL 안정성을 위해 잠겨 있습니다."
    >
      <AdminPanel
        title="기본 정보 수정"
        description="비활성 처리는 다음 단계에서 참가자 입장 차단 기준으로 연결할 예정입니다."
      >
        {message && (
          <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {message}
          </p>
        )}
        <SettingsEventForm event={event} action={action} />
      </AdminPanel>
    </AdminShell>
  );
}
