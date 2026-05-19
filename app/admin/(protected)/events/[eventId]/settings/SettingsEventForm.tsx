"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EventFormState } from "../../actions";

type EditableEvent = {
  id: string;
  event_code: string;
  title: string;
  subtitle: string | null;
  venue: string | null;
  starts_at: string | null;
  ends_at: string | null;
  primary_color: string | null;
  logo_url: string | null;
  screen_notice: string | null;
  is_active: boolean | null;
};

type SettingsEventFormProps = {
  event: EditableEvent;
  action: (
    previousState: EventFormState,
    formData: FormData
  ) => Promise<EventFormState>;
};

const initialState: EventFormState = {
  message: null,
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-bold text-rose-600">{message}</p>;
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${partMap.year}-${partMap.month}-${partMap.day}T${partMap.hour}:${partMap.minute}`;
}

function labelClasses() {
  return "text-sm font-black text-slate-700";
}

function inputClasses() {
  return "mt-2 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-slate-950";
}

export default function SettingsEventForm({
  event,
  action,
}: SettingsEventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-6">
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
            defaultValue={event.title}
            className={inputClasses()}
          />
          <FieldError message={state.fieldErrors?.title} />
        </div>

        <div>
          <label htmlFor="event_code_display" className={labelClasses()}>
            행사 코드
          </label>
          <input
            id="event_code_display"
            type="text"
            value={event.event_code}
            readOnly
            className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-black text-slate-600 shadow-sm"
          />
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            QR과 참가자 URL 안정성을 위해 행사 코드는 생성 후 수정하지 않습니다.
          </p>
        </div>

        <div>
          <label htmlFor="subtitle" className={labelClasses()}>
            부제
          </label>
          <input
            id="subtitle"
            name="subtitle"
            type="text"
            defaultValue={event.subtitle ?? ""}
            className={inputClasses()}
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
            defaultValue={event.venue ?? ""}
            className={inputClasses()}
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
            defaultValue={toDateTimeLocal(event.starts_at)}
            className={inputClasses()}
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
            defaultValue={toDateTimeLocal(event.ends_at)}
            className={inputClasses()}
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
              defaultValue={event.primary_color ?? "#0f172a"}
              className="h-12 w-16 rounded-2xl border border-slate-400 bg-white p-1 shadow-sm"
            />
            <p className="text-sm font-bold text-slate-600">
              스크린과 참가자 화면의 기본 강조색으로 사용할 예정입니다.
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
            defaultValue={event.logo_url ?? ""}
            className={inputClasses()}
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
          defaultValue={event.screen_notice ?? ""}
          className={`${inputClasses()} resize-y leading-7`}
        />
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={event.is_active ?? true}
          className="mt-1 h-5 w-5 rounded border-slate-300"
        />
        <span>
          <span className="block text-base font-black text-slate-950">
            활성 행사
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            비활성으로 저장하면 다음 단계에서 참가자 입장을 막는 기준으로
            사용할 예정입니다. 현재는 관리자 표시 상태만 바뀝니다.
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
          href={`/admin/events/${event.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-slate-950 shadow-sm transition hover:border-slate-950 hover:bg-slate-50"
        >
          개요로 돌아가기
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-950 bg-slate-950 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {isPending ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </form>
  );
}
