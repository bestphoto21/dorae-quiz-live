alter table public.survey_forms
  add column if not exists active_started_at timestamptz,
  add column if not exists active_ends_at timestamptz,
  add column if not exists closed_at timestamptz;

comment on column public.survey_forms.active_started_at is
  'When the current timed survey window started.';
comment on column public.survey_forms.active_ends_at is
  'When the current timed survey window should stop accepting responses.';
comment on column public.survey_forms.closed_at is
  'When the survey was explicitly or lazily closed.';

create index if not exists survey_forms_event_status_active_ends_idx
  on public.survey_forms (event_id, status, active_ends_at);

create index if not exists survey_forms_active_ends_idx
  on public.survey_forms (active_ends_at);

alter table public.live_state
  drop constraint if exists live_state_mode_check;

alter table public.live_state
  add constraint live_state_mode_check check (
    mode in ('waiting', 'question', 'closed', 'result', 'draw', 'qna', 'survey')
  );
