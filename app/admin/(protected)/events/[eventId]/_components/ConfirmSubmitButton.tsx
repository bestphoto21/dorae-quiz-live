"use client";

import { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  children: string;
  confirmMessage?: string;
  pendingLabel?: string;
  tone?: "dark" | "cyan" | "amber" | "rose" | "outline" | "secondary";
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
};

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel = "처리 중...",
  tone = "dark",
  disabled = false,
  fullWidth = false,
  size = "md",
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const classes = {
    dark: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    cyan: "border-[#0a1a38] bg-[#0a1a38] text-white hover:bg-[#10284f]",
    amber:
      "border-amber-500 bg-amber-400 text-[color:#0a1a38] hover:bg-amber-300",
    rose: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    outline:
      "border-[#0a1a38] bg-white text-[color:#0a1a38] hover:bg-slate-100",
    secondary:
      "border-slate-400 bg-white text-[color:#0a1a38] hover:border-[#0a1a38] hover:bg-slate-50",
  };
  const sizes = {
    sm: "min-h-10 px-4 py-2 text-sm",
    md: "min-h-11 px-4 py-2 text-sm",
    lg: "min-h-12 px-5 py-3 text-base",
  };

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!confirmMessage || pending || disabled) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={handleClick}
      className={`${fullWidth ? "w-full" : ""} rounded-2xl border font-black shadow-sm transition disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700 ${sizes[size]} ${classes[tone]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
