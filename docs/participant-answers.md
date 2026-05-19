# Participant Answers

This step connects `/e/[eventCode]/play` option buttons to trusted server-side answer submission.

It does not implement ranking, scoring, lucky draw winner selection, Q&A submission, or advanced admin analytics yet.

## Answer Submission Flow

1. The participant opens `/e/[eventCode]/play`.
2. The server page verifies the signed participant session cookie.
3. The client polls `/api/participant/[eventCode]/state`.
4. The participant state API verifies the same signed cookie and returns only safe event, participant display name, live state, current question, existing answer, and answer availability.
5. When the participant taps an option, `submitAnswer` runs as a Server Action.
6. The Server Action verifies the session, event, participant, live state, current question, timing, and duplicate answer status.
7. The Server Action inserts one row into `answers`.
8. The play screen refreshes state and shows the submitted option.

## Session Verification

Participants are not Supabase Auth users. The answer path trusts only the signed HTTP-only participant cookie.

The client never sends or controls:

- `participant_id`
- `event_id`
- `is_correct`
- phone values
- service role credentials

The server reads the cookie, verifies the HMAC signature, checks expiry, and confirms the participant still belongs to the event.

## Live State and Question Validation

`submitAnswer` accepts only `eventCode`, `questionId`, and `selectedOption`.

Before insert, the server checks:

- the event exists and is active
- `live_state.mode = 'question'`
- `live_state.current_question_id` matches the submitted `questionId`
- the current quiz session belongs to the event
- the question belongs to the current session
- `selectedOption` is between `1` and `4`
- `question_ends_at` has not passed

This prevents a participant from changing `questionId` in the browser and submitting to an old or unrelated question.

## Duplicate Answer Prevention

Duplicate prevention happens in three layers:

- The participant state API returns `canAnswer=false` after an answer exists.
- The client disables option buttons after submission.
- The database unique constraint on `(participant_id, question_id)` blocks duplicates even under double-clicks or race conditions.

If the database reports a unique constraint violation, the Server Action returns the Korean message `이미 응답한 문제입니다.`

## `response_time_ms`

`response_time_ms` is calculated on the server:

```text
now - live_state.question_started_at
```

The value is rounded to milliseconds, never below `0`, and capped at `questions.time_limit_seconds * 1000`.

This supports future fastest-correct-answer ranking and tie breaking without trusting client-side clocks.

## Correctness

The client never submits `is_correct`.

The insert sends only:

- `event_id`
- `question_id`
- `participant_id`
- `selected_option`
- `response_time_ms`

`answers.is_correct` is assigned by the database trigger defined in the initial schema from `questions.correct_option`.

## `correct_option` Protection

Participant and screen APIs read the current question on the server, but they include `correct_option` only when `live_state.reveal_answer = true`.

Before reveal:

- participant API omits `correct_option`
- screen API omits `correct_option`
- participant API omits `answer.is_correct`
- screen API omits `stats.correct_answers`

After reveal:

- participant UI can show the correct option
- participant UI can show whether the submitted answer was correct
- screen API can include aggregate `correct_answers`

## Polling

The play screen still uses short polling every 2 seconds.

This is acceptable for the MVP and keeps the security model simple. A later step can replace or supplement polling with Supabase Realtime or Broadcast.

## Operation Logs

`answer_submitted` is written to `operation_logs` in the MVP for operational debugging.

The detail payload contains only:

- `event_id`
- `question_id`
- `participant_id`

It does not include name, phone, `phone_normalized`, or the selected option.

For large events, answer logging can be sampled or moved to a separate analytics pipeline.

## Current Limits

Not implemented yet:

- ranking
- scoring
- fastest correct answer board
- correct-answer-based draw
- lucky draw
- Q&A submission
- Realtime subscription
- advanced admin charts

## Test Scenario

Admin:

1. Create an event.
2. Create a quiz session and question under `/admin/events/[eventId]/questions`.
3. Start the question from `/admin/events/[eventId]/live`.

Participant:

1. Register at `/e/[eventCode]/join`.
2. Open `/e/[eventCode]/play`.
3. Select an option.
4. Confirm the selected option is shown.
5. Try submitting again and confirm it is blocked.
6. After the operator reveals the answer, confirm correct/incorrect status appears.

Screen:

1. Open `/screen/[eventCode]`.
2. Confirm total answer count and option counts update.
3. Confirm correct answer data appears only after answer reveal.
