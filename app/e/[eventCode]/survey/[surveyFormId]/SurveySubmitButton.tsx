"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useMemo, useState } from "react";

function formatSeconds(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function SurveySubmitButton({ endsAt }: { endsAt: string | null }) {
  const { pending } = useFormStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!endsAt) {
      return null;
    }

    return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
  }, [endsAt, now]);
  const expired = remainingSeconds === 0;

  return (
    <div className="grid gap-3">
      {remainingSeconds !== null && (
        <p className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-black text-cyan-950">
          남은 시간 {formatSeconds(remainingSeconds)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || expired}
        aria-busy={pending}
        className="min-h-14 rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-lg font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
      >
        {expired ? "설문 시간이 종료되었습니다" : pending ? "제출 중..." : "설문 제출"}
      </button>
    </div>
  );
}
