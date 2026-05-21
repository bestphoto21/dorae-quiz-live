"use client";

import { useFormStatus } from "react-dom";

export function SurveySubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-14 rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-lg font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
    >
      {pending ? "제출 중..." : "설문 제출"}
    </button>
  );
}
