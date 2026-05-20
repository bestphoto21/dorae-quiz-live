"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createEventAction, type EventFormState } from "../actions";

const initialState: EventFormState = {
  message: null,
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-bold text-rose-600">{message}</p>;
}

function labelClasses() {
  return "text-sm font-black text-slate-700";
}

function inputClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-[color:#0a1a38] shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#0a1a38]";
}

export default function NewEventForm() {
  const [state, formAction, isPending] = useActionState(
    createEventAction,
    initialState
  );
  const values = state.values;

  return (
    <form
      key={values ? JSON.stringify(values) : "new-event-form"}
      action={formAction}
      className="grid gap-6"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelClasses()}>
            행사명 *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            className={inputClasses()}
            placeholder="도래 실시간 퀴즈"
            defaultValue={values?.title ?? ""}
          />
          <FieldError message={state.fieldErrors?.title} />
        </div>

        <div>
          <label htmlFor="event_code" className={labelClasses()}>
            행사 코드 *
          </label>
          <input
            id="event_code"
            name="event_code"
            type="text"
            required
            pattern="[a-z0-9-]+"
            className={inputClasses()}
            placeholder="dorae-2026"
            defaultValue={values?.event_code ?? ""}
          />
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            소문자 영문, 숫자, 하이픈만 사용할 수 있습니다.
          </p>
          <FieldError message={state.fieldErrors?.event_code} />
        </div>

        <div>
          <label htmlFor="subtitle" className={labelClasses()}>
            부제
          </label>
          <input
            id="subtitle"
            name="subtitle"
            type="text"
            className={inputClasses()}
            placeholder="참가자와 함께하는 라이브 이벤트"
            defaultValue={values?.subtitle ?? ""}
          />
        </div>

        <div>
          <label htmlFor="venue" className={labelClasses()}>
            장소
          </label>
          <input
            id="venue"
            name="venue"
            type="text"
            className={inputClasses()}
            placeholder="메인홀"
            defaultValue={values?.venue ?? ""}
          />
        </div>

        <div>
          <label htmlFor="starts_at" className={labelClasses()}>
            시작 시간
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            className={inputClasses()}
            defaultValue={values?.starts_at ?? ""}
          />
          <FieldError message={state.fieldErrors?.starts_at} />
        </div>

        <div>
          <label htmlFor="ends_at" className={labelClasses()}>
            종료 시간
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            className={inputClasses()}
            defaultValue={values?.ends_at ?? ""}
          />
          <FieldError message={state.fieldErrors?.ends_at} />
        </div>

        <div>
          <label htmlFor="primary_color" className={labelClasses()}>
            대표 색상
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="primary_color"
              name="primary_color"
              type="color"
              defaultValue={values?.primary_color ?? "#0a1a38"}
              className="h-12 w-16 rounded-2xl border border-slate-400 bg-white p-1 shadow-sm"
            />
            <p className="text-sm font-bold text-slate-600">
              기본값은 진한 슬레이트입니다.
            </p>
          </div>
          <FieldError message={state.fieldErrors?.primary_color} />
        </div>

        <div>
          <label htmlFor="logo_url" className={labelClasses()}>
            로고 URL
          </label>
          <input
            id="logo_url"
            name="logo_url"
            type="url"
            className={inputClasses()}
            placeholder="https://example.com/logo.png"
            defaultValue={values?.logo_url ?? ""}
          />
        </div>
      </div>

      <div>
        <label htmlFor="screen_notice" className={labelClasses()}>
          스크린 공지 문구
        </label>
        <textarea
          id="screen_notice"
          name="screen_notice"
          rows={4}
          className={`${inputClasses()} resize-y leading-7`}
          placeholder="현장 송출 화면에 표시할 안내 문구"
          defaultValue={values?.screen_notice ?? ""}
        />
      </div>

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
        시작/종료 시간은 참가자 안내와 운영 기준용입니다. 실제 퀴즈 시작,
        마감, 정답 공개, Q&A 송출, 럭키드로우 진행은 라이브 콘솔에서 직접
        제어합니다.
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={values?.is_active ?? true}
          className="mt-1 h-5 w-5 rounded border-slate-300"
        />
        <span>
          <span className="block text-base font-black text-[color:#0a1a38]">
            활성 행사로 생성
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            행사를 완전히 막으려면 비활성 상태로 생성하세요. 비활성 행사는
            참가자 입장과 스크린 송출이 제한됩니다.
          </span>
        </span>
      </label>

      {state.message && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/admin/events"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm transition hover:border-[#0a1a38] hover:bg-slate-50"
        >
          취소
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {isPending ? "생성 중..." : "행사 만들기"}
        </button>
      </div>
    </form>
  );
}
