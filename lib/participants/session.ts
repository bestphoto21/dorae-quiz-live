import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// SERVER ONLY: participant sessions are signed with a server-only secret.
// Never import this module from Client Components.

const COOKIE_PREFIX = "dorae_participant";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type ParticipantSessionPayload = {
  participant_id: string;
  event_id: string;
  event_code: string;
  exp: number;
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Participant session helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

function getParticipantSessionSecret() {
  const secret = process.env.PARTICIPANT_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "Missing PARTICIPANT_SESSION_SECRET. Add a server-only random secret of at least 32 characters to .env.local."
    );
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadBase64: string) {
  return createHmac("sha256", getParticipantSessionSecret())
    .update(payloadBase64)
    .digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeEventCode(eventCode: string) {
  return eventCode.trim().toLowerCase();
}

function getCookieName(eventCode: string) {
  const safeEventCode = normalizeEventCode(eventCode).replace(/[^a-z0-9-]/g, "-");

  return `${COOKIE_PREFIX}_${safeEventCode}`;
}

function getCookiePath(eventCode: string) {
  void eventCode;

  return "/";
}

export function createParticipantSessionCookie(
  payload: Omit<ParticipantSessionPayload, "exp">
) {
  assertServerOnly();

  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payloadBase64 = base64UrlEncode(
    JSON.stringify({
      ...payload,
      event_code: normalizeEventCode(payload.event_code),
      exp,
    })
  );
  const signature = signPayload(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

export function verifyParticipantSessionCookie(
  value: string
): ParticipantSessionPayload | null {
  assertServerOnly();

  const [payloadBase64, signature] = value.split(".");

  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payloadBase64);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadBase64)) as Partial<
      ParticipantSessionPayload
    >;

    if (
      typeof payload.participant_id !== "string" ||
      typeof payload.event_id !== "string" ||
      typeof payload.event_code !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      participant_id: payload.participant_id,
      event_id: payload.event_id,
      event_code: normalizeEventCode(payload.event_code),
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function setParticipantSessionCookie(
  payload: Omit<ParticipantSessionPayload, "exp">
) {
  assertServerOnly();

  const cookieStore = await cookies();
  const eventCode = normalizeEventCode(payload.event_code);
  const cookieName = getCookieName(eventCode);

  cookieStore.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: `/e/${eventCode}`,
  });
  cookieStore.set(cookieName, createParticipantSessionCookie(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: getCookiePath(eventCode),
  });
}

export async function readParticipantSessionCookie(eventCode: string) {
  assertServerOnly();

  const normalizedEventCode = normalizeEventCode(eventCode);
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(getCookieName(normalizedEventCode))?.value;

  if (!cookieValue) {
    return null;
  }

  const payload = verifyParticipantSessionCookie(cookieValue);

  if (!payload || payload.event_code !== normalizedEventCode) {
    return null;
  }

  return payload;
}

export async function clearParticipantSessionCookie(eventCode: string) {
  assertServerOnly();

  const normalizedEventCode = normalizeEventCode(eventCode);
  const cookieStore = await cookies();
  const cookieName = getCookieName(normalizedEventCode);
  const baseOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };

  cookieStore.set(cookieName, "", {
    ...baseOptions,
    path: getCookiePath(normalizedEventCode),
  });
  cookieStore.set(cookieName, "", {
    ...baseOptions,
    path: `/e/${normalizedEventCode}`,
  });
}
