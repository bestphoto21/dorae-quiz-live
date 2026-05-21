# Live Operations

This document explains the field-operation workflow for the integrated live console and screen output.

The goal is not to add a new feature area, but to make quiz, Q&A, lucky draw, participant entry, and screen output safer to run during a live event.

## Console Purpose

The live console at `/admin/events/[eventId]/live` is the operator's main stage-control page.

It shows:

- current event
- `event_code`
- current `live_state.mode`
- current `screen_scene`
- current screen output description
- active quiz session and question
- answer reveal state
- Q&A screen state
- lucky draw screen state
- screen URL
- participant entry URL

Operators should always check the current output panel before pressing a screen-transition button.

## Mode And Scene

`live_state.mode` is the database-level state. Its allowed values are defined by the existing schema:

- `waiting`
- `question`
- `closed`
- `result`
- `draw`
- `qna`

`screen_scene` is the presentation-level state. It can be more specific:

- `waiting`
- `question`
- `closed`
- `result`
- `draw`
- `draw_winner`
- `qna_waiting`
- `qna_question`
- `join_qr`
- `break`

The database does not currently allow `mode = break`, so the break screen is represented as:

```text
mode = waiting
screen_scene = break
```

## Waiting Screen

Use "대기 화면 송출" before participants enter or when resetting the screen.

This clears:

- current quiz session
- current question
- reveal state
- results state
- screen payload

## Quiz Flow

Quiz operation remains based on the existing question controls.

Recommended flow:

1. Select a quiz session.
2. Start a question.
3. Close responses.
4. Reveal the answer only when ready.
5. Move back to waiting, Q&A, draw, or the next question.

`correct_option` must be returned to participant and screen clients only when `reveal_answer = true`.

## Q&A Flow

Q&A questions are never shown immediately after participant submission.

Recommended flow:

1. Switch to "Q&A 대기 화면 송출".
2. Review participant questions at `/admin/events/[eventId]/qna`.
3. Approve the question.
4. Show the approved question on screen.

The screen state API re-checks `qna_questions.status = approved` before returning a Q&A question. Pending, hidden, and deleted questions must never appear on the screen.

## Lucky Draw Flow

Use "럭키드로우 준비 화면 송출" before drawing or between winners.

Actual winner selection still happens in `/admin/events/[eventId]/draw`.

Winner screen payload must contain only presentation-safe fields such as:

- winner id or draw result id
- display name
- organization, if available and safe
- prize name
- drawn time

It must not include phone numbers or raw participant contact details.

## Break Screen

Use "휴식 화면 송출" during intermissions.

Because no database migration is introduced in this step, break is stored as:

```text
mode = waiting
screen_scene = break
```

## Screen Payload Privacy

The screen API must never return raw `live_state.screen_payload`.

Allowed fields are selected per scene.

### `qna_question`

- `qna_question_id`
- `question_text`
- `participant_display_name`
- `organization`
- `group_name`
- `created_at`

### `draw_winner`

- `winner_id`
- `display_name`
- `participant_display_name`
- `organization`
- `prize_name`
- `source_type`
- `drawn_at`

### `waiting` / `break`

- `title`
- `message`

### Quiz Question

- question id
- question text
- options
- question type
- time limit
- `correct_option` only when `reveal_answer = true`

Never return:

- `phone`
- `phone_normalized`
- email
- raw participant id
- Supabase auth user id
- service-role key or any secret
- raw `screen_payload`
- `correct_option` before answer reveal
- pending, hidden, or deleted Q&A questions

## Operation Logs

Screen transitions write operation logs with minimal detail:

- `event_id`
- `mode`
- `screen_scene`
- `changed_at`

Examples:

- `live_screen_set_waiting`
- `live_screen_set_join_qr`
- `live_screen_set_qna_waiting`
- `live_screen_set_break`
- `live_screen_set_quiz`
- `live_screen_set_lucky_draw`

Do not log question text, phone numbers, email addresses, secrets, or raw screen payload.

## State Refresh

Screen and participant clients currently refresh `live_state` through polling.

- `/screen/[eventCode]` checks the safe screen state API about once per second.
- `/e/[eventCode]/play` checks the participant state API about once every two seconds.
- Both clients request state with `cache: "no-store"` and skip overlapping polling requests instead of repeatedly canceling in-flight requests.
- Clients ignore older responses when a newer `live_state.updated_at` value has already been applied, and they also compare a safe state fingerprint so scene and payload changes are applied immediately.
- Run screen transition tests with the `/screen` window actually visible. Browsers can throttle timers in background tabs, which can make polling-based transitions feel slower than they are on the projected screen.
- The current target is stable 1-2 second reflection for ordinary live-console transitions.

If the event needs more immediate transitions later, introduce Supabase Realtime or Broadcast only as a change signal. Clients should still re-fetch the state API and render the server-built safe payload instead of trusting broadcast payloads directly.

## Rehearsal Checklist

1. Confirm admin login.
2. Confirm event `event_code`.
3. Confirm participant entry URL.
4. Open the screen URL in a new window.
5. Test waiting screen transition.
6. Test quiz question display.
7. Test answer reveal and answer hidden states.
8. Test Q&A waiting screen.
9. Test approved question screen output.
10. Confirm unapproved questions do not appear on screen.
11. Test lucky draw winner output.
12. Check that `phone` and `phone_normalized` are not visible on screen.
13. Confirm `npm.cmd run build` passes.

## Incident Checklist

If the screen looks wrong during rehearsal or event operation:

1. Check the live console current-output panel.
2. Switch to waiting screen.
3. Refresh `/screen/[eventCode]`.
4. Confirm the event is active.
5. Confirm the selected quiz session/question exists.
6. For Q&A, confirm the question is approved.
7. For lucky draw, confirm the winner was saved in `draw_winners`.
8. Check recent operation logs.
9. Re-run `npm.cmd run build` before deployment if code changed.
