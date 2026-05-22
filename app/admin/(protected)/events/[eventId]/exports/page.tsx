import Link from "next/link";
import { AdminPanel, AdminShell, EmptyState, StatusBadge } from "@/components/quiz/ui";
import { getEventScopedRole, requireEventAccess } from "@/lib/auth/events";
import {
  getEventExportPermissions,
  getEventExportSummary,
  type EventExportPermissions,
} from "@/lib/exports/event-results";

type ExportsPageProps = {
  params: Promise<{ eventId: string }>;
};

function CountBadge({ count }: { count: number }) {
  return <StatusBadge tone={count > 0 ? "cyan" : "slate"}>{count}건</StatusBadge>;
}

function DownloadLink({
  href,
  label,
  count,
  enabled,
}: {
  href: string;
  label: string;
  count: number;
  enabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-base font-black text-[color:#0a1a38]">{label}</p>
        <p className="mt-1 text-xs font-bold text-slate-600">
          파일 다운로드로 동작하며 새 탭을 열지 않습니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CountBadge count={count} />
        {enabled ? (
          <a
            href={href}
            download
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#10284f]"
          >
            {label}
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-500">
            권한 없음
          </span>
        )}
      </div>
    </div>
  );
}

function SurveyDownloadRows({
  eventId,
  permissions,
  surveys,
}: {
  eventId: string;
  permissions: EventExportPermissions;
  surveys: Awaited<ReturnType<typeof getEventExportSummary>>["surveys"];
}) {
  if (surveys.length === 0) {
    return (
      <EmptyState
        title="아직 설문이 없습니다."
        description="설문이 만들어지면 설문별 응답 CSV와 제출자 CSV를 받을 수 있습니다."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {surveys.map((survey) => {
        const query = `surveyFormId=${encodeURIComponent(survey.id)}`;

        return (
          <article
            key={survey.id}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-[color:#0a1a38]">
                  {survey.title}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-600">
                  설문 상태: {survey.status}
                </p>
              </div>
              <CountBadge count={survey.response_count} />
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <DownloadLink
                href={`/admin/events/${eventId}/exports/survey-responses?${query}`}
                label="설문 응답 CSV"
                count={survey.response_count}
                enabled={permissions.surveyResponses}
              />
              <DownloadLink
                href={`/admin/events/${eventId}/exports/survey-respondents?${query}`}
                label="설문 제출자 CSV"
                count={survey.response_count}
                enabled={permissions.surveyRespondents}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default async function ExportsPage({ params }: ExportsPageProps) {
  const { eventId } = await params;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);
  const [summary, permissions] = await Promise.all([
    getEventExportSummary(eventId),
    Promise.resolve(getEventExportPermissions(role)),
  ]);

  return (
    <AdminShell
      title="결과 다운로드"
      description="행사 종료 후 보고자료와 정산 확인에 필요한 CSV를 관리자 보호 영역에서 내려받습니다."
    >
      <div className="grid gap-5">
        <AdminPanel title={event.title} description={`행사 코드: ${event.event_code}`}>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="green">CSV 다운로드</StatusBadge>
            <StatusBadge tone="slate">권한: {role ?? "확인 필요"}</StatusBadge>
          </div>
          <p className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
            CSV에는 보고와 운영 확인에 필요한 최소 정보만 포함합니다. 전화번호,
            이메일, 참가자 내부 ID, 세션/토큰/키, 원본 screen payload는 내보내지
            않습니다.
          </p>
          <div className="mt-4">
            <Link
              href={`/admin/events/${eventId}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-400 bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm"
            >
              행사 개요로 돌아가기
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel
          title="기본 결과 CSV"
          description="데이터가 0건이어도 헤더가 있는 CSV를 내려받을 수 있습니다."
        >
          <div className="grid gap-3">
            <DownloadLink
              href={`/admin/events/${eventId}/exports/participants`}
              label="참가자 명단 CSV"
              count={summary.participant_count}
              enabled={permissions.participants}
            />
            <DownloadLink
              href={`/admin/events/${eventId}/exports/draw-winners`}
              label="당첨자 CSV"
              count={summary.draw_winner_count}
              enabled={permissions.drawWinners}
            />
            <DownloadLink
              href={`/admin/events/${eventId}/exports/qna`}
              label="Q&A CSV"
              count={summary.qna_count}
              enabled={permissions.qna}
            />
            <DownloadLink
              href={`/admin/events/${eventId}/exports/operation-logs`}
              label="운영 로그 CSV"
              count={summary.operation_log_count}
              enabled={permissions.operationLogs}
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title="설문별 CSV"
          description="설문 응답 CSV는 질문 순서대로 열을 만들고, 설문 제출자 CSV는 추첨 후보 확인용 명단만 제공합니다."
        >
          <SurveyDownloadRows
            eventId={eventId}
            permissions={permissions}
            surveys={summary.surveys}
          />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
