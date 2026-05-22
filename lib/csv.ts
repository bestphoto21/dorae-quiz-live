export type CsvCell =
  | string
  | number
  | boolean
  | Date
  | Array<string | number | boolean | Date | null | undefined>
  | null
  | undefined;

const UTF8_BOM = "\uFEFF";
const CSV_CONTENT_TYPE = "text/csv; charset=utf-8";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: partMap.get("year") ?? String(value.getUTCFullYear()),
    month: partMap.get("month") ?? pad2(value.getUTCMonth() + 1),
    day: partMap.get("day") ?? pad2(value.getUTCDate()),
    hour: partMap.get("hour") ?? pad2(value.getUTCHours()),
    minute: partMap.get("minute") ?? pad2(value.getUTCMinutes()),
    second: partMap.get("second") ?? pad2(value.getUTCSeconds()),
  };
}

export function formatCsvDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = formatInTimeZone(date, "Asia/Seoul");

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
}

export function formatCsvDate(value: Date = new Date()) {
  const parts = formatInTimeZone(value, "Asia/Seoul");

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return formatCsvDateTime(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCsvCell(item))
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }

  return String(value);
}

export function escapeCsvCell(value: CsvCell) {
  const text = normalizeCsvCell(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function createCsv(headers: string[], rows: CsvCell[][]) {
  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\r\n");
}

function safeFilenamePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "export"
  );
}

export function createCsvFilename({
  eventCode,
  parts,
  date = new Date(),
}: {
  eventCode: string;
  parts: string[];
  date?: Date;
}) {
  const safeEventCode = safeFilenamePart(eventCode);
  const safeParts = parts.map(safeFilenamePart).filter(Boolean);

  return `${[safeEventCode, ...safeParts, formatCsvDate(date)].join("-")}.csv`;
}

function contentDisposition(filename: string) {
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "export.csv";

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function createCsvDownloadResponse({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: CsvCell[][];
}) {
  const csv = `${UTF8_BOM}${createCsv(headers, rows)}`;

  return new Response(csv, {
    headers: {
      "Content-Type": CSV_CONTENT_TYPE,
      "Content-Disposition": contentDisposition(filename),
      "Cache-Control": "no-store",
    },
  });
}
