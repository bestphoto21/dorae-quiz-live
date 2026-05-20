import { createQrMatrix, createQrSvgPath, getQrViewBox } from "@/lib/qr/create-qr";

type QrCodeProps = {
  value: string;
  title?: string;
  className?: string;
};

export function QrCode({ value, title = "QR code", className = "" }: QrCodeProps) {
  let qr:
    | {
        matrix: boolean[][];
        path: string;
      }
    | null = null;

  try {
    const matrix = createQrMatrix(value);
    qr = {
      matrix,
      path: createQrSvgPath(matrix),
    };
  } catch {
    qr = null;
  }

  if (qr) {
    return (
      <svg
        role="img"
        aria-label={title}
        viewBox={getQrViewBox(qr.matrix)}
        className={className}
        shapeRendering="crispEdges"
      >
        <rect
          x="-4"
          y="-4"
          width={qr.matrix.length + 8}
          height={qr.matrix.length + 8}
          fill="white"
        />
        <path d={qr.path} fill="#0a1a38" />
      </svg>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${title} 생성 실패`}
      className={`flex aspect-square items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center text-sm font-black leading-6 text-amber-950 ${className}`}
    >
      QR을 만들 수 없습니다. 아래 URL을 직접 입력해 주세요.
    </div>
  );
}

type EventJoinQrProps = {
  joinUrl: string;
  title?: string;
  description?: string;
  className?: string;
};

export function EventJoinQr({
  joinUrl,
  title = "참가자 등록 QR",
  description = "QR은 참가자 등록 페이지로 연결됩니다.",
  className = "",
}: EventJoinQrProps) {
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mx-auto max-w-72 rounded-3xl border border-slate-200 bg-white p-4">
        <QrCode
          value={joinUrl}
          title={title}
          className="h-auto w-full"
        />
      </div>
      <p className="mt-4 text-center text-xl font-black text-[color:#0a1a38]">
        {title}
      </p>
      <p className="mt-2 text-center text-sm font-bold leading-6 text-slate-700">
        {description}
      </p>
      <p className="mt-4 break-all rounded-2xl border border-slate-300 bg-slate-50 p-4 text-center text-sm font-black text-[color:#0a1a38]">
        {joinUrl}
      </p>
    </div>
  );
}
