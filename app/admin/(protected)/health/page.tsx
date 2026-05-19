import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanel, AdminShell, StatusBadge } from "@/components/quiz/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { validatePublicEnv, validateServerEnv } from "@/lib/env/validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type HealthStatus = "ok" | "warn" | "danger";

type HealthCheck = {
  label: string;
  status: HealthStatus;
  value: string;
  hint: string;
};

function statusTone(status: HealthStatus) {
  if (status === "ok") {
    return "green";
  }

  if (status === "danger") {
    return "rose";
  }

  return "amber";
}

function statusLabel(status: HealthStatus) {
  if (status === "ok") {
    return "정상";
  }

  if (status === "danger") {
    return "위험";
  }

  return "주의";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(value);
}

function HealthCard({ check }: { check: HealthCheck }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-950">{check.label}</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            {check.hint}
          </p>
        </div>
        <StatusBadge tone={statusTone(check.status)}>
          {statusLabel(check.status)}
        </StatusBadge>
      </div>
      <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-950">
        {check.value}
      </p>
    </article>
  );
}

async function getDatabaseHealth(canCheckDatabase: boolean): Promise<HealthCheck[]> {
  if (!canCheckDatabase) {
    return [
      {
        label: "Supabase 연결",
        status: "warn",
        value: "확인 보류",
        hint: "Supabase 필수 환경변수를 먼저 등록해 주세요.",
      },
      {
        label: "events 테이블 조회",
        status: "warn",
        value: "확인 보류",
        hint: "Supabase 연결 확인 후 다시 점검해 주세요.",
      },
    ];
  }

  const supabase = createAdminSupabaseClient();
  const checks: HealthCheck[] = [];

  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true });

  checks.push({
    label: "Supabase 연결",
    status: error ? "danger" : "ok",
    value: error ? "연결 확인 실패" : "연결 가능",
    hint: error
      ? "Supabase URL, service role key, 네트워크 상태를 확인해 주세요."
      : "서버에서 Supabase에 연결할 수 있습니다.",
  });

  checks.push({
    label: "events 테이블 조회",
    status: error ? "danger" : "ok",
    value: error
      ? "조회 실패"
      : `${(count ?? 0).toLocaleString("ko-KR")}개 행사 확인`,
    hint: "운영 기본 테이블을 service role 서버 클라이언트로 조회합니다.",
  });

  return checks;
}

export default async function AdminHealthPage() {
  const admin = await requireAdmin();

  if (admin.role !== "super_admin" && admin.role !== "event_admin") {
    redirect("/admin/events");
  }

  const serverEnv = validateServerEnv();
  const publicEnv = validatePublicEnv();
  const canCheckDatabase = !serverEnv.missingRequiredKeys.some((key) =>
    ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].includes(key)
  );
  const databaseChecks = await getDatabaseHealth(canCheckDatabase);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;
  const vercelEnv = process.env.VERCEL_ENV?.trim() || null;
  const hasVercelUrl = Boolean(process.env.VERCEL_URL?.trim());
  const envChecks: HealthCheck[] = serverEnv.checks.map((check) => ({
    label: check.key,
    status: check.present ? "ok" : check.required ? "danger" : "warn",
    value: check.present ? "등록됨" : check.required ? "필수 누락" : "선택 누락",
    hint: check.hint,
  }));
  const appChecks: HealthCheck[] = [
    {
      label: "앱 실행 환경",
      status: process.env.NODE_ENV === "production" ? "ok" : "warn",
      value: process.env.NODE_ENV,
      hint:
        process.env.NODE_ENV === "production"
          ? "프로덕션 모드로 실행 중입니다."
          : "로컬/개발 환경입니다. Vercel 배포 후 production으로 표시되어야 합니다.",
    },
    {
      label: "현재 관리자",
      status: admin.is_active ? "ok" : "danger",
      value: `${admin.name?.trim() || "관리자"} / ${admin.role}`,
      hint: "관리자 이메일이나 인증 토큰은 표시하지 않습니다.",
    },
    {
      label: "현재 시간",
      status: "ok",
      value: formatDateTime(new Date()),
      hint: "Asia/Seoul 기준 운영 확인 시간입니다.",
    },
    {
      label: "Site URL",
      status: siteUrl ? "ok" : "warn",
      value: siteUrl || "미설정",
      hint: "배포 후 QR 안내와 운영 문서에서 사용할 공개 사이트 주소입니다.",
    },
    {
      label: "Vercel Environment",
      status: vercelEnv === "production" ? "ok" : vercelEnv ? "warn" : "warn",
      value: vercelEnv || "로컬 또는 미감지",
      hint: "Vercel 배포 환경에서 production, preview, development 중 하나로 감지됩니다.",
    },
    {
      label: "Vercel URL",
      status: hasVercelUrl ? "ok" : "warn",
      value: hasVercelUrl ? "감지됨" : "미감지",
      hint: "Vercel 시스템 URL은 값 전체를 표시하지 않고 감지 여부만 보여줍니다.",
    },
    {
      label: "screen state API",
      status: publicEnv.ok && serverEnv.ok ? "ok" : "warn",
      value: "/api/screen/[eventCode]/state",
      hint: "행사 코드가 필요한 공개 API입니다. 행사별 스크린에서 실제 호출됩니다.",
    },
  ];
  const deployReady =
    serverEnv.ok && databaseChecks.every((check) => check.status === "ok");

  return (
    <AdminShell
      title="시스템 헬스체크"
      description="배포 전후 필수 환경과 Supabase 연결 상태를 값 노출 없이 확인합니다."
    >
      <div className="grid gap-5">
        <AdminPanel
          title="요약"
          description="secret, key, token 값은 화면에 표시하지 않습니다."
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge tone={deployReady ? "green" : "rose"}>
              {deployReady ? "배포 준비 양호" : "확인 필요"}
            </StatusBadge>
            <StatusBadge tone={serverEnv.ok ? "green" : "rose"}>
              필수 환경변수 {serverEnv.ok ? "등록됨" : "누락"}
            </StatusBadge>
            <StatusBadge tone={publicEnv.missingOptionalKeys.length ? "amber" : "green"}>
              선택 환경변수{" "}
              {publicEnv.missingOptionalKeys.length ? "확인 필요" : "양호"}
            </StatusBadge>
          </div>
        </AdminPanel>

        <AdminPanel title="배포 전 확인">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {envChecks.map((check) => (
              <HealthCard key={check.label} check={check} />
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title="배포 후 확인">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...appChecks, ...databaseChecks].map((check) => (
              <HealthCard key={check.label} check={check} />
            ))}
          </div>
        </AdminPanel>

        <AdminPanel
          title="운영 바로가기"
          description="배포 후 이 링크들을 순서대로 열어 기본 동작을 확인합니다."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link
              href="/admin/events"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm"
            >
              행사 관리
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-800 shadow-sm"
            >
              로그인 화면
            </Link>
            <Link
              href="/admin/events"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-800 shadow-sm"
            >
              리허설은 행사별 페이지에서
            </Link>
            <Link
              href="/admin/events"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-black text-slate-800 shadow-sm"
            >
              운영 로그는 행사별 페이지에서
            </Link>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
