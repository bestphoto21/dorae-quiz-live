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
- Admin start, close, and draft-return controls
- Survey guide and submission-status screen projection controls
- Immediate selected styling for participant choice and rating inputs
- Pending submit feedback for participant and admin survey actions
- Default event feedback question set creation
- Protected admin response review with submitter names and answer details
- Lucky draw source based on survey respondents

Not included in this step:

- One-minute survey timer
- Survey timer and automatic close

## Database

Migration:

- `supabase/migrations/004_survey_mvp_schema.sql`
- `supabase/migrations/005_survey_respondent_draw_source.sql`

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
6. Press "설문 시작" when it is ready.
7. Watch the per-survey submission count.

Operational buttons:

- "설문 시작": changes `survey_forms.status` to `open`. It is blocked until the survey has at least one question.
- "설문 마감": changes status to `closed` and stops new participant submissions.
- "작성 중으로 되돌리기": changes status back to `draft` so the operator can edit again.

Screen controls on the same page:

- "스크린 열기"
- "대기 화면 송출"
- "휴식 화면 송출"
- "QR 입장 안내 송출"
- "설문 참여 안내 송출"
- "제출 현황 송출"

Starting a survey and showing it on the screen are separate operations. The start
button controls participant submission availability. The screen buttons only
change what `/screen/[eventCode]` displays.

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

The survey page also shows a protected "제출자 확인" section. It lists the
latest 100 submissions with display name, organization, submitted time, and
formatted answers. Phone numbers, email addresses, and participant IDs are not
shown.

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

Choice, multi-choice, and rating questions visually update as soon as a
participant selects an option. The form still submits through the existing
server action and keeps the same answer storage format.

When a participant presses submit, the button switches to "제출 중..." and is
disabled until the server action finishes. This prevents accidental double
clicks while the database unique constraint still enforces one submission per
participant per survey.

## Submission Counts

The admin survey page displays:

- Survey count
- Total survey submissions
- Per-survey submission count
- Participant entry count for comparison

The protected admin page shows the latest response details for the selected
survey only, so events with many surveys do not load every survey answer on the
first render. CSV export is still a future feature.

## Default Question Set

When a selected survey has no questions, admins can press "기본 질문 10개 추가".
The action creates these questions with sort order 1-10:

1. Overall event satisfaction: rating, required
2. Program composition satisfaction: rating, required
3. Event operation smoothness: rating, required
4. Most useful program: single choice, required
5. Guidance and registration convenience: rating, required
6. Willingness to join a similar event again: single choice, required
7. Desired future topics: multiple choice, optional
8. Best part of the event: long text, optional
9. Suggested improvements: long text, optional
10. Consent to prize drawing for survey submitters: single choice, required

The tenth question is an operator-facing consent prompt. In this step, the draw
candidate pool is all participants who submitted the selected survey. Filtering
to only "동의합니다" answers is a future refinement.

## Survey Respondent Lucky Draw

The lucky draw page can use "설문 제출자" as a draw source. The admin selects a
survey with at least one response, then the server builds the candidate pool
from `survey_responses` for that form. Phone numbers, email addresses, raw
answers, and participant IDs are not shown on screen.

## Security Notes

- Never import the service-role client into Client Components.
- Participant ids are resolved from the signed participant session cookie on the server.
- `survey_answers.answer_value` is answer content and should be handled in protected admin areas only.
- Operation logs for survey submission store event id, survey form id, and survey response id only.
- Survey screen payloads show only title, description, status, counts, and a survey URL. They must not include participant ids, contact fields, answer values, or raw screen payload.
- Individual survey answers are visible only in protected admin pages. Screen projection continues to show counts only.

## Future Step

Potential next phase:

- One-minute survey timer and automatic close
- CSV export for survey responses
- Consent-answer-only lucky draw filtering
