-- Dorae Quiz Live initial database schema.
-- This migration defines the first Supabase/PostgreSQL schema only.
-- It intentionally does not create Supabase client code, auth wiring, or realtime behavior.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_answer_is_correct()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_option integer;
begin
  select q.correct_option
    into expected_option
  from public.questions as q
  where q.id = new.question_id;

  if expected_option is null then
    raise exception 'Question % does not exist.', new.question_id
      using errcode = '23503';
  end if;

  new.is_correct = new.selected_option = expected_option;
  return new;
end;
$$;

comment on function public.set_answer_is_correct() is
  'Sets answers.is_correct from questions.correct_option. Participant clients must not decide correctness.';

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text unique not null,
  title text not null,
  subtitle text,
  venue text,
  starts_at timestamptz,
  ends_at timestamptz,
  primary_color text,
  logo_url text,
  screen_notice text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint events_event_code_not_blank check (length(btrim(event_code)) > 0),
  constraint events_title_not_blank check (length(btrim(title)) > 0),
  constraint events_time_range_valid check (
    starts_at is null
    or ends_at is null
    or ends_at >= starts_at
  )
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  phone text not null,
  phone_normalized text not null,
  display_name text,
  consent_privacy boolean not null default false,
  joined_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint participants_name_not_blank check (length(btrim(name)) > 0),
  constraint participants_phone_not_blank check (length(btrim(phone)) > 0),
  constraint participants_phone_normalized_not_blank check (
    length(btrim(phone_normalized)) > 0
  ),
  constraint participants_event_phone_normalized_unique unique (
    event_id,
    phone_normalized
  )
);

comment on column public.participants.phone is
  'Original phone input. PII. Do not expose to participant public screens, screen projection views, realtime payloads, or public APIs.';
comment on column public.participants.phone_normalized is
  'Normalized phone value for duplicate checks. Store digits-only or international-format normalized values from trusted server code.';
comment on column public.participants.display_name is
  'Optional display name. When null or blank, the application should display participants.name instead.';

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint quiz_sessions_title_not_blank check (length(btrim(title)) > 0),
  constraint quiz_sessions_status_check check (
    status in ('draft', 'ready', 'live', 'ended')
  )
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_text text not null,
  option_1 text not null,
  option_2 text not null,
  option_3 text not null,
  option_4 text not null,
  correct_option integer not null,
  time_limit_seconds integer not null default 20,
  order_index integer not null default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint questions_question_text_not_blank check (
    length(btrim(question_text)) > 0
  ),
  constraint questions_option_1_not_blank check (length(btrim(option_1)) > 0),
  constraint questions_option_2_not_blank check (length(btrim(option_2)) > 0),
  constraint questions_option_3_not_blank check (length(btrim(option_3)) > 0),
  constraint questions_option_4_not_blank check (length(btrim(option_4)) > 0),
  constraint questions_correct_option_check check (correct_option between 1 and 4),
  constraint questions_time_limit_seconds_check check (
    time_limit_seconds between 5 and 300
  )
);

comment on column public.questions.correct_option is
  'Sensitive answer key. Do not expose to participant clients, public responses, or realtime payloads before answer reveal.';

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  selected_option integer not null,
  is_correct boolean not null default false,
  answered_at timestamptz default now(),
  constraint answers_selected_option_check check (selected_option between 1 and 4),
  constraint answers_participant_question_unique unique (
    participant_id,
    question_id
  )
);

comment on column public.answers.is_correct is
  'Calculated by database trigger from questions.correct_option and selected_option. Clients must not be trusted to set this value.';

create table public.live_state (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade unique,
  current_session_id uuid references public.quiz_sessions(id) on delete set null,
  current_question_id uuid references public.questions(id) on delete set null,
  mode text not null default 'waiting',
  question_started_at timestamptz,
  question_ends_at timestamptz,
  reveal_answer boolean not null default false,
  show_results boolean not null default false,
  updated_at timestamptz default now(),
  constraint live_state_mode_check check (
    mode in ('waiting', 'question', 'closed', 'result', 'draw', 'qna')
  ),
  constraint live_state_question_time_range_valid check (
    question_started_at is null
    or question_ends_at is null
    or question_ends_at > question_started_at
  )
);

