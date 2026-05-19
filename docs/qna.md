# Q&A

This step adds participant question submission, admin moderation, and safe screen presentation for approved questions.

It does not add likes, profanity filtering, AI summaries, exports, answer records, or multilingual Q&A yet.

## Participant Submission Flow

Participants submit questions from `/e/[eventCode]/play`.

The server action verifies:

- the signed participant session cookie
- the event exists and is active
- the participant belongs to the same event
- `question_text` is not blank
- `question_text` is between 2 and 300 characters

Submitted questions are inserted into `qna_questions` with:

- `status = pending`
- `is_pinned = false`

Questions are never shown on the screen immediately after submission. They must be reviewed by an admin first.

## Participant Question Status

The participant play state API returns only the current participant's recent questions.

Visible statuses are:

- `pending`: under review
- `approved`: selected by an admin
- `hidden`: not shown

`deleted` questions are not returned to the participant.

## Admin Moderation Flow

Admins manage questions at `/admin/events/[eventId]/qna`.

The page supports:

- status filtering
- text search
- approve
- hide
- soft delete
- pin and unpin
- show approved question on screen

Questions are shown with participant display information only:

- `display_name` or `name`
- `organization`
- `group_name`

Phone numbers are never selected or displayed.

## Status Values

`qna_questions.status` uses the existing schema values.

### `pending`

The question has been submitted and is waiting for moderation.

### `approved`

The question has been reviewed and can be shown on the screen.

Only approved questions are eligible for screen presentation.

### `hidden`

The question is intentionally hidden from screen presentation.

### `deleted`

Soft delete state. The row remains in the database for auditability, but it should not be shown to participants or the screen.

## Pinning

`is_pinned` marks important questions so moderators can keep them visible near the top of the admin list.

Pinning does not automatically show a question on the screen. The operator must still choose "show on screen".

## Screen Presentation

When an approved question is shown on screen, `live_state` is updated:

```text
mode = qna
screen_scene = qna_question
```

`screen_payload` stores only screen-safe fields:

- `qna_question_id`
- `question_text`
- `participant_display_name`
- `organization`
- `group_name`
- `created_at`

It must not contain:

- `phone`
- `phone_normalized`
- raw participant contact information
- unnecessary participant identifiers

The screen state API does not trust `screen_payload` blindly. If a `qna_question_id` is present, it reloads the question on the server and returns it only when `status = approved`.

If the question is no longer approved, the screen API returns no Q&A question.

## Privacy Principle

Q&A questions can contain personal or inappropriate content, so moderation is mandatory.

The app must never expose participant `phone` or `phone_normalized` through:

- participant APIs
- screen APIs
- admin operation logs
- screen payloads

Operation logs store only operational identifiers such as `event_id`, `qna_question_id`, and status changes. They do not store the question body.

## Access Roles

Q&A moderation is allowed for:

- `super_admin`
- `event_admin`
- `operator`
- `qna_moderator`

`screen_operator` is read-only for Q&A in this MVP. The role can inspect assigned event pages but cannot approve, hide, delete, pin, or show Q&A questions.

## MVP Polling

Participant and screen pages use polling to refresh state.

This is acceptable for the MVP. A later version can replace polling with Supabase Realtime or Broadcast events.

## Not Implemented Yet

- question likes or voting
- profanity filtering
- AI-assisted moderation or summaries
- question export
- admin answer records
- multilingual Q&A
- rate limiting backed by a durable server-side policy
