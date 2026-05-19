"use server";

import { redirect } from "next/navigation";
import { normalizePhone } from "@/lib/participants/phone";
import {
  clearParticipantSessionCookie,
  setParticipantSessionCookie,
} from "@/lib/participants/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function normalizeEventCode(eventCode: string) {
  return eventCode.trim().toLowerCase();
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string) {
  return value.length > 0 ? value : null;
}

function redirectToJoin(eventCode: string, message: string): never {
  const params = new URLSearchParams({ error: message });

  redirect(`/e/${normalizeEventCode(eventCode)}/join?${params.toString()}`);
}

async function writeParticipantLog({
  eventId,
  participantId,
  action,
}: {
  eventId: string;
  participantId: string;
  action: "participant_registered" | "participant_rejoined";
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: null,
    action,
    detail: {
      event_id: eventId,
      participant_id: participantId,
    },
  });

  if (error) {
    console.error("[participant-register] Failed to write operation log.", {
      eventId,
      participantId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

export async function registerParticipantAction(
  eventCode: string,
  formData: FormData
) {
  const normalizedEventCode = normalizeEventCode(eventCode);
  const name = getFormString(formData, "name");
  const phone = getFormString(formData, "phone");
  const organization = getFormString(formData, "organization");
  const groupName = getFormString(formData, "group_name");
  const consentPrivacy = formData.get("consent_privacy") === "on";

  if (!name) {
    redirectToJoin(normalizedEventCode, "이름을 입력해 주세요.");
  }

  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone.ok) {
    redirectToJoin(normalizedEventCode, normalizedPhone.message);
  }

  if (!consentPrivacy) {
    redirectToJoin(normalizedEventCode, "개인정보 수집 및 이용에 동의해 주세요.");
  }

  const supabase = createAdminSupabaseClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, event_code, title, is_active")
    .eq("event_code", normalizedEventCode)
    .maybeSingle();

  if (eventError) {
    console.error("[participant-register] Failed to load event.", {
      eventCode: normalizedEventCode,
      message: eventError.message,
      code: eventError.code,
    });

    redirectToJoin(normalizedEventCode, "행사 정보를 불러오지 못했습니다.");
  }

  if (!event || event.is_active === false) {
    redirectToJoin(normalizedEventCode, "현재 참여할 수 없는 행사입니다.");
  }

  const { data: existingParticipant, error: existingError } = await supabase
    .from("participants")
    .select("id")
    .eq("event_id", event.id)
    .eq("phone_normalized", normalizedPhone.value)
    .maybeSingle();

  if (existingError) {
    console.error("[participant-register] Failed to check participant.", {
      eventId: event.id,
      message: existingError.message,
      code: existingError.code,
    });

    redirectToJoin(normalizedEventCode, "참가자 확인 중 오류가 발생했습니다.");
  }

  let participantId: string;
  let logAction: "participant_registered" | "participant_rejoined";

  if (existingParticipant) {
    // 같은 행사에서 같은 휴대폰 번호로 다시 등록하면 최신 입력값으로
    // 참가자 표시 정보와 동의 여부를 갱신한다. 현장에서는 오타 수정과
    // 소속 변경이 잦기 때문에 기존 row를 재사용하는 편이 안전하다.
    const { data: updatedParticipant, error: updateError } = await supabase
      .from("participants")
      .update({
        name,
        phone,
        phone_normalized: normalizedPhone.value,
        display_name: name,
        organization: nullable(organization),
        group_name: nullable(groupName),
        consent_privacy: consentPrivacy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingParticipant.id)
      .select("id")
      .single();

    if (updateError || !updatedParticipant) {
      console.error("[participant-register] Failed to update participant.", {
        eventId: event.id,
        participantId: existingParticipant.id,
        message: updateError?.message,
        code: updateError?.code,
      });

      redirectToJoin(normalizedEventCode, "참가자 정보 갱신 중 오류가 발생했습니다.");
    }

    participantId = updatedParticipant.id;
    logAction = "participant_rejoined";
  } else {
    const { data: insertedParticipant, error: insertError } = await supabase
      .from("participants")
      .insert({
        event_id: event.id,
        name,
        phone,
        phone_normalized: normalizedPhone.value,
        display_name: name,
        organization: nullable(organization),
        group_name: nullable(groupName),
        consent_privacy: consentPrivacy,
      })
      .select("id")
      .single();

    if (insertError || !insertedParticipant) {
      console.error("[participant-register] Failed to insert participant.", {
        eventId: event.id,
        message: insertError?.message,
        code: insertError?.code,
      });

      redirectToJoin(normalizedEventCode, "참가자 등록 중 오류가 발생했습니다.");
    }

    participantId = insertedParticipant.id;
    logAction = "participant_registered";
  }

  await setParticipantSessionCookie({
    participant_id: participantId,
    event_id: event.id,
    event_code: event.event_code,
  });
  await writeParticipantLog({
    eventId: event.id,
    participantId,
    action: logAction,
  });

  redirect(`/e/${event.event_code}/play`);
}

export async function clearParticipantSessionAction(eventCode: string) {
  const normalizedEventCode = normalizeEventCode(eventCode);

  await clearParticipantSessionCookie(normalizedEventCode);
  redirect(`/e/${normalizedEventCode}/join`);
}
