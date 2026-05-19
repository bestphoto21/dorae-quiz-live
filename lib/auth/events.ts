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
