-- Adds per-event public screen display copy settings.
-- Defaults keep existing events behaving as they did before this migration.

begin;

alter table public.events
  add column if not exists screen_title text,
  add column if not exists screen_subtitle text,
  add column if not exists screen_waiting_message text,
  add column if not exists screen_break_message text,
  add column if not exists screen_join_message text,
  add column if not exists screen_survey_message text,
  add column if not exists screen_qna_message text,
  add column if not exists screen_draw_message text,
  add column if not exists screen_footer_message text,
  add column if not exists screen_show_logo boolean not null default true;

comment on column public.events.screen_title is
  'Optional title shown on the public venue screen.';
comment on column public.events.screen_subtitle is
  'Optional subtitle shown on the public venue screen.';
comment on column public.events.screen_waiting_message is
  'Optional message for the venue screen waiting scene.';
comment on column public.events.screen_break_message is
  'Optional message for the venue screen break scene.';
comment on column public.events.screen_join_message is
  'Optional message for the venue screen QR join scene.';
comment on column public.events.screen_survey_message is
  'Optional message for venue screen survey scenes.';
comment on column public.events.screen_qna_message is
  'Optional message for venue screen Q&A scenes.';
comment on column public.events.screen_draw_message is
  'Optional message for venue screen lucky draw scenes.';
comment on column public.events.screen_footer_message is
  'Optional footer message shown on public venue screen scenes.';
comment on column public.events.screen_show_logo is
  'Controls whether the event logo_url is shown on the public venue screen.';

commit;
