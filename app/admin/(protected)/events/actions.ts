"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { requireEventAccess } from "@/lib/auth/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type EventFormField =
  | "title"
  | "event_code"
  | "starts_at"
  | "ends_at"
  | "primary_color";

export type EventFormState = {
  message: string | null;
  fieldErrors?: Partial<Record<EventFormField, string>>;
};

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const EVENT_CODE_PATTERN = /^[a-z0-9-]+$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DEFAULT_PRIMARY_COLOR = "#0a1a38";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function nullIfBlank(value: string) {
  return value.length > 0 ? value : null;
}

function normalizeEventCode(value: string) {
  return value.trim().toLowerCase();
}

function parseOptionalDateTime(
  formData: FormData,
  key: "starts_at" | "ends_at",
  fieldErrors: Partial<Record<EventFormField, string>>
) {
  const value = getFormString(formData, key);

  if (!value) {
    return null;
  }

  const dateTimeMatch = value.match(DATE_TIME_LOCAL_PATTERN);

  if (!dateTimeMatch) {
    fieldErrors[key] = "날짜와 시간을 다시 확인해 주세요.";
    return null;
  }

  const [, year, month, day, hour, minute, second = "00"] = dateTimeMatch;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`
  );

  return date.toISOString();
}

function getPrimaryColor(formData: FormData) {
  const value = getFormString(formData, "primary_color");

  return value || DEFAULT_PRIMARY_COLOR;
}

function validateEventFields(formData: FormData, includeEventCode: boolean) {
  const fieldErrors: Partial<Record<EventFormField, string>> = {};
  const title = getFormString(formData, "title");
  const eventCode = normalizeEventCode(getFormString(formData, "event_code"));
  const primaryColor = getPrimaryColor(formData);
  const startsAt = parseOptionalDateTime(formData, "starts_at", fieldErrors);
  const endsAt = parseOptionalDateTime(formData, "ends_at", fieldErrors);

  if (!title) {
    fieldErrors.title = "행사명을 입력해 주세요.";
  }

  if (includeEventCode) {
    if (!eventCode) {
      fieldErrors.event_code = "행사 코드를 입력해 주세요.";
    } else if (!EVENT_CODE_PATTERN.test(eventCode)) {
      fieldErrors.event_code =
        "행사 코드는 소문자 영문, 숫자, 하이픈만 사용할 수 있습니다.";
    }
  }

  if (!HEX_COLOR_PATTERN.test(primaryColor)) {
    fieldErrors.primary_color = "대표 색상은 #0a1a38 형식으로 입력해 주세요.";
  }

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    fieldErrors.ends_at = "종료 시간은 시작 시간보다 뒤여야 합니다.";
  }

  return {
    values: {
      title,
      subtitle: nullIfBlank(getFormString(formData, "subtitle")),
      event_code: eventCode,
      venue: nullIfBlank(getFormString(formData, "venue")),
      starts_at: startsAt,
      ends_at: endsAt,
      primary_color: primaryColor,
      logo_url: nullIfBlank(getFormString(formData, "logo_url")),
      screen_notice: nullIfBlank(getFormString(formData, "screen_notice")),
      is_active: formData.get("is_active") === "on",
    },
    fieldErrors,
  };
}

async function writeOperationLog({
  eventId,
  adminUserId,
  action,
  detail,
}: {
  eventId: string;
  adminUserId: string;
  action: "event_created" | "event_updated";
  detail: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("operation_logs").insert({
    event_id: eventId,
    admin_user_id: adminUserId,
    action,
    detail,
  });

  if (error) {
    console.error("[admin-events] Failed to write operation log.", {
      eventId,
      adminUserId,
      action,
      message: error.message,
      code: error.code,
    });
  }
}

export async function createEventAction(
  _previousState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const admin = await requireAdmin();
  const { values, fieldErrors } = validateEventFields(formData, true);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "입력값을 확인해 주세요.",
      fieldErrors,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: duplicatedEvent, error: duplicatedEventError } = await supabase
    .from("events")
    .select("id")
    .eq("event_code", values.event_code)
    .maybeSingle();

  if (duplicatedEventError) {
    console.error("[admin-events] Failed to check duplicate event_code.", {
      eventCode: values.event_code,
      message: duplicatedEventError.message,
      code: duplicatedEventError.code,
    });

    return {
      message: "행사 코드 중복 확인 중 오류가 발생했습니다.",
    };
  }

  if (duplicatedEvent) {
    return {
      message: "이미 사용 중인 행사 코드입니다.",
      fieldErrors: {
        event_code: "이미 사용 중인 행사 코드입니다.",
      },
    };
  }

  const { data: event, error: insertError } = await supabase
    .from("events")
    .insert({
      event_code: values.event_code,
      title: values.title,
      subtitle: values.subtitle,
      venue: values.venue,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      primary_color: values.primary_color,
      logo_url: values.logo_url,
      screen_notice: values.screen_notice,
      is_active: values.is_active,
    })
    .select("id, event_code, title")
    .single();

  if (insertError || !event) {
    console.error("[admin-events] Failed to create event.", {
      eventCode: values.event_code,
      message: insertError?.message,
      code: insertError?.code,
    });

    if (insertError?.code === "23505") {
      return {
        message: "이미 사용 중인 행사 코드입니다.",
        fieldErrors: {
          event_code: "이미 사용 중인 행사 코드입니다.",
        },
      };
    }

    return {
      message: "행사 생성 중 오류가 발생했습니다.",
    };
  }

  const { error: liveStateError } = await supabase.from("live_state").upsert(
    {
      event_id: event.id,
      mode: "waiting",
      reveal_answer: false,
      show_results: false,
      screen_payload: {},
    },
    { onConflict: "event_id" }
  );

  if (liveStateError) {
    console.error("[admin-events] Failed to create live_state row.", {
      eventId: event.id,
      message: liveStateError.message,
      code: liveStateError.code,
    });

    return {
      message: "행사는 생성됐지만 라이브 상태 초기화에 실패했습니다.",
    };
  }

  const { error: eventAdminError } = await supabase
    .from("event_admins")
    .upsert(
      {
        event_id: event.id,
        admin_user_id: admin.id,
        role: "event_admin",
      },
      { onConflict: "event_id,admin_user_id" }
    );

  if (eventAdminError) {
    console.error("[admin-events] Failed to connect creator to event.", {
      eventId: event.id,
      adminUserId: admin.id,
      message: eventAdminError.message,
      code: eventAdminError.code,
    });

    return {
      message: "행사는 생성됐지만 관리자 권한 연결에 실패했습니다.",
    };
  }

  // We also connect super_admin creators to the event for audit clarity and
  // future scoped workflows. Their global role still grants access even without
  // this event_admins row.
  await writeOperationLog({
    eventId: event.id,
    adminUserId: admin.id,
    action: "event_created",
    detail: {
      event_code: event.event_code,
      title: event.title,
      creator_role: admin.role,
    },
  });

  revalidatePath("/admin/events");
  redirect(`/admin/events/${event.id}`);
}

export async function updateEventAction(
  eventId: string,
  _previousState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const { admin, event } = await requireEventAccess(eventId);
  const { values, fieldErrors } = validateEventFields(formData, false);

  if (Object.keys(fieldErrors).length > 0) {
    return {
      message: "입력값을 확인해 주세요.",
      fieldErrors,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("events")
    .update({
      title: values.title,
      subtitle: values.subtitle,
      venue: values.venue,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      primary_color: values.primary_color,
      logo_url: values.logo_url,
      screen_notice: values.screen_notice,
      is_active: values.is_active,
    })
    .eq("id", eventId);

  if (error) {
    console.error("[admin-events] Failed to update event.", {
      eventId,
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    return {
      message: "행사 저장 중 오류가 발생했습니다.",
    };
  }

  await writeOperationLog({
    eventId,
    adminUserId: admin.id,
    action: "event_updated",
    detail: {
      event_code: event.event_code,
      title: values.title,
      is_active: values.is_active,
    },
  });

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}/settings`);
  redirect(`/admin/events/${eventId}/settings?message=updated`);
}
