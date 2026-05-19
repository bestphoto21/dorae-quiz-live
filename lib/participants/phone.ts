export type NormalizedPhoneResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      message: string;
    };

export function normalizePhone(phone: string): NormalizedPhoneResult {
  const digitsOnly = phone.replace(/\D/g, "");

  if (!digitsOnly) {
    return {
      ok: false,
      message: "휴대폰 번호를 입력해 주세요.",
    };
  }

  const normalized =
    digitsOnly.startsWith("82") && digitsOnly.length >= 11
      ? `0${digitsOnly.slice(2)}`
      : digitsOnly;

  if (normalized.length < 10 || normalized.length > 11) {
    return {
      ok: false,
      message: "휴대폰 번호를 다시 확인해 주세요.",
    };
  }

  if (!normalized.startsWith("01")) {
    return {
      ok: false,
      message: "한국 휴대폰 번호 형식으로 입력해 주세요.",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}