create table public.qna_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid references public.participants(id) on delete set null,
  question_text text not null,
  status text not null default 'pending',
  is_pinned boolean default false,
  created_at timestamptz default now(),
  approved_at timestamptz,
  constraint qna_questions_question_text_not_blank check (
    length(btrim(question_text)) > 0
  ),
  constraint qna_questions_status_check check (
    status in ('pending', 'approved', 'hidden', 'deleted')
  )
);

comment on table public.qna_questions is
  'Audience Q&A questions. Questions must not be projected automatically; only approved rows are eligible for screen display.';

create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  created_at timestamptz default now(),
  constraint prizes_name_not_blank check (length(btrim(name)) > 0),
  constraint prizes_quantity_positive check (quantity >= 1)
);

create table public.draw_winners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  prize_id uuid references public.prizes(id) on delete set null,
  participant_id uuid not null references public.participants(id) on delete cascade,
  source_type text not null,
  source_question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz default now(),
  constraint draw_winners_source_type_check check (
    source_type in (
      'all_participants',
      'correct_answers',
      'question_correct_answers'
    )
  ),
  constraint draw_winners_event_participant_unique unique (
    event_id,
    participant_id
  )
);

comment on constraint draw_winners_event_participant_unique
  on public.draw_winners is
  'Prevents duplicate winners within the same event. If a future event setting allows duplicate wins, replace this with a partial unique index or enforce the rule in draw logic.';

create table public.operation_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  admin_user_id uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz default now(),
  constraint operation_logs_action_not_blank check (length(btrim(action)) > 0)
);

create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger set_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

create trigger set_quiz_sessions_updated_at
before update on public.quiz_sessions
for each row execute function public.set_updated_at();

create trigger set_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

create trigger set_live_state_updated_at
before update on public.live_state
for each row execute function public.set_updated_at();

create trigger set_answers_is_correct
before insert or update on public.answers
for each row execute function public.set_answer_is_correct();

create index events_is_active_idx on public.events (is_active);
create index events_starts_at_idx on public.events (starts_at);

create index participants_event_id_idx on public.participants (event_id);
create index participants_event_joined_at_idx
  on public.participants (event_id, joined_at desc);

create index quiz_sessions_event_id_idx on public.quiz_sessions (event_id);
create index quiz_sessions_event_status_idx
  on public.quiz_sessions (event_id, status);

create index questions_session_id_idx on public.questions (session_id);
create index questions_session_order_idx
  on public.questions (session_id, order_index);
create index questions_session_active_idx
  on public.questions (session_id, is_active);

create index answers_event_question_idx
  on public.answers (event_id, question_id);
create index answers_question_selected_option_idx
  on public.answers (question_id, selected_option);
create index answers_question_is_correct_idx
  on public.answers (question_id, is_correct);
create index answers_participant_id_idx on public.answers (participant_id);
create index answers_answered_at_idx on public.answers (answered_at desc);

create index live_state_current_session_idx
  on public.live_state (current_session_id);
create index live_state_current_question_idx
  on public.live_state (current_question_id);

create index qna_questions_event_status_idx
  on public.qna_questions (event_id, status);
create index qna_questions_event_pinned_idx
  on public.qna_questions (event_id, is_pinned, created_at desc);
create index qna_questions_participant_id_idx
  on public.qna_questions (participant_id);

create index prizes_event_id_idx on public.prizes (event_id);

create index draw_winners_event_id_idx on public.draw_winners (event_id);
create index draw_winners_prize_id_idx on public.draw_winners (prize_id);
create index draw_winners_participant_id_idx
  on public.draw_winners (participant_id);
create index draw_winners_source_question_id_idx
  on public.draw_winners (source_question_id);

create index operation_logs_event_created_at_idx
  on public.operation_logs (event_id, created_at desc);
create index operation_logs_admin_user_id_idx
  on public.operation_logs (admin_user_id);
create index operation_logs_action_idx on public.operation_logs (action);

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.live_state enable row level security;
alter table public.qna_questions enable row level security;
alter table public.prizes enable row level security;
alter table public.draw_winners enable row level security;
alter table public.operation_logs enable row level security;

-- RLS draft:
-- No permissive public policies are created in this first migration.
-- With RLS enabled and no policies, Supabase API access is deny-by-default.
-- Future policies should be split into participant public access, screen read
-- access, and admin access after auth/session-token design is finalized.
-- Never expose participants.phone or participants.phone_normalized outside
-- administrator-only reads.

commit;
