"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CloneEventFormState } from "./actions";

type CloneEventFormProps = {
  eventId: string;
  defaultTitle: string;
  defaultEventCode: string;
  action: (
    previousState: CloneEventFormState,
    formData: FormData
  ) => Promise<CloneEventFormState>;
};

const initialState: CloneEventFormState = {
  message: null,
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-bold text-rose-600">{message}</p>;
}

function inputClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-[color:#0a1a38] shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#0a1a38]";
}

export default function CloneEventForm({
  eventId,
  defaultTitle,
  defaultEventCode,
  action,
}: CloneEventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values;

  return (
    <form
      action={formAction}
      className="grid gap-6"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "이 행사의 설정만 복제합니다. 참가자, 응답, 당첨자, 운영 로그는 복제되지 않습니다. 새 행사를 만들까요?"
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label htmlFor="title" className="text-sm font-black text-slate-700">
            새 행사명 *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={values?.title ?? defaultTitle}
            className={inputClasses()}
            placeholder="새 행사명을 입력하세요"
          />
          <FieldError message={state.fieldErrors?.title} />
        </div>

        <div>
          <label
            htmlFor="event_code"
            className="text-sm font-black text-slate-700"
          >
            새 행사 코드 *
          </label>
          <input
            id="event_code"
            name="event_code"
            type="text"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9-]+"
            defaultValue={values?.event_code ?? defaultEventCode}
            className={inputClasses()}
            placeholder="company-meeting-202606"
          />
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            영문 소문자, 숫자, 하이픈만 사용합니다. 공백과 특수문자는 사용할 수
            없습니다.
          </p>
          <FieldError message={state.fieldErrors?.event_code} />
        </div>
      </div>

      {state.message && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={`/admin/events/${eventId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm transition hover:border-[#0a1a38] hover:bg-slate-50"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {isPending ? "복제 중..." : "행사 복제하기"}
        </button>
      </div>
    </form>
  );
}
