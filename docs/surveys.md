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
- No participant-side editing after submission
- Submission counts per survey
- Admin start, close, and draft-return controls
- Confirm prompts for survey start, close, and immediate screen projection buttons
- Survey guide and submission-status screen projection controls
- Immediate selected styling for participant choice and rating inputs
- Pending submit feedback for participant and admin survey actions
- Default event feedback question set creation
- Protected admin response review with submitter names and answer details
- Lucky draw source based on survey respondents
- One-minute survey timer
- Survey timer and automatic close

Not included in this step:

- Participant-side edit-after-submit flow

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

The start and close buttons show a browser confirmation prompt before
submitting. This is intentional field-operations protection: starting a
one-minute survey makes it visible to participants and the screen, while
closing a survey stops new submissions.

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

Screen projection buttons that immediately replace the venue screen also ask for
confirmation. Operators should check the current screen status card before
confirming the transition.

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

Participants are told before submission that answers cannot be edited after
submission, that they should review the content before pressing submit, and that
the survey cannot be submitted after the closing time. After a successful
submission, the completion message repeats that edits are not available and that
prize drawing follows the operator-announced criteria.

If a participant opens a survey they already submitted, the detail page says the
survey was already submitted and cannot be submitted again or edited. This step
does not add a participant-side edit flow.

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
first render.

## Survey CSV Exports

Admins can download survey CSVs from `/admin/events/[eventId]/exports`.

Survey response CSV:

- Requires `surveyFormId`.
- Creates one column per survey question in the selected survey order.
- Formats short text, long text, single choice, multiple choice, and rating
  answers as human-readable text.
- Includes submitter display name, organization, group/table, and submitted
  time.
- Does not include response IDs, participant IDs, phone numbers, email
  addresses, or raw answer JSON.

Survey respondent CSV:

- Requires `surveyFormId`.
- Lists the people who submitted the selected survey.
- Is intended for checking survey-respondent lucky draw candidates.
- Marks every submitted response as draw-eligible in this MVP.
- Does not include participant IDs, phone numbers, or email addresses.

## Event Clone Behavior

When an event is cloned, survey setup is copied but survey participation data is
not copied.

Copied:

- survey form title, description, and sort order
- survey question text, type, options, required flag, and sort order

Reset in the new event:

- every cloned survey form starts as `draft`
- `active_started_at`, `active_ends_at`, and `closed_at` are `null`
- `survey_responses` and `survey_answers` start empty

This means a cloned event keeps the survey template but has no submitters,
answers, respondent draw candidates, or response review data until participants
join the new event and submit again.

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

For survey respondent draws, the inclusion criterion in this step is submission
existence for the selected survey. Answer content is not used for eligibility
yet, and contact fields are not exposed by the screen.

The survey respondent CSV uses the same MVP policy: every participant with a
`survey_responses` row for the selected form is listed as draw-eligible. The
10th consent question remains an 안내/확인 question until a later consent-only
filter is explicitly added.

## Timed Survey Operation

The primary survey start button is "1분 설문 시작". When pressed, the selected
survey is opened for 60 seconds, `active_started_at` and `active_ends_at` are
saved, and the same event `live_state` row is updated to `mode = survey` and
`screen_scene = survey_active`.

There is no background cron requirement. Survey reads and submissions lazily
close expired open surveys when `active_ends_at` has passed. The server action
checks the time again on submit, so the browser countdown is only a user
experience aid.

The participant play page polls a small active-survey endpoint and shows a
"진행 중인 설문" card when a timed survey is open. The survey list and detail
pages show only currently submit-ready surveys and disable submission when the
timer ends.

The screen survey scenes are:

- `survey_intro`: participation guide
- `survey_active`: 60-second active survey with countdown, submitted count, and rate
- `survey_status`: submitted count/rate view
- `survey_closed`: final closed survey view

The screen API returns only safe survey fields: title, description, status,
submitted count, participant count, submitted rate, timing fields, survey URL,
and message. It never returns participant ids, phone numbers, email addresses,
answer rows, or raw `screen_payload`.

## Security Notes

- Never import the service-role client into Client Components.
- Participant ids are resolved from the signed participant session cookie on the server.
- `survey_answers.answer_value` is answer content and should be handled in protected admin areas only.
- Operation logs for survey submission store event id, survey form id, and survey response id only.
- Survey screen payloads show only title, description, status, counts, and a survey URL. They must not include participant ids, contact fields, answer values, or raw screen payload.
- Individual survey answers are visible only in protected admin pages. Screen projection continues to show counts only.

## Future Step

Potential next phase:

- Consent-answer-only lucky draw filtering
- Optional "allow edits before close" setting for surveys that explicitly need
  pre-close revision. The current production rule remains one submission per
  participant per survey with no participant-side edits.
