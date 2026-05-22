-- Adds per-event participant screen copy and feature visibility settings.
-- Defaults keep existing events behaving as they did before this migration.

begin;

alter table public.events
  add column if not exists participant_title text,
  add column if not exists participant_description text,
  add column if not exists participant_show_quiz boolean not null default true,
  add column if not exists participant_show_qna boolean not null default true,
  add column if not exists participant_show_survey boolean not null default true,
  add column if not exists participant_show_draw boolean not null default true;

comment on column public.events.participant_title is
  'Optional title shown on participant-facing event screens.';
comment on column public.events.participant_description is
  'Optional description shown on participant-facing event screens.';
comment on column public.events.participant_show_quiz is
  'Controls whether quiz UI and answer submission are available to participants.';
comment on column public.events.participant_show_qna is
  'Controls whether participant Q&A submission UI is available.';
comment on column public.events.participant_show_survey is
  'Controls whether participant survey list, prompts, and submissions are available.';
comment on column public.events.participant_show_draw is
  'Controls whether lucky-draw guidance is shown to participants.';

commit;
