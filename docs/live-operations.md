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

The Q&A management page also includes a "화면 제어" card. Operators can open
the screen window and switch to waiting, QR participation, break, or Q&A waiting
without leaving the Q&A workflow.

## Survey Flow

Survey MVP management is available at `/admin/events/[eventId]/surveys`.

Surveys use the same event QR entry and participant session as quiz and Q&A:

1. Participant registers at `/e/[eventCode]/join`.
2. Participant opens `/e/[eventCode]/survey`.
3. Only `open` surveys are shown.
4. A participant can submit each survey once.
5. Admins can confirm submission counts on the survey management page.

Survey management includes field-operation controls:

- "설문 시작" opens participant submission for the selected survey.
- "설문 마감" closes participant submission.
- "작성 중으로 되돌리기" moves a closed survey back to draft.
- The survey page can also send waiting, break, QR entry, survey guide, and
  survey submission-status screens without leaving the survey workflow.

Survey start/close and survey screen projection are separate operations. The
first controls `survey_forms.status`; the second only changes `live_state` for
the screen. The survey page can create a default 10-question feedback set for an
empty survey, and participants see immediate selection feedback plus a pending
submit state. One-minute timers and automatic survey transitions are still
future work. Keep survey answer details inside protected admin flows only.

## Lucky Draw Flow

Use "럭키드로우 준비 화면 송출" before drawing or between winners.

Actual winner selection still happens in `/admin/events/[eventId]/draw`.
When the draw button is submitted, the server first writes the selected winner
to `draw_winners`, then the screen plays a countdown and rolling-name
animation before showing the saved winner.

The draw page can select candidates from all participants, quiz correct-answer
pools, or survey respondents. For survey respondent draws, choose
`설문 제출자`, select a survey with responses, and run the draw. The candidate
pool comes from `survey_responses` for the selected form. Individual survey
answers and participant contact fields are never sent to the screen.

The lucky draw management page includes the same basic screen controls, plus
"럭키드로우 준비 화면 송출" and "최근 당첨 결과 다시 송출". "추첨 실행 및 연출
시작" creates a new winner; "최근 당첨 결과 다시 송출" only replays the latest
saved winner on the screen.

At the final "당첨!" moment, the screen also plays a short celebration effect.
The pop, gold glow, canvas-confetti central burst, and optional pop sound are
presentation effects only. They do not affect winner selection.

Screen audio is off by default. Press "효과음 켜기" on `/screen/[eventCode]`
once before the draw to unlock browser audio. If the screen PC is connected to
the venue sound system, the final winner moment can play a short generated pop
sound. If audio playback is blocked or unavailable, the visual celebration still
continues.

Winner screen payload must contain only presentation-safe fields such as:

- winner id or draw result id
- animation id
- display name
- organization, if available and safe
- prize name
- drawn time
- draw phase, message, countdown duration, and safe candidate display names

It must not include participant ids, phone numbers, email addresses, or raw
participant contact details. Candidate names shown during rolling are visual
effects only; the final result is always the saved database winner.

## Break Screen

Use "휴식 화면 송출" during intermissions.

Because no database migration is introduced in this step, break is stored as:

```text
mode = waiting
screen_scene = break
```

## Survey Screen

Survey guide, active, status, and closed screens use the same event `live_state`
row:

```text
mode = survey
screen_scene = survey_intro | survey_active | survey_status | survey_closed
```

The survey management page can send these screens directly. Pressing
"1분 설문 시작" opens the survey for 60 seconds and automatically sends
`survey_active`.

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
- `animation_id`
- `display_name`
- `participant_display_name`
- `winner_name`
- `organization`
- `prize_name`
- `prize_title`
- `source_type`
- `draw_phase`
- `candidate_names`
- `message`
- `duration_ms`
- `countdown_seconds`
- `drawn_at`

### `waiting` / `break`

- `title`
- `message`

### `survey_intro` / `survey_active` / `survey_status` / `survey_closed`

- survey title
- survey description
- survey status
- submitted count
- participant count
- submitted rate
- active start/end time
- server time
- closed flag
- survey URL
- event code
- screen message

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
- `live_screen_set_survey_intro`
- `live_screen_set_survey_active`
- `live_screen_set_survey_status`
- `live_screen_set_survey_closed`

Do not log question text, phone numbers, email addresses, secrets, or raw screen payload.

## State Refresh

Screen and participant clients currently refresh `live_state` through polling.

- `/screen/[eventCode]` checks the safe screen state API aggressively for projection use, scheduling the next request about 400ms after the previous request finishes.
- `/e/[eventCode]/play` checks the participant state API about once every two seconds.
- Both clients request state with `cache: "no-store"` and avoid overlapping polling requests instead of repeatedly canceling in-flight requests.
- Clients ignore older responses when a newer `live_state.updated_at` value has already been applied, and they also compare a safe state fingerprint so scene and payload changes are applied immediately.
- The screen keeps the previous rendered scene while the next poll is pending or
  fails, and scene changes use only a short local transition. The screen should
  not turn blank or look like a full page refresh during ordinary button clicks.
- Run screen transition tests with the `/screen` window actually visible. Browsers can throttle timers in background tabs, which can make polling-based transitions feel slower than they are on the projected screen.
- The current target is stable 1-2 second reflection for ordinary live-console transitions.

If the event needs more immediate transitions later, introduce Supabase Realtime or Broadcast only as a change signal. Clients should still re-fetch the state API and render the server-built safe payload instead of trusting broadcast payloads directly.

## Unified Screen Broadcast Rule

Each event has one `/screen/[eventCode]` and one `live_state` row. Live console,
survey, Q&A, draw, waiting, break, and QR buttons all update that same row for
the same event. The last screen-control action wins.

Survey start is both a status change and a screen broadcast: it opens the survey
for 60 seconds and sends `screen_scene = survey_active`. Manual survey status
screen controls still use the same row. Draw execution switches the same screen
to `draw_winner`, and Q&A screen output switches it to the Q&A scene. Waiting,
break, and QR controls intentionally overwrite the current scene.

Survey expiration is lazy in server code. When an active survey has passed
`active_ends_at`, survey reads, submissions, and the screen state API treat it
as closed and return safe closed/status data.

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
11. Open the survey management page, start one survey, and send the survey guide screen.
12. Submit one survey response and confirm the survey status screen count updates through polling.
13. Press "효과음 켜기" on the screen if sound will be used.
14. Test lucky draw ready screen, rolling animation, celebration effect, optional sound, and winner output.
15. Check that `phone` and `phone_normalized` are not visible on screen.
16. Confirm `npm.cmd run build` passes.

## Incident Checklist

If the screen looks wrong during rehearsal or event operation:

1. Check the live console current-output panel.
2. Switch to waiting screen.
3. Refresh `/screen/[eventCode]`.
4. Confirm the event is active.
5. Confirm the selected quiz session/question exists.
6. For Q&A, confirm the question is approved.
7. For lucky draw, confirm the winner was saved in `draw_winners`.
8. During draw animation, switch to waiting/QR/break once and confirm the old
   rolling timer does not overwrite the new scene.
9. Check recent operation logs.
10. Re-run `npm.cmd run build` before deployment if code changed.
