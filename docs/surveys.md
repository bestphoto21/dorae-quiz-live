# Surveys MVP

This document covers the first survey MVP for Dorae Quiz Live.

## Scope

The survey MVP uses the existing event code, QR entry, and participant session flow.

Included in this step:

- Admin survey management per event
- Starter survey creation: "Survey 1" through "Survey 4"
- Additional survey creation
- Survey question create, update, delete, and ordering
- Participant survey list and submission pages
- One submission per participant per survey
- Submission counts per survey

Not included in this step:

- One-minute survey timer
- `live_state` survey start or close integration
- Screen projection for surveys
- Survey-response-based lucky draw

## Database

Migration:

- `supabase/migrations/004_survey_mvp_schema.sql`

Tables:

- `survey_forms`
- `survey_questions`
- `survey_responses`
- `survey_answers`

All survey tables have RLS enabled and stay deny-by-default for direct Supabase API access. The application reads and writes survey data through trusted server code after either admin auth or participant session verification.

## Admin Flow

Admin URL:

- `/admin/events/[eventId]/surveys`

Recommended setup:

1. Open the event survey page.
2. If the event has no surveys, press "기본 설문 4개 만들기".
3. Select a survey tab.
4. Edit title, description, status, and sort order.
5. Add questions.
6. Change the survey status to `open` when it is ready.
7. Watch the per-survey submission count.

Survey statuses:

- `draft`: admin editing
- `open`: visible and submittable by participants
- `closed`: no new submissions
- `archived`: hidden from participant flow

Question types:

- `short_text`
- `long_text`
- `single_choice`
- `multiple_choice`
- `rating`

Choice options are entered as newline-separated text and stored as a JSON array.

## Participant Flow

Participant URLs:

- `/e/[eventCode]/survey`
- `/e/[eventCode]/survey/[surveyFormId]`

Flow:

1. Participant registers through `/e/[eventCode]/join`.
2. The participant session cookie is issued by trusted server code.
3. Participant opens `/e/[eventCode]/survey`.
4. Only `open` surveys for the current event are shown.
5. Participant submits answers.
6. A unique database constraint prevents a second submission for the same survey.

The participant screen must not show participant ids, phone numbers, normalized phone numbers, email addresses, secrets, or raw screen payload.

## Submission Counts

The admin survey page displays:

- Survey count
- Total survey submissions
- Per-survey submission count
- Participant entry count for comparison

Detailed answer review and export are not part of this MVP.

## Security Notes

- Never import the service-role client into Client Components.
- Participant ids are resolved from the signed participant session cookie on the server.
- `survey_answers.answer_value` is answer content and should be handled in protected admin areas only.
- Operation logs for survey submission store event id, survey form id, and survey response id only.

## Future Step

Potential next phase:

- Survey timer
- Live console survey open/close controls
- Screen projection of survey progress or prompts
- Lucky draw source based on survey respondents
