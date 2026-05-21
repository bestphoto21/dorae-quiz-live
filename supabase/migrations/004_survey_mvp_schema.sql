-- Dorae Quiz Live survey MVP schema.
-- Adds event-scoped survey forms, questions, participant responses, and answers.

begin;

create table if not exists public.survey_forms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_forms_title_not_blank check (length(btrim(title)) > 0),
  constraint survey_forms_status_check check (
    status in ('draft', 'open', 'closed', 'archived')
  )
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_form_id uuid not null references public.survey_forms(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'short_text',
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_questions_question_text_not_blank check (
    length(btrim(question_text)) > 0
  ),
  constraint survey_questions_question_type_check check (
    question_type in (
      'short_text',
      'long_text',
      'single_choice',
      'multiple_choice',
      'rating'
    )
  ),
  constraint survey_questions_options_array_check check (
    jsonb_typeof(options) = 'array'
  )
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  survey_form_id uuid not null references public.survey_forms(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint survey_responses_form_participant_unique unique (
    survey_form_id,
    participant_id
  )
);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  survey_response_id uuid not null references public.survey_responses(id) on delete cascade,
  survey_question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer_value jsonb not null default 'null'::jsonb,
  created_at timestamptz not null default now(),
  constraint survey_answers_response_question_unique unique (
    survey_response_id,
    survey_question_id
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_survey_forms_updated_at'
      and tgrelid = 'public.survey_forms'::regclass
  ) then
    create trigger set_survey_forms_updated_at
    before update on public.survey_forms
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_survey_questions_updated_at'
      and tgrelid = 'public.survey_questions'::regclass
  ) then
    create trigger set_survey_questions_updated_at
    before update on public.survey_questions
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

create index if not exists survey_forms_event_id_idx
  on public.survey_forms (event_id);
create index if not exists survey_forms_event_status_idx
  on public.survey_forms (event_id, status);
create index if not exists survey_forms_event_sort_idx
  on public.survey_forms (event_id, sort_order);

create index if not exists survey_questions_form_id_idx
  on public.survey_questions (survey_form_id);
create index if not exists survey_questions_form_sort_idx
  on public.survey_questions (survey_form_id, sort_order);

create index if not exists survey_responses_event_id_idx
  on public.survey_responses (event_id);
create index if not exists survey_responses_form_id_idx
  on public.survey_responses (survey_form_id);
create index if not exists survey_responses_participant_id_idx
  on public.survey_responses (participant_id);
create index if not exists survey_responses_form_submitted_idx
  on public.survey_responses (survey_form_id, submitted_at);

create index if not exists survey_answers_response_id_idx
  on public.survey_answers (survey_response_id);
create index if not exists survey_answers_question_id_idx
  on public.survey_answers (survey_question_id);

alter table public.survey_forms enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;

comment on table public.survey_forms is
  'Event-scoped survey forms. Participant reads and writes are mediated by server actions after participant session verification.';
comment on table public.survey_questions is
  'Survey questions and options. Public clients should only receive open-event question content through trusted server routes/pages.';
comment on table public.survey_responses is
  'One survey submission per participant per form. Do not expose participant_id in participant screens or public APIs.';
comment on table public.survey_answers is
  'Survey answer values. Answer detail is intended for protected administrator access only.';

-- RLS stays deny-by-default. The application uses trusted server actions and
-- route handlers after admin auth or participant session verification instead
-- of exposing direct anon table access.

commit;
