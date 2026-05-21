"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MobileCard, StatusBadge } from "@/components/quiz/ui";

type ActiveSurveyPrompt = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  active_started_at: string | null;
  active_ends_at: string | null;
  closed_at: string | null;
  survey_url: string;
  submitted: boolean;
  remaining_seconds: number;
  server_now: string;
};

type SurveyPromptClientProps = {
  eventCode: string;
  initialSurvey: ActiveSurveyPrompt | null;
};

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function SurveyPromptClient({
  eventCode,
  initialSurvey,
}: SurveyPromptClientProps) {
  const [survey, setSurvey] = useState(initialSurvey);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let timeoutId: number | null = null;

    async function fetchSurvey() {
      try {
        const response = await fetch(
          `/api/participant/${encodeURIComponent(eventCode)}/surveys/active`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const body = (await response.json()) as {
            ok: boolean;
            survey: ActiveSurveyPrompt | null;
          };

          if (active && body.ok) {
            setSurvey(body.survey);
          }
        }
      } finally {
        if (active) {
          timeoutId = window.setTimeout(fetchSurvey, 2500);
        }
      }
    }

    timeoutId = window.setTimeout(fetchSurvey, 1500);

    return () => {
      active = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [eventCode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!survey?.active_ends_at) {
      return survey?.remaining_seconds ?? 0;
    }

    return Math.max(
      0,
      Math.ceil((Date.parse(survey.active_ends_at) - now) / 1000)
    );
  }, [now, survey?.active_ends_at, survey?.remaining_seconds]);

  if (!survey) {
    return null;
  }

  return (
    <MobileCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <StatusBadge tone={survey.submitted ? "green" : "cyan"}>
            {survey.submitted ? "설문 제출 완료" : "진행 중인 설문"}
          </StatusBadge>
          <h2 className="mt-3 text-2xl font-black text-[color:#0a1a38]">
            {survey.title}
          </h2>
          {survey.description && (
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
              {survey.description}
            </p>
          )}
          <p className="mt-3 text-sm font-black text-cyan-800">
            {survey.submitted
              ? "이미 제출했습니다."
              : `남은 시간 ${formatSeconds(remainingSeconds)}`}
          </p>
        </div>
        {survey.submitted ? (
          <span className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-900">
            제출 완료
          </span>
        ) : (
          <Link
            href={survey.survey_url}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#10284f]"
          >
            설문 참여하기
          </Link>
        )}
      </div>
    </MobileCard>
  );
}
