import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanel, AdminShell, EmptyState, StatusBadge } from "@/components/quiz/ui";
import {
  canViewOperationLogsByRole,
  getEventScopedRole,
  requireEventAccess,
} from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LogsPageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    action?: string | string[];
    date?: string | string[];
  }>;
};

type OperationLogRow = {
  id: string;
  event_id: string;
  admin_user_id: string | null;
  action: string;
  detail: unknown;
  created_at: string | null;
};

type AdminDisplayRow = {
  id: string;
  name: string | null;
  role: string;
};

const ALLOWED_DETAIL_KEYS = new Set([
  "event_id",
  "mode",
  "screen_scene",
  "changed_at",
  "qna_question_id",
  "status",
  "is_pinned",
  "question_id",
  "quiz_session_id",
  "session_id",
  "prize_id",
  "winner_id",
  "draw_result_id",
  "participant_count",
  "source_type",
  "source_question_id",
]);

const BLOCKED_KEY_PATTERNS = [
  "question_text",
  "phone",
  "phone_normalized",
  "email",
  "participant_id",
  "screen_payload",
  "access_token",
  "refresh_token",
  "secret",
  "key",
  "password",
];

const IMPORTANT_ACTIONS = new Set([
  "qna_question_deleted",
  "live_screen_set_lucky_draw",
  "live_screen_set_qna_waiting",
  "live_screen_set_quiz",
  "live_answer_revealed",
]);

function getSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function shortId(value: string | null) {
  if (!value) {
    return "시스템";
  }

  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}

function isBlockedDetailKey(key: string) {
  const loweredKey = key.toLowerCase();

  return BLOCKED_KEY_PATTERNS.some((pattern) => loweredKey.includes(pattern));
}

function sanitizeDetail(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return [];
  }

  return Object.entries(detail as Record<string, unknown>)
    .filter(([key]) => ALLOWED_DETAIL_KEYS.has(key) && !isBlockedDetailKey(key))
    .filter(([, value]) => {
      const type = typeof value;

      return (
        value === null ||
        type === "string" ||
        type === "number" ||
        type === "boolean"
      );
    })
    .map(([key, value]) => ({
      key,
      value: value === null ? "null" : String(value),
    }));
}

function actionTone(action: string) {
  if (IMPORTANT_ACTIONS.has(action) || action.includes("deleted")) {
    return "rose";
  }

  if (action.includes("revealed") || action.includes("draw")) {
    return "amber";
  }

  if (action.includes("created") || action.includes("approved")) {
    return "green";
  }

  return "slate";
}

function adminLabel(
  adminUserId: string | null,
  adminMap: Map<string, AdminDisplayRow>
) {
  if (!adminUserId) {
    return "시스템";
  }

  const admin = adminMap.get(adminUserId);

  if (!admin) {
    return shortId(adminUserId);
  }

  return admin.name?.trim()
    ? `${admin.name} (${admin.role})`
    : `${shortId(adminUserId)} (${admin.role})`;
}

async function getActionOptions(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("operation_logs")
    .select("action")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[operation-logs] Failed to load action options.", {
      eventId,
      message: error.message,
      code: error.code,
    });
  }

  return Array.from(
    new Set((data ?? []).map((item) => item.action).filter(Boolean))
  ).sort();
}

async function getLogs({
  eventId,
  action,
  date,
}: {
  eventId: string;
  action: string;
  date: string;
}) {
  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("operation_logs")
    .select("id, event_id, admin_user_id, action, detail, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (action) {
    query = query.eq("action", action);
  }

  if (date) {
    const startAt = new Date(`${date}T00:00:00+09:00`).toISOString();
    const endAt = new Date(`${date}T23:59:59+09:00`).toISOString();

    query = query.gte("created_at", startAt).lte("created_at", endAt);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[operation-logs] Failed to load logs.", {
      eventId,
      action,
      date,
      message: error.message,
      code: error.code,
    });
  }

  return (data ?? []) as OperationLogRow[];
}

async function getAdminMap(logs: OperationLogRow[]) {
  const adminIds = Array.from(
    new Set(
      logs
        .map((log) => log.admin_user_id)
        .filter((adminId): adminId is string => Boolean(adminId))
    )
  );

  if (adminIds.length === 0) {
    return new Map<string, AdminDisplayRow>();
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id, name, role")
    .in("id", adminIds);

  if (error) {
    console.error("[operation-logs] Failed to load admin display names.", {
      message: error.message,
      code: error.code,
    });
  }

  return new Map(
    ((data ?? []) as AdminDisplayRow[]).map((admin) => [admin.id, admin])
  );
}

export default async function LogsPage({ params, searchParams }: LogsPageProps) {
  const { eventId } = await params;
  const query = await searchParams;
  const { admin, event } = await requireEventAccess(eventId);
  const role = await getEventScopedRole(admin, eventId);

  if (!canViewOperationLogsByRole(role)) {
    redirect("/admin/events");
  }

  const action = getSingle(query.action)?.trim() ?? "";
  const date = getSingle(query.date)?.trim() ?? "";
  const [actionOptions, logs] = await Promise.all([
    getActionOptions(eventId),
    getLogs({ eventId, action, date }),
  ]);
  const adminMap = await getAdminMap(logs);

  return (
    <AdminShell
      title="운영 로그"
      description="행사 운영 중 발생한 주요 조작을 최신 100개 기준으로 확인합니다."
    >
      <div className="grid gap-5">
        <AdminPanel
          title={event.title}
          description="민감 정보와 원본 detail JSON은 표시하지 않고, 허용된 운영 키만 요약합니다."
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/events/${eventId}/rehearsal`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm"
            >
              리허설 체크로 이동
            </Link>
            <Link
              href={`/admin/events/${eventId}/live`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm"
            >
              라이브 콘솔로 이동
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel title="필터" description="action과 날짜 기준으로 좁혀 봅니다.">
          <form className="grid gap-3 md:grid-cols-[1fr_14rem_auto]">
            <select
              name="action"
              defaultValue={action}
              className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-950 shadow-sm"
            >
              <option value="">전체 action</option>
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-950 shadow-sm"
            />
            <button
              type="submit"
              className="min-h-11 rounded-2xl border border-slate-950 bg-slate-950 px-5 py-2 text-sm font-black text-white shadow-sm"
            >
              로그 보기
            </button>
          </form>
        </AdminPanel>

        <AdminPanel
          title="최신 로그"
          description="detail은 허용된 키만 표시합니다. 질문 원문, 연락처, 인증 정보, 원본 payload는 표시하지 않습니다."
        >
          {logs.length > 0 ? (
            <div className="grid gap-3">
              {logs.map((log) => {
                const details = sanitizeDetail(log.detail);

                return (
                  <article
                    key={log.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <StatusBadge tone={actionTone(log.action)}>
                          {log.action}
                        </StatusBadge>
                        <p className="mt-3 text-sm font-bold text-slate-600">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>
                      <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                        {adminLabel(log.admin_user_id, adminMap)}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase text-slate-500">
                          event_id
                        </p>
                        <p className="mt-1 break-all text-sm font-bold text-slate-950">
                          {log.event_id}
                        </p>
                      </div>
                      {details.map((detail) => (
                        <div
                          key={`${log.id}-${detail.key}`}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <p className="text-xs font-black uppercase text-slate-500">
                            {detail.key}
                          </p>
                          <p className="mt-1 break-all text-sm font-bold text-slate-950">
                            {detail.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="조건에 맞는 로그가 없습니다."
              description="운영 작업이 발생하면 이곳에 최신 로그가 표시됩니다."
            />
          )}
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
