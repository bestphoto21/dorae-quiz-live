-- Allow lucky draw winners to record survey respondent pools.

alter table public.draw_winners
  add column if not exists survey_form_id uuid null
  references public.survey_forms(id) on delete set null;

create index if not exists draw_winners_survey_form_id_idx
  on public.draw_winners (survey_form_id);

alter table public.draw_winners
  drop constraint if exists draw_winners_source_type_check;

alter table public.draw_winners
  add constraint draw_winners_source_type_check check (
    source_type in (
      'all_participants',
      'correct_answers',
      'question_correct_answers',
      'survey_respondents'
    )
  );
