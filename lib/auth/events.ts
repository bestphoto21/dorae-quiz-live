import { notFound, redirect } from "next/navigation";
import type { AdminProfile } from "@/lib/auth/admin";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// SERVER ONLY: event access uses the service-role admin client after an
// authenticated admin has been verified. Never import this module from Client
// Components.

export type EventAdminRole =
  | "event_admin"
  | "operator"
  | "screen_operator"
  | "qna_moderator";

export type EventAccessRole = "super_admin" | EventAdminRole;

export type EventRecord = {
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
  created_at: string | null;
  updated_at: string | null;
};

const EVENT_SELECT = `
  id,
  event_code,
  title,
  subtitle,
  venue,
  starts_at,
  ends_at,
  primary_color,
  logo_url,
  screen_notice,
  is_active,
  created_at,
  updated_at
`;

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error(
      "Event access helpers must never run in the browser. Move this call to trusted server-only code."
    );
  }
}

function isSuperAdmin(admin: AdminProfile) {
  return admin.role === "super_admin";
}

function asEventRecord(data: unknown): EventRecord {
  return data as EventRecord;
}

function asEventRecords(data: unknown[] | null): EventRecord[] {
  return (data ?? []) as EventRecord[];
}

export async function getAdminAccessibleEvents(
  admin: AdminProfile
): Promise<EventRecord[]> {
  assertServerOnly();

  const supabase = createAdminSupabaseClient();

  if (isSuperAdmin(admin)) {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[event-access] Failed to load all events.", {
        adminUserId: admin.id,
        message: error.message,
        code: error.code,
      });

      return [];
    }

    return asEventRecords(data);
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("event_admins")
    .select("event_id")
    .eq("admin_user_id", admin.id);

  if (assignmentError) {
    console.error("[event-access] Failed to load event assignments.", {
      adminUserId: admin.id,
      message: assignmentError.message,
      code: assignmentError.code,
    });

    return [];
  }

  const eventIds = Array.from(
    new Set(
      (assignments ?? [])
        .map((assignment) => assignment.event_id)
        .filter((eventId): eventId is string => Boolean(eventId))
    )
  );

  if (eventIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .in("id", eventIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[event-access] Failed to load assigned events.", {
      adminUserId: admin.id,
      message: error.message,
      code: error.code,
    });

    return [];
  }

  return asEventRecords(data);
}

export async function canManageEvent(
  admin: AdminProfile,
  eventId: string
): Promise<boolean> {
  assertServerOnly();

  if (isSuperAdmin(admin)) {
    return true;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("event_admins")
    .select("id")
    .eq("event_id", eventId)
    .eq("admin_user_id", admin.id)
    .maybeSingle();

  if (error) {
    console.error("[event-access] Failed to check event access.", {
      adminUserId: admin.id,
      eventId,
      message: error.message,
      code: error.code,
    });

    return false;
  }

  return Boolean(data);
}

export async function getEventScopedRole(
  admin: AdminProfile,
  eventId: string
): Promise<EventAccessRole | null> {
  assertServerOnly();

  if (isSuperAdmin(admin)) {
    return "super_admin";
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("event_admins")
    .select("role")
    .eq("event_id", eventId)
    .eq("admin_user_id", admin.id)
    .maybeSingle();

  if (error) {
    console.error("[event-access] Failed to load event scoped role.", {
      adminUserId: admin.id,
      eventId,
      message: error.message,
      code: error.code,
    });

    return null;
  }

  return (data?.role as EventAdminRole | undefined) ?? null;
}

export function canEditEventQuestionsByRole(role: EventAccessRole | null) {
  // For question-bank mutations in this MVP, platform super_admin and
  // event-scoped event_admin/operator may edit. screen_operator and
  // qna_moderator can inspect the event, but must not change quiz content.
  return role === "super_admin" || role === "event_admin" || role === "operator";
}

export async function canEditEventQuestions(
  admin: AdminProfile,
  eventId: string
) {
  const role = await getEventScopedRole(admin, eventId);

  return canEditEventQuestionsByRole(role);
}

export function canOperateLiveByRole(role: EventAccessRole | null) {
  // Live control is broader than question editing because screen operators need
  // to run the stage display. Q&A moderators can inspect event pages, but they
  // must not control quiz progression.
  return (
    role === "super_admin" ||
    role === "event_admin" ||
    role === "operator" ||
    role === "screen_operator"
  );
}

export async function canOperateLive(admin: AdminProfile, eventId: string) {
  const role = await getEventScopedRole(admin, eventId);

  return canOperateLiveByRole(role);
}

export function canOperateDrawByRole(role: EventAccessRole | null) {
  // Draw operation can create real winners and affect prize fulfillment, so it
  // is narrower than live screen control. screen_operator and qna_moderator can
  // inspect assigned events but must not run or mutate draws in this MVP.
  return role === "super_admin" || role === "event_admin" || role === "operator";
}

export async function canOperateDraw(admin: AdminProfile, eventId: string) {
  const role = await getEventScopedRole(admin, eventId);

  return canOperateDrawByRole(role);
}

export function canModerateQnaByRole(role: EventAccessRole | null) {
  // Q&A moderation can expose participant-written text to the room, so approval
  // and deletion are limited to event operators and Q&A moderators.
  // screen_operator remains read-only for Q&A in this MVP.
  return (
    role === "super_admin" ||
    role === "event_admin" ||
    role === "operator" ||
    role === "qna_moderator"
  );
}

export async function canModerateQna(admin: AdminProfile, eventId: string) {
  const role = await getEventScopedRole(admin, eventId);

  return canModerateQnaByRole(role);
}

export async function requireEventAccess(eventId: string): Promise<{
  admin: AdminProfile;
  event: EventRecord;
}> {
  assertServerOnly();

  const admin = await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[event-access] Failed to load event.", {
      adminUserId: admin.id,
      eventId,
      message: error.message,
      code: error.code,
    });

    notFound();
  }

  if (!data) {
    notFound();
  }

  const hasAccess = await canManageEvent(admin, eventId);

  if (!hasAccess) {
    redirect("/admin/events");
  }

  return {
    admin,
    event: asEventRecord(data),
  };
}
