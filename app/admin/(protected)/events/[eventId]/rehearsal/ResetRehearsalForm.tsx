"use client";

import { useActionState } from "react";
import type { ResetRehearsalFormState, ResetTarget } from "./actions";

type ResetRehearsalFormProps = {
  eventCode: string;
  action: (
    previousState: ResetRehearsalFormState,
    formData: FormData
  ) => Promise<ResetRehearsalFormState>;
};

type ResetOption = {
  value: ResetTarget;
  label: string;
  description: string;
};

const RESET_OPTIONS: ResetOption[] = [
  {
    value: "participants",
    label: "참가자 명단 초기화",
    description: "참가자와 참가자 세션 기반 데이터가 삭제될 수 있습니다.",
  },
  {
    value: "quiz_answers",
    label: "퀴즈 답변 초기화",
    description: "참가자의 퀴즈 제출 기록을 삭제합니다.",
  },
  {
    value: "survey_responses",
    label: "설문 응답 초기화",
    description: "survey_responses와 survey_answers를 삭제합니다.",
  },
  {
    value: "qna_questions",
    label: "Q&A 질문 초기화",
    description: "참가자가 제출한 Q&A 질문을 삭제합니다.",
  },
  {
    value: "draw_winners",
    label: "럭키드로우 당첨 기록 초기화",
    description: "draw_winners를 삭제합니다.",
  },
  {
    value: "survey_status",
    label: "설문 진행 상태 초기화",
    description: "설문 상태를 draft로 되돌리고 타이머를 비웁니다.",
  },
  {
    value: "live_state",
    label: "스크린 상태를 대기 화면으로 초기화",
    description: "live_state를 waiting 상태로 바꾸고 screen_payload를 비웁니다.",
  },
];

const initialState: ResetRehearsalFormState = {
  message: null,
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-bold text-rose-700">{message}</p>;
}

export default function ResetRehearsalForm({
  eventCode,
  action,
}: ResetRehearsalFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const expectedConfirmation = `RESET ${eventCode}`;

  return (
    <form
      id="rehearsal-reset-form"
      action={formAction}
      className="grid gap-6"
    >
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-6 text-rose-950">
        이 작업은 되돌릴 수 없습니다. 실제 행사 데이터에 사용하지 않도록
        주의하세요. 처음에는 아무 항목도 선택되어 있지 않으며, 운영자가
        명시적으로 선택해야 합니다.
      </div>

      <div className="grid gap-3">
        {RESET_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4"
          >
            <input
              type="checkbox"
              name="targets"
              value={option.value}
              defaultChecked={state.selectedTargets?.includes(option.value)}
              className="mt-1 h-5 w-5 rounded border-slate-400 text-[#0a1a38]"
            />
            <span>
              <span className="block text-base font-black text-[color:#0a1a38]">
                {option.label}
              </span>
              <span className="mt-1 block text-sm font-bold leading-6 text-slate-700">
                {option.description}
              </span>
            </span>
          </label>
        ))}
        <FieldError message={state.fieldErrors?.targets} />
      </div>

      <div>
        <label
          htmlFor="confirmation"
          className="text-sm font-black text-slate-700"
        >
          확인 문구
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="text"
          defaultValue={state.confirmation ?? ""}
          className="mt-2 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-[color:#0a1a38] shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#0a1a38]"
          placeholder={expectedConfirmation}
          autoComplete="off"
        />
        <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
          실행하려면 정확히 <code>{expectedConfirmation}</code> 를 입력하세요.
        </p>
        <FieldError message={state.fieldErrors?.confirmation} />
      </div>

      {state.message && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {state.message}
        </p>
      )}

      <button
        id="rehearsal-reset-submit"
        type="submit"
        disabled
        aria-busy={isPending}
        className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-rose-600 bg-rose-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
      >
        {isPending ? "초기화 중..." : "선택한 리허설 데이터 초기화"}
      </button>
    </form>
  );
}
