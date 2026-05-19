type EnvCheck = {
  key: string;
  required: boolean;
  present: boolean;
  scope: "public" | "server";
  hint: string;
};

const PUBLIC_ENV_KEYS = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    hint: "Supabase Project URL을 등록해 주세요.",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    hint: "Supabase publishable 또는 anon public key를 등록해 주세요.",
  },
  {
    key: "NEXT_PUBLIC_SITE_URL",
    required: false,
    hint: "배포 후 전체 URL 안내에 사용할 사이트 주소입니다.",
  },
] as const;

const SERVER_ENV_KEYS = [
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    hint: "서버 전용 Supabase service role key를 Vercel 환경변수에 등록해 주세요.",
  },
  {
    key: "PARTICIPANT_SESSION_SECRET",
    required: true,
    hint: "참가자 세션 쿠키 서명용 서버 전용 secret을 등록해 주세요.",
  },
] as const;

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function toCheck({
  key,
  required,
  hint,
  scope,
}: {
  key: string;
  required: boolean;
  hint: string;
  scope: "public" | "server";
}): EnvCheck {
  return {
    key,
    required,
    present: hasValue(process.env[key]),
    scope,
    hint,
  };
}

function summarize(checks: EnvCheck[]) {
  const missingRequiredKeys = checks
    .filter((check) => check.required && !check.present)
    .map((check) => check.key);
  const missingOptionalKeys = checks
    .filter((check) => !check.required && !check.present)
    .map((check) => check.key);

  return {
    ok: missingRequiredKeys.length === 0,
    missingRequiredKeys,
    missingOptionalKeys,
    checks,
  };
}

export function validatePublicEnv() {
  return summarize(
    PUBLIC_ENV_KEYS.map((item) => toCheck({ ...item, scope: "public" }))
  );
}

export function validateServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("validateServerEnv must never run in the browser.");
  }

  return summarize([
    ...PUBLIC_ENV_KEYS.map((item) => toCheck({ ...item, scope: "public" })),
    ...SERVER_ENV_KEYS.map((item) => toCheck({ ...item, scope: "server" })),
  ]);
}
