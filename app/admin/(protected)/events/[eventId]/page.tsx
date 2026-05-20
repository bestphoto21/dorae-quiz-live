import Link from "next/link";
import {
  AdminPanel,
  AdminShell,
  OperatorLink,
  StatusBadge,
} from "@/components/quiz/ui";
import { EventJoinQr } from "@/components/quiz/QrCode";
import { requireEventAccess } from "@/lib/auth/events";
import { buildPublicUrl, getConfiguredSiteUrl } from "@/lib/site-url";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type EventDetailPageProps = {
  params: Promise<{ eventId: string }>;
};

type LiveStateSummary = {
  mode: string;
  screen_scene: string | null;
  updated_at: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

async function getExactCount(table: string, eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (error) {
    console.error("[admin-events] Failed to load count.", {
      table,
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getQuestionCount(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: sessions, error: sessionsError } = await supabase
    .from("quiz_sessions")
    .select("id")
    .eq("event_id", eventId);

  if (sessionsError) {
    console.error("[admin-events] Failed to load quiz sessions for count.", {
      eventId,
      message: sessionsError.message,
      code: sessionsError.code,
    });

    return 0;
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);

  if (sessionIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds);

  if (error) {
    console.error("[admin-events] Failed to load question count.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return 0;
  }

  return count ?? 0;
}

async function getLiveState(eventId: string): Promise<LiveStateSummary | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("live_state")
    .select("mode, screen_scene, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[admin-events] Failed to load live_state.", {
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return data as LiveStateSummary | null;
}

function liveModeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
  };

  return labels[mode ?? "waiting"] ?? "대기";
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    question: "퀴즈 문제 화면",
    closed: "응답 마감 화면",
    result: "결과 화면",
    qna: "Q&A 대기 화면",
    qna_waiting: "Q&A 대기 화면",
    qna_question: "승인 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    draw_winner: "당첨자 발표 화면",
    join_qr: "QR 참여 안내 화면",
  };

  return labels[scene ?? "waiting"] ?? "대기 화면";
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-black text-[color:#0a1a38]">
        {value.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-700">{label}</p>
      <p className="mt-2 break-all text-base font-bold text-[color:#0a1a38]">
        {value}
      </p>
    </div>
  );
}

function UrlBox({ label, value }: { label: string; value: string }) {
  return (
    <label className="block rounded-2xl border border-slate-300 bg-slate-50 p-4">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        readOnly
        value={value}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[color:#0a1a38]"
      />
    </label>
  );
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { eventId } = await params;
  const { event } = await requireEventAccess(eventId);

  const [
    participantCount,
    questionCount,
    answerCount,
    qnaCount,
    winnerCount,
    liveState,
  ] = await Promise.all([
    getExactCount("participants", eventId),
    getQuestionCount(eventId),
    getExactCount("answers", eventId),
    getExactCount("qna_questions", eventId),
    getExactCount("draw_winners", eventId),
    getLiveState(eventId),
  ]);
  const siteUrl = getConfiguredSiteUrl();
  const eventCode = event.event_code?.trim() ?? "";
  const hasEventCode = eventCode.length > 0;
  const participantHomeUrl = hasEventCode
    ? buildPublicUrl(`/e/${eventCode}`)
    : "행사 코드가 없습니다.";
  const joinUrl = hasEventCode
    ? buildPublicUrl(`/e/${eventCode}/join`)
    : "행사 코드가 없습니다.";
  const playUrl = hasEventCode
    ? buildPublicUrl(`/e/${eventCode}/play`)
    : "행사 코드가 없습니다.";
  const screenUrl = hasEventCode
    ? buildPublicUrl(`/screen/${eventCode}`)
    : "행사 코드가 없습니다.";

  return (
    <AdminShell
      title="행사 개요"
      description="행사 기본 정보, 운영 상태, 참가자와 스크린 접속 주소를 한 화면에서 확인합니다."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <AdminPanel title={event.title} description={event.subtitle ?? undefined}>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={(event.is_active ?? true) ? "green" : "amber"}>
                {(event.is_active ?? true) ? "활성" : "비활성"}
              </StatusBadge>
              <StatusBadge tone="cyan">{event.event_code}</StatusBadge>
              <StatusBadge tone="slate">
                현재 운영: {liveModeLabel(liveState?.mode)}
              </StatusBadge>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailRow label="장소" value={event.venue ?? "미정"} />
              <DetailRow label="대표 색상" value={event.primary_color ?? "#0a1a38"} />
              <DetailRow label="시작" value={formatDateTime(event.starts_at)} />
              <DetailRow label="종료" value={formatDateTime(event.ends_at)} />
              <DetailRow label="참가자 URL" value={participantHomeUrl} />
              <DetailRow label="스크린 URL" value={screenUrl} />
            </div>

            {event.screen_notice && (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-sm font-black uppercase text-cyan-700">
                  스크린 안내
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-cyan-950">
                  {event.screen_notice}
                </p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-950">
              시작/종료 시간은 참가자 안내와 운영 기준용입니다. 실제 퀴즈
              시작, 마감, 정답 공개, Q&A 송출, 럭키드로우 진행은 라이브
              콘솔에서 운영자가 직접 제어합니다. 행사를 완전히 막으려면
              행사 설정에서 비활성 상태로 전환하세요.
            </div>
          </AdminPanel>

          <AdminPanel
            title="운영 지표"
            description="아직 기능 연결 전인 영역도 현재 DB에 있는 데이터 기준으로 집계합니다."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard label="참가자" value={participantCount} />
              <StatCard label="문제" value={questionCount} />
              <StatCard label="응답" value={answerCount} />
              <StatCard label="Q&A" value={qnaCount} />
              <StatCard label="당첨자" value={winnerCount} />
            </div>
          </AdminPanel>

          <div className="grid gap-4 md:grid-cols-2">
            <OperatorLink
              href={`/admin/events/${eventId}/questions`}
              title="문제 관리"
              description="문항과 선택지를 준비하고 정답 정보를 관리하는 화면입니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/live`}
              title="라이브 진행"
              description="문제 시작, 정답 공개, 결과 송출을 운영하는 화면입니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/draw`}
              title="추첨"
              description="참가자 또는 정답자 기준 추첨을 진행하고 스크린에 발표합니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/qna`}
              title="Q&A"
              description="참가자 질문을 승인하고 현장 스크린에 송출합니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/rehearsal`}
              title="리허설 체크"
              description="행사 전 점검 상태와 필수 리허설 항목을 한 화면에서 확인합니다."
            />
            <OperatorLink
              href={`/admin/events/${eventId}/logs`}
              title="운영 로그"
              description="누가 언제 어떤 운영 조작을 했는지 최신 로그를 확인합니다."
            />
            <OperatorLink
              href={`/screen/${event.event_code}`}
              title="스크린 열기"
              description="현장 송출 화면을 새 탭에서 확인합니다."
            />
          </div>
        </div>

        <div className="grid gap-5 content-start">
          <AdminPanel title="설정">
            <Link
              href={`/admin/events/${eventId}/settings`}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-[#10284f]"
            >
              행사 설정 수정
            </Link>
          </AdminPanel>

          <AdminPanel title="라이브 상태">
            <div className="grid gap-3 text-sm font-bold text-slate-700">
              <DetailRow
                label="현재 운영 모드"
                value={liveModeLabel(liveState?.mode)}
              />
              <DetailRow
                label="현재 송출 화면"
                value={sceneLabel(liveState?.screen_scene)}
              />
              <DetailRow
                label="마지막 변경"
                value={formatDateTime(liveState?.updated_at ?? null)}
              />
            </div>
          </AdminPanel>

          <AdminPanel
            title="주소 안내"
            description="참가자 등록 URL과 스크린 URL은 행사별로 다릅니다. QR은 참가자 등록 페이지로 연결됩니다."
          >
            <div className="grid gap-3">
              {hasEventCode ? (
                <EventJoinQr joinUrl={joinUrl} />
              ) : (
                <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-black leading-6 text-amber-950">
                  행사 코드가 없어 참가자 등록 QR을 표시할 수 없습니다. 행사
                  설정에서 행사 코드를 확인해 주세요.
                </p>
              )}
              <UrlBox label="참가자 등록 URL" value={joinUrl} />
              <UrlBox label="참가자 플레이 URL" value={playUrl} />
              <UrlBox label="스크린 URL" value={screenUrl} />
              {!siteUrl && (
                <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-black leading-6 text-amber-950">
                  NEXT_PUBLIC_SITE_URL이 설정되지 않아 상대경로로 표시됩니다.
                  배포 전 실제 서비스 주소로 설정해 주세요.
                </p>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminShell>
  );
}
