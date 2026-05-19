-- Dorae Quiz Live admin access schema.
-- Run this after 001_initial_schema.sql and 002_extend_event_platform_schema.sql.
-- This migration only adds admin authorization tables and audit references.

begin;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'operator',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.admin_profiles is
  'Admin profile linked one-to-one with Supabase Auth users. is_active=false must block admin access in application and RLS logic.';
comment on column public.admin_profiles.id is
  'Matches auth.users.id for the administrator account.';
comment on column public.admin_profiles.email is
  'Admin email copied from Supabase Auth for display, lookup, and audit context.';
comment on column public.admin_profiles.role is
  'Global admin role. super_admin is platform-wide; event-specific access is also controlled by event_admins.';
comment on column public.admin_profiles.is_active is
  'When false, the user must not be allowed to access admin features.';

do $$
begin
  alter table public.admin_profiles
    add constraint admin_profiles_email_unique unique (email);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_profiles
    add constraint admin_profiles_email_not_blank
    check (length(btrim(email)) > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_profiles
    add constraint admin_profiles_name_not_blank_if_present
    check (name is null or length(btrim(name)) > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.admin_profiles
    add constraint admin_profiles_role_check
    check (
      role in (
        'super_admin',
        'event_admin',
        'operator',
        'screen_operator',
        'qna_moderator'
      )
    );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.event_admins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  admin_user_id uuid not null references public.admin_profiles(id) on delete cascade,
  role text not null default 'operator',
  created_at timestamptz default now()
);

comment on table public.event_admins is
  'Event-scoped admin access mapping. A row grants one admin profile access to one event with a scoped role.';
comment on column public.event_admins.event_id is
  'Event the administrator can operate.';
comment on column public.event_admins.admin_user_id is
  'Admin profile allowed to access the event.';
comment on column public.event_admins.role is
  'Event-scoped role for this administrator on this event.';

do $$
begin
  alter table public.event_admins
    add constraint event_admins_event_admin_user_unique
    unique (event_id, admin_user_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.event_admins
    add constraint event_admins_role_check
    check (
      role in (
        'event_admin',
        'operator',
        'screen_operator',
        'qna_moderator'
      )
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.operation_logs
    add constraint operation_logs_admin_user_id_fkey
    foreign key (admin_user_id)
    references public.admin_profiles(id)
    on delete set null
    not valid;
exception
  when duplicate_object then null;
end;
$$;

comment on column public.operation_logs.admin_user_id is
  'Optional reference to admin_profiles.id for the administrator who performed the action.';

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_admin_profiles_updated_at'
      and tgrelid = 'public.admin_profiles'::regclass
  ) then
    create trigger set_admin_profiles_updated_at
    before update on public.admin_profiles
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create index if not exists admin_profiles_role_idx
  on public.admin_profiles (role);
create index if not exists admin_profiles_is_active_idx
  on public.admin_profiles (is_active);

create index if not exists event_admins_event_id_idx
  on public.event_admins (event_id);
create index if not exists event_admins_admin_user_id_idx
  on public.event_admins (admin_user_id);
create index if not exists event_admins_admin_event_idx
  on public.event_admins (admin_user_id, event_id);
create index if not exists event_admins_event_role_idx
  on public.event_admins (event_id, role);

alter table public.admin_profiles enable row level security;
alter table public.event_admins enable row level security;

-- RLS draft:
-- No permissive policies are created here. These tables remain deny-by-default
-- through Supabase API access until Supabase Auth login, middleware, and
-- event-scoped authorization rules are implemented.
-- Future policies should allow active super_admin users global admin reads and
-- active event_admin/operator users only their assigned event rows.

commit;
