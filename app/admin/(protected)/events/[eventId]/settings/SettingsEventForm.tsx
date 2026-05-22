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
  screen_title: string | null;
  screen_subtitle: string | null;
  screen_waiting_message: string | null;
  screen_break_message: string | null;
  screen_join_message: string | null;
  screen_survey_message: string | null;
  screen_qna_message: string | null;
  screen_draw_message: string | null;
  screen_footer_message: string | null;
  screen_show_logo: boolean | null;
  participant_title: string | null;
  participant_description: string | null;
  participant_show_quiz: boolean | null;
  participant_show_qna: boolean | null;
  participant_show_survey: boolean | null;
  participant_show_draw: boolean | null;
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
  return "mt-2 w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-bold text-[color:#0a1a38] shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[#0a1a38]";
}

function featureChecked(
  value: boolean | undefined,
  eventValue: boolean | null
) {
  return value ?? eventValue ?? true;
}

export default function SettingsEventForm({
  event,
  action,
}: SettingsEventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const values = state.values;

  return (
    <form
      key={values ? JSON.stringify(values) : `settings-event-form-${event.id}`}
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
            defaultValue={values?.title ?? event.title}
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
            defaultValue={values?.subtitle ?? event.subtitle ?? ""}
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
            defaultValue={values?.venue ?? event.venue ?? ""}
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
            defaultValue={values?.starts_at ?? toDateTimeLocal(event.starts_at)}
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
            defaultValue={values?.ends_at ?? toDateTimeLocal(event.ends_at)}
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
              defaultValue={
                values?.primary_color ?? event.primary_color ?? "#0a1a38"
              }
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
            defaultValue={values?.logo_url ?? event.logo_url ?? ""}
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
          defaultValue={values?.screen_notice ?? event.screen_notice ?? ""}
          className={`${inputClasses()} resize-y leading-7`}
        />
      </div>

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h2 className="text-xl font-black text-[color:#0a1a38]">
            스크린 화면 설정
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            행사장 대형 스크린에 표시되는 제목과 안내 문구를 설정합니다. 행사
            유형에 맞게 대기, QR, 설문, Q&A, 추첨 화면의 문구를 바꿀 수
            있습니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="screen_title" className={labelClasses()}>
              스크린 제목
            </label>
            <input
              id="screen_title"
              name="screen_title"
              type="text"
              defaultValue={values?.screen_title ?? event.screen_title ?? ""}
              className={inputClasses()}
              placeholder="실시간 참여 이벤트"
            />
          </div>

          <div>
            <label htmlFor="screen_subtitle" className={labelClasses()}>
              스크린 보조 문구
            </label>
            <input
              id="screen_subtitle"
              name="screen_subtitle"
              type="text"
              defaultValue={
                values?.screen_subtitle ?? event.screen_subtitle ?? ""
              }
              className={inputClasses()}
              placeholder="QR을 찍고 행사에 참여해주세요."
            />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="screen_waiting_message" className={labelClasses()}>
              대기 화면 문구
            </label>
            <textarea
              id="screen_waiting_message"
              name="screen_waiting_message"
              rows={2}
              defaultValue={
                values?.screen_waiting_message ??
                event.screen_waiting_message ??
                ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="잠시 후 행사가 시작됩니다."
            />
          </div>

          <div>
            <label htmlFor="screen_break_message" className={labelClasses()}>
              휴식 화면 문구
            </label>
            <textarea
              id="screen_break_message"
              name="screen_break_message"
              rows={2}
              defaultValue={
                values?.screen_break_message ??
                event.screen_break_message ??
                ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="잠시 쉬어가겠습니다."
            />
          </div>

          <div>
            <label htmlFor="screen_join_message" className={labelClasses()}>
              QR 입장 안내 문구
            </label>
            <textarea
              id="screen_join_message"
              name="screen_join_message"
              rows={2}
              defaultValue={
                values?.screen_join_message ?? event.screen_join_message ?? ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="화면의 QR을 찍고 입장해주세요."
            />
          </div>

          <div>
            <label htmlFor="screen_survey_message" className={labelClasses()}>
              설문 안내 문구
            </label>
            <textarea
              id="screen_survey_message"
              name="screen_survey_message"
              rows={2}
              defaultValue={
                values?.screen_survey_message ??
                event.screen_survey_message ??
                ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="지금부터 1분간 설문조사를 진행합니다."
            />
          </div>

          <div>
            <label htmlFor="screen_qna_message" className={labelClasses()}>
              Q&A 안내 문구
            </label>
            <textarea
              id="screen_qna_message"
              name="screen_qna_message"
              rows={2}
              defaultValue={
                values?.screen_qna_message ?? event.screen_qna_message ?? ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="질문을 남겨주시면 진행자가 확인 후 소개합니다."
            />
          </div>

          <div>
            <label htmlFor="screen_draw_message" className={labelClasses()}>
              럭키드로우 안내 문구
            </label>
            <textarea
              id="screen_draw_message"
              name="screen_draw_message"
              rows={2}
              defaultValue={
                values?.screen_draw_message ?? event.screen_draw_message ?? ""
              }
              className={`${inputClasses()} resize-y leading-7`}
              placeholder="곧 경품 추첨을 진행합니다."
            />
          </div>
        </div>

        <div>
          <label htmlFor="screen_footer_message" className={labelClasses()}>
            푸터 문구
          </label>
          <input
            id="screen_footer_message"
            name="screen_footer_message"
            type="text"
            defaultValue={
              values?.screen_footer_message ??
              event.screen_footer_message ??
              ""
            }
            className={inputClasses()}
            placeholder="참여해주셔서 감사합니다."
          />
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
          <input
            name="screen_show_logo"
            type="checkbox"
            defaultChecked={featureChecked(
              values?.screen_show_logo,
              event.screen_show_logo
            )}
            className="mt-1 h-5 w-5 rounded border-slate-300"
          />
          <span>
            <span className="block text-base font-black text-[color:#0a1a38]">
              로고 표시
            </span>
            <span className="mt-1 block text-sm leading-6 text-slate-600">
              로고 URL이 있을 때 행사장 스크린 상단에 로고를 표시합니다.
            </span>
          </span>
        </label>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
          설문+추첨 행사는 설문 안내와 추첨 안내 문구를 강조하고, 퀴즈쇼
          행사는 QR 입장 안내와 퀴즈 참여 문구를 강조하는 구성을 권장합니다.
          포럼/Q&A 행사는 Q&A 안내 문구를 먼저 맞춰주세요.
        </div>
      </section>

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <h2 className="text-xl font-black text-[color:#0a1a38]">
            참가자 화면 설정
          </h2>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
            참가자들이 QR 입장 후 보는 화면의 제목과 표시 기능을 설정합니다.
            행사 유형에 맞지 않는 기능은 숨길 수 있습니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="participant_title" className={labelClasses()}>
              참가자 화면 제목
            </label>
            <input
              id="participant_title"
              name="participant_title"
              type="text"
              defaultValue={
                values?.participant_title ?? event.participant_title ?? ""
              }
              className={inputClasses()}
              placeholder="설문 참여 이벤트"
            />
          </div>

          <div>
            <label htmlFor="participant_description" className={labelClasses()}>
              참가자 화면 설명
            </label>
            <input
              id="participant_description"
              name="participant_description"
              type="text"
              defaultValue={
                values?.participant_description ??
                event.participant_description ??
                ""
              }
              className={inputClasses()}
              placeholder="설문을 제출하신 분들을 대상으로 경품 추첨이 진행됩니다."
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
            <input
              name="participant_show_quiz"
              type="checkbox"
              defaultChecked={featureChecked(
                values?.participant_show_quiz,
                event.participant_show_quiz
              )}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              <span className="block text-base font-black text-[color:#0a1a38]">
                퀴즈 사용
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                참가자 퀴즈 화면과 답변 제출을 표시합니다.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
            <input
              name="participant_show_qna"
              type="checkbox"
              defaultChecked={featureChecked(
                values?.participant_show_qna,
                event.participant_show_qna
              )}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              <span className="block text-base font-black text-[color:#0a1a38]">
                Q&A 사용
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                참가자 질문 제출 영역을 표시합니다.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
            <input
              name="participant_show_survey"
              type="checkbox"
              defaultChecked={featureChecked(
                values?.participant_show_survey,
                event.participant_show_survey
              )}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              <span className="block text-base font-black text-[color:#0a1a38]">
                설문 사용
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                진행 중인 설문 안내와 설문 참여 화면을 표시합니다.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
            <input
              name="participant_show_draw"
              type="checkbox"
              defaultChecked={featureChecked(
                values?.participant_show_draw,
                event.participant_show_draw
              )}
              className="mt-1 h-5 w-5 rounded border-slate-300"
            />
            <span>
              <span className="block text-base font-black text-[color:#0a1a38]">
                럭키드로우 안내 사용
              </span>
              <span className="mt-1 block text-sm leading-6 text-slate-600">
                참가자 화면에 경품 추첨 안내를 표시합니다.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
          설문+추첨 행사는 설문과 럭키드로우 안내를 켜고 퀴즈, Q&A를 끌 수
          있습니다. 퀴즈쇼는 퀴즈, Q&A, 럭키드로우 안내를 켜고 간담회는 Q&A와
          설문을 켜는 구성을 권장합니다.
        </div>
      </section>

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold leading-6 text-cyan-950">
        시작/종료 시간은 참가자 안내와 운영 기준용입니다. 실제 퀴즈 시작,
        마감, 정답 공개, Q&A 송출, 럭키드로우 진행은 라이브 콘솔에서 직접
        제어합니다.
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          name="is_active"
          type="checkbox"
          defaultChecked={values?.is_active ?? event.is_active ?? true}
          className="mt-1 h-5 w-5 rounded border-slate-300"
        />
        <span>
          <span className="block text-base font-black text-[color:#0a1a38]">
            활성 행사
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600">
            행사를 완전히 막으려면 비활성 상태로 전환하세요. 비활성 행사는
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
          href={`/admin/events/${event.id}`}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-400 bg-white px-5 py-3 text-base font-black text-[color:#0a1a38] shadow-sm transition hover:border-[#0a1a38] hover:bg-slate-50"
        >
          개요로 돌아가기
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#0a1a38] bg-[#0a1a38] px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-[#10284f] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-700"
        >
          {isPending ? "저장 중..." : "변경사항 저장"}
        </button>
      </div>
    </form>
  );
}
