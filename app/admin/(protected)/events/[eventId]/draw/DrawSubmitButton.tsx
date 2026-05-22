"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
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

  const description =
    sourceType === "survey_respondents"
      ? "설문 제출자 중에서 새로운 당첨자를 뽑습니다."
      : "선택한 대상에서 새로운 당첨자를 뽑습니다.";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (disabled || pending) {
      return;
    }

    if (
      !window.confirm(
        "새 당첨자를 추첨합니다. 이 작업은 새로운 당첨자를 생성합니다. 진행할까요?"
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-black text-amber-950">새 당첨자 추첨 실행</p>
      <p className="mt-1 text-xs font-bold leading-5 text-amber-900">
        선택한 대상에서 새로운 당첨자를 뽑고 스크린에 발표합니다. {description}
      </p>
      <button
        ref={buttonRef}
        type="submit"
        disabled={disabled || pending}
        aria-busy={pending}
        onClick={handleClick}
        className="mt-3 min-h-12 w-full rounded-2xl border border-amber-500 bg-amber-400 px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
      >
        {pending ? "추첨 실행 중..." : "새 당첨자 추첨 실행"}
      </button>
    </div>
  );
}
