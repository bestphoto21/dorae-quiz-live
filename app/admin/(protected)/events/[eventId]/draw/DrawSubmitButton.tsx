"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function DrawSubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [sourceType, setSourceType] = useState("all_participants");

  useEffect(() => {
    const form = buttonRef.current?.form;
    const select = form?.elements.namedItem("source_type");

    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const updateSourceType = () => setSourceType(select.value);
    updateSourceType();
    select.addEventListener("change", updateSourceType);

    return () => select.removeEventListener("change", updateSourceType);
  }, []);

  const label =
    sourceType === "survey_respondents"
      ? "설문 제출자 중 추첨 실행"
      : "추첨 실행 및 연출 시작";

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="min-h-11 rounded-2xl border border-amber-500 bg-amber-400 px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
    >
      {pending ? "추첨 실행 중..." : label}
    </button>
  );
}
