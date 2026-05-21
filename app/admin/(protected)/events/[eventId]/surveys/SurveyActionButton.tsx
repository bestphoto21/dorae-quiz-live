"use client";

import { useFormStatus } from "react-dom";

type SurveyActionButtonProps = {
  children: string;
  pendingLabel?: string;
  tone?: "dark" | "amber" | "rose" | "outline";
  disabled?: boolean;
};

export function SurveyActionButton({
  children,
  pendingLabel = "처리 중...",
  tone = "dark",
  disabled = false,
}: SurveyActionButtonProps) {
  const { pending } = useFormStatus();
  const classes = {
    dark: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    amber:
      "border-amber-500 bg-amber-400 text-[color:#0a1a38] hover:bg-amber-300",
    rose: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    outline:
      "border-[#0a1a38] bg-white text-[color:#0a1a38] hover:bg-slate-100",
  };

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`min-h-11 rounded-2xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 ${classes[tone]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
