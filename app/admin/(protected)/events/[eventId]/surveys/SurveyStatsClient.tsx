"use client";

import { useEffect, useMemo, useState } from "react";

type SurveyStats = {
  survey_form_id: string;
  status: "draft" | "open" | "closed" | "archived";
  submitted_count: number;
  participant_count: number;
  submitted_rate: number;
  active_started_at: string | null;
  active_ends_at: string | null;
  closed_at: string | null;
  server_now: string;
  remaining_seconds: number;
  is_closed: boolean;
};

type SurveyStatsClientProps = {
  eventId: string;
  surveyFormId: string;
  initialStats: SurveyStats;
};

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function statusLabel(status: SurveyStats["status"], isClosed: boolean) {
  if (isClosed && status === "open") {
    return "마감";
  }

  if (status === "open") {
    return "진행 중";
  }

  if (status === "closed") {
    return "마감";
  }

  if (status === "archived") {
    return "보관";
  }

  return "작성 중";
}

export function SurveyStatsClient({
  eventId,
  surveyFormId,
  initialStats,
}: SurveyStatsClientProps) {
  const [stats, setStats] = useState(initialStats);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    let timeoutId: number | null = null;

    async function fetchStats() {
      try {
        const response = await fetch(
          `/api/admin/events/${encodeURIComponent(eventId)}/surveys/${encodeURIComponent(
            surveyFormId
          )}/stats`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const body = (await response.json()) as {
            ok: boolean;
            stats?: SurveyStats;
          };

          if (active && body.ok && body.stats) {
            setStats(body.stats);
          }
        }
      } finally {
        if (active) {
          timeoutId = window.setTimeout(fetchStats, 2000);
        }
      }
    }

    timeoutId = window.setTimeout(fetchStats, 1200);

    return () => {
      active = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [eventId, surveyFormId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!stats.active_ends_at) {
      return stats.remaining_seconds;
    }

    return Math.max(
      0,
      Math.ceil((Date.parse(stats.active_ends_at) - now) / 1000)
    );
  }, [now, stats.active_ends_at, stats.remaining_seconds]);
  const isClosed =
    stats.is_closed || stats.status === "closed" || stats.status === "archived";

  return (
    <div className="grid gap-4 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 text-[color:#0a1a38]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-cyan-900">실시간 제출률</p>
          <p className="mt-2 text-4xl font-black">
            {stats.submitted_rate.toLocaleString("ko-KR")}%
          </p>
        </div>
        <span className="rounded-full bg-[#0a1a38] px-4 py-2 text-sm font-black text-white">
          {statusLabel(stats.status, isClosed)}
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-500"
          style={{ width: `${stats.submitted_rate}%` }}
        />
      </div>
      <div className="grid gap-3 text-sm font-black sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4">
          제출 {stats.submitted_count.toLocaleString("ko-KR")}명 / 입장{" "}
          {stats.participant_count.toLocaleString("ko-KR")}명
        </div>
        <div className="rounded-2xl bg-white p-4">
          {isClosed ? "마감됨" : `남은 시간 ${formatSeconds(remainingSeconds)}`}
        </div>
      </div>
    </div>
  );
}
