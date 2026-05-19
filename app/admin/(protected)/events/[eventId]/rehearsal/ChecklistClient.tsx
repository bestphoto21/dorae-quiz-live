"use client";

import { useEffect, useState } from "react";

type ChecklistClientProps = {
  eventId: string;
};

const CHECK_ITEMS = [
  "관리자 로그인 확인",
  "참가자 입장 URL 접속 확인",
  "스크린 URL 새 창 확인",
  "대기 화면 전환 확인",
  "휴식 화면 전환 확인",
  "퀴즈 문제 송출 확인",
  "정답 공개 전 정답 필드 미노출 확인",
  "정답 공개 후 정답 필드 노출 확인",
  "Q&A 대기 화면 확인",
  "미승인 Q&A 질문이 스크린에 안 나오는지 확인",
  "승인 Q&A 질문 송출 확인",
  "럭키드로우 준비 화면 확인",
  "당첨자 송출 확인",
  "휴대폰 원본/정규화 번호 노출 없음 확인",
  "현장 네트워크 확인",
  "스크린 노트북 절전모드 해제 확인",
];

export default function ChecklistClient({ eventId }: ChecklistClientProps) {
  const storageKey = `dorae-quiz-live:rehearsal:${eventId}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(
    () => {
      if (typeof window === "undefined") {
        return {};
      }

      try {
        const rawValue = window.localStorage.getItem(storageKey);

        if (rawValue) {
          return JSON.parse(rawValue) as Record<string, boolean>;
        }
      } catch {
        return {};
      }

      return {};
    }
  );

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checkedItems));
  }, [checkedItems, storageKey]);

  const completedCount = CHECK_ITEMS.filter((item) => checkedItems[item]).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-950">
            필수 리허설 체크리스트
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            이 체크 상태는 현재 브라우저에만 저장됩니다. 운영 PC가 바뀌면 다시
            확인해 주세요.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700">
          {completedCount}/{CHECK_ITEMS.length} 완료
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {CHECK_ITEMS.map((item) => (
          <label
            key={item}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-black shadow-sm transition ${
              checkedItems[item]
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(checkedItems[item])}
              onChange={(event) =>
                setCheckedItems((current) => ({
                  ...current,
                  [item]: event.target.checked,
                }))
              }
              className="h-5 w-5 rounded border-slate-300"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setCheckedItems({})}
        className="mt-5 min-h-11 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-950"
      >
        체크 상태 초기화
      </button>
    </section>
  );
}
