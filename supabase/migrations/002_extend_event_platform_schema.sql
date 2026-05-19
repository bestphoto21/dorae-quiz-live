-- Dorae Quiz Live event platform schema extensions.
-- Run this after 001_initial_schema.sql has already been applied.
-- This migration only extends the database schema; it does not add app code.

begin;

alter table public.participants
  add column if not exists organization text,
  add column if not exists group_name text;

comment on column public.participants.organization is
  'Optional participant organization, company, school, or affiliation for event operation, grouping, statistics, and draw filters.';
comment on column public.participants.group_name is
  'Optional participant group, team, table, or cohort name for grouped participation, statistics, and draw filters.';

do $$
begin
  alter table public.participants
    add constraint participants_organization_not_blank_if_present
    check (organization is null or length(btrim(organization)) > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.participants
    add constraint participants_group_name_not_blank_if_present
    check (group_name is null or length(btrim(group_name)) > 0);
exception
  when duplicate_object then null;
end;
$$;

alter table public.questions
  add column if not exists question_type text;

update public.questions
set question_type = 'quiz_single'
where question_type is null;

alter table public.questions
  alter column question_type set default 'quiz_single',
  alter column question_type set not null;

comment on column public.questions.question_type is
  'Question interaction type. MVP uses quiz_single; poll_single, poll_multiple, and ox are reserved for voting and survey expansion.';

do $$
begin
  alter table public.questions
    add constraint questions_question_type_check
    check (
      question_type in ('quiz_single', 'poll_single', 'poll_multiple', 'ox')
    );
exception
  when duplicate_object then null;
end;
$$;

alter table public.answers
  add column if not exists response_time_ms integer;

comment on column public.answers.response_time_ms is
  'Optional response duration in milliseconds. Used for fastest-correct ranking and tie-breaking.';

do $$
begin
  alter table public.answers
    add constraint answers_response_time_ms_non_negative_check
    check (response_time_ms is null or response_time_ms >= 0);
exception
  when duplicate_object then null;
end;
$$;

alter table public.draw_winners
  add column if not exists status text,
  add column if not exists claimed_at timestamptz;

update public.draw_winners
set status = 'pending'
where status is null;

alter table public.draw_winners
  alter column status set default 'pending',
  alter column status set not null;

comment on column public.draw_winners.status is
  'Prize fulfillment status: pending, claimed, cancelled, or redrawn.';
comment on column public.draw_winners.claimed_at is
  'Timestamp when the prize was confirmed as claimed.';

do $$
begin
  alter table public.draw_winners
    add constraint draw_winners_status_check
    check (status in ('pending', 'claimed', 'cancelled', 'redrawn'));
exception
  when duplicate_object then null;
end;
$$;

alter table public.live_state
  add column if not exists screen_scene text,
  add column if not exists screen_payload jsonb;

update public.live_state
set screen_payload = '{}'::jsonb
where screen_payload is null;

alter table public.live_state
  alter column screen_payload set default '{}'::jsonb,
  alter column screen_payload set not null;

comment on column public.live_state.screen_scene is
  'Optional screen scene key for flexible projection control, such as question, result, draw, qna, notice, or custom stage moments.';
comment on column public.live_state.screen_payload is
  'Screen-safe JSON payload for projection scene options. Must not contain phone numbers or private participant data.';

do $$
begin
  alter table public.live_state
    add constraint live_state_screen_scene_not_blank_if_present
    check (screen_scene is null or length(btrim(screen_scene)) > 0);
exception
  when duplicate_object then null;
end;
$$;

create index if not exists participants_event_organization_idx
  on public.participants (event_id, organization);
create index if not exists participants_event_group_name_idx
  on public.participants (event_id, group_name);

create index if not exists questions_session_question_type_idx
  on public.questions (session_id, question_type);

create index if not exists answers_question_correct_response_time_idx
  on public.answers (question_id, is_correct, response_time_ms)
  where response_time_ms is not null;
create index if not exists answers_event_response_time_idx
  on public.answers (event_id, response_time_ms)
  where response_time_ms is not null;

create index if not exists draw_winners_event_status_idx
  on public.draw_winners (event_id, status);
create index if not exists draw_winners_prize_status_idx
  on public.draw_winners (prize_id, status);

create index if not exists live_state_screen_scene_idx
  on public.live_state (screen_scene);
create index if not exists live_state_screen_payload_gin_idx
  on public.live_state using gin (screen_payload);

commit;
