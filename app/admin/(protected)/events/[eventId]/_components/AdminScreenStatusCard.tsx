import Link from "next/link";
import { StatusBadge } from "@/components/quiz/ui";

type AdminScreenStatusCardProps = {
  mode: string | null | undefined;
  screenScene: string | null | undefined;
  updatedAt: string | null | undefined;
  screenUrl: string;
  eventCode: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "기록 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function modeLabel(mode: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기",
    question: "퀴즈 진행",
    closed: "응답 마감",
    result: "결과 공개",
    draw: "럭키드로우",
    qna: "Q&A",
    survey: "설문",
  };

  return labels[mode ?? "waiting"] ?? "대기";
}

function sceneLabel(scene: string | null | undefined) {
  const labels: Record<string, string> = {
    waiting: "대기 화면",
    break: "휴식 화면",
    join_qr: "QR 입장 안내",
    question: "퀴즈 문제 화면",
    closed: "응답 마감 화면",
    result: "결과 화면",
    qna: "Q&A 접수 화면",
    qna_waiting: "Q&A 접수 화면",
    qna_question: "Q&A 질문 송출 화면",
    draw: "럭키드로우 준비 화면",
    draw_winner: "럭키드로우 당첨 발표 화면",
    survey_intro: "설문 참여 안내 화면",
    survey_active: "1분 설문 진행 화면",
    survey_status: "설문 제출 현황 화면",
    survey_closed: "설문 마감 화면",
    inactive: "비활성 화면",
  };

  return labels[scene ?? "waiting"] ?? "대기 화면";
}

function sceneDescription(scene: string | null | undefined) {
  const descriptions: Record<string, string> = {
    waiting: "대기 화면 송출 중",
    break: "휴식 화면 송출 중",
    join_qr: "QR 입장 안내 송출 중",
    question: "퀴즈 문제 송출 중",
    closed: "퀴즈 응답 마감 화면 송출 중",
    result: "퀴즈 결과 화면 송출 중",
    qna: "Q&A 접수 화면 송출 중",
    qna_waiting: "Q&A 접수 화면 송출 중",
    qna_question: "Q&A 송출 중",
    draw: "럭키드로우 준비 화면 송출 중",
    draw_winner: "럭키드로우 당첨 발표 송출 중",
    survey_intro: "설문 참여 안내 송출 중",
    survey_active: "1분 설문 진행 중",
    survey_status: "설문 제출 현황 송출 중",
    survey_closed: "설문 마감 화면 송출 중",
    inactive: "행사 비활성 화면 송출 중",
  };

  return descriptions[scene ?? "waiting"] ?? "대기 화면 송출 중";
}

export function AdminScreenStatusCard({
  mode,
  screenScene,
  updatedAt,
  screenUrl,
  eventCode,
}: AdminScreenStatusCardProps) {
  const scene = screenScene ?? mode ?? "waiting";

  return (
    <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-black text-cyan-800">현재 스크린 송출 상태</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-[color:#0a1a38]">
            {sceneDescription(scene)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-cyan-950">
            현재 화면과 마지막 변경 시각을 먼저 확인한 뒤 송출 버튼을 눌러주세요.
          </p>
        </div>
        <Link
          href={screenUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-[#0a1a38] bg-white px-4 py-2 text-sm font-black text-[color:#0a1a38] shadow-sm transition hover:bg-slate-100"
        >
          스크린 열기
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-cyan-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">현재 모드</p>
          <p className="mt-2 text-base font-black text-[color:#0a1a38]">
            {modeLabel(mode)}
          </p>
          {mode && (
            <p className="mt-1 text-xs font-bold text-slate-500">mode: {mode}</p>
          )}
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">현재 화면</p>
          <p className="mt-2 text-base font-black text-[color:#0a1a38]">
            {sceneLabel(scene)}
          </p>
          {scene && (
            <p className="mt-1 text-xs font-bold text-slate-500">
              scene: {scene}
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">마지막 변경 시각</p>
          <p className="mt-2 text-base font-black text-[color:#0a1a38]">
            {formatDateTime(updatedAt)}
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-white p-4">
          <p className="text-xs font-black text-slate-700">현재 이벤트 코드</p>
          <p className="mt-2 break-all text-base font-black text-[color:#0a1a38]">
            {eventCode}
          </p>
          <div className="mt-2">
            <StatusBadge tone="cyan">공개 스크린</StatusBadge>
          </div>
        </div>
      </div>
    </section>
  );
}
