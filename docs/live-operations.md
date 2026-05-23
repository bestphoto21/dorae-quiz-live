# Live Operations

This document explains the field-operation workflow for the integrated live console and screen output.

The goal is not to add a new feature area, but to make quiz, Q&A, lucky draw, participant entry, and screen output safer to run during a live event.

## Related QA Documents

- [End-to-End Rehearsal QA Checklist](./e2e-rehearsal-qa.md)
- [Bug Report Template](./bug-report-template.md)
- [Field Issue Log Template](./field-issue-log-template.md)
- [Pre-Event Release Checklist](./pre-event-release-checklist.md)

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

The admin live, survey, Q&A, and draw pages include a "현재 스크린 송출 상태"
card near the top. It shows the Korean mode label, Korean screen label, last
change time, screen-open button, event code, and a plain-language broadcast
description such as "QR 입장 안내 송출 중", "1분 설문 진행 중", or
"럭키드로우 당첨 발표 송출 중". Internal mode and scene values may appear only
as small helper text.

The operator rule is: the last confirmed screen-control button wins. Because
all features share the same event `live_state` and `/screen/[eventCode]`, a QR,
waiting, break, survey, Q&A, or draw button can intentionally replace the
previous screen output.

## Participant Screen Settings

Admins can configure participant-facing copy and feature visibility at
`/admin/events/[eventId]/settings` in the "참가자 화면 설정" section.

Event-level settings:

- `participant_title`: optional participant screen title. If empty, the event
  title is used.
- `participant_description`: optional participant screen description. If empty,
  the event subtitle or a safe default message is used.
- `participant_show_quiz`: controls participant quiz UI and answer submission.
- `participant_show_qna`: controls participant Q&A submission UI.
- `participant_show_survey`: controls participant survey list, active-survey
  prompts, survey detail pages, and survey submission.
- `participant_show_draw`: controls lucky draw guidance shown to participants.

Recommended presets:

- Survey + draw event: survey on, lucky draw guidance on, quiz off, Q&A off.
- Quiz show: quiz on, Q&A on, lucky draw guidance on.
- Town hall: Q&A on, survey on, quiz off.

These settings affect participant pages only. Admin survey/Q&A/draw pages and
`/screen/[eventCode]` continue to follow the operator-controlled `live_state`.
For example, Q&A can be hidden from participants while the admin Q&A page still
remains available for review of existing questions.

If all participant features are off, participant pages show "현재 참여 가능한
기능이 없습니다." Direct participant access to disabled survey, Q&A, and quiz
submission paths is blocked with a feature-disabled message.

`participant_title`, `participant_description`, and the four feature flags are
event setup values. The event clone workflow copies these values with the event
setup data, while participant data, responses, Q&A submissions, winners, and
logs remain excluded.

## Screen Display Settings

Admins can configure venue-screen copy at `/admin/events/[eventId]/settings` in
the "스크린 화면 설정" section.

Event-level screen settings:

- `screen_title`: optional venue screen title.
- `screen_subtitle`: optional venue screen subtitle.
- `screen_waiting_message`: waiting-screen guidance.
- `screen_break_message`: break-screen guidance.
- `screen_join_message`: QR join-screen guidance.
- `screen_survey_message`: survey-screen guidance.
- `screen_qna_message`: Q&A-screen guidance.
- `screen_draw_message`: lucky draw-screen guidance.
- `screen_footer_message`: optional footer shown on venue screen scenes.
- `screen_show_logo`: controls whether `logo_url` is displayed on the venue
  screen.

Fallback priority is:

1. New screen-specific settings.
2. Existing live screen payload copy for the current scene, where applicable.
3. Existing event fields such as `title`, `subtitle`, and `screen_notice`.
4. Safe built-in defaults.

The older `screen_notice` field is still supported and remains a general venue
notice fallback. The screen settings are public display copy only; they do not
change quiz, Q&A, survey, draw, screen polling, or participant feature
availability. `screen_show_logo=false` hides `logo_url` on `/screen/[eventCode]`
only.

For survey + draw events, emphasize `screen_survey_message` and
`screen_draw_message`. For quiz shows, emphasize QR entry and quiz participation
copy. For forums, emphasize `screen_qna_message`.

These values are event setup values. The event clone workflow copies:

- `screen_title`
- `screen_subtitle`
- `screen_waiting_message`
- `screen_break_message`
- `screen_join_message`
- `screen_survey_message`
- `screen_qna_message`
- `screen_draw_message`
- `screen_footer_message`
- `screen_show_logo`

## Event Clone Workflow

Admins can open `/admin/events/[eventId]/clone` from the event detail page or
event navigation to create a new event from an existing event.

The clone workflow copies setup and content only:

- event subtitle, venue, primary color, logo URL, and screen notice
- participant screen title/description and feature visibility settings
- venue screen title, scene messages, footer message, and logo visibility setting
- quiz sessions and questions
- survey forms and survey questions
- prize names and quantities
- a fresh waiting `live_state` row for the new event

The clone workflow does not copy operation, participation, response, or result
data:

- participants and participant sessions
- quiz answers
- survey responses and survey answers
- submitted Q&A questions
- draw winners
- operation logs from the source event
- current screen state or raw `screen_payload`
- phone numbers, emails, participant IDs, tokens, secrets, or passwords

The new event asks for a new title and a new `event_code`. Existing start/end
times are not copied, so operators must confirm the schedule on the new event
settings page. The new event starts with `mode = waiting`, `screen_scene =
waiting`, no current question, no reveal state, and an empty screen payload.

After cloning, check:

1. The new event code, QR URL, participant URL, and screen URL.
2. Participant screen settings.
3. Venue screen display settings.
4. Quiz sessions and questions.
5. Survey forms and questions, all starting from `draft`.
6. Prize list and quantities.
7. Participant, survey response, Q&A, and winner counts are zero.

## Rehearsal Data Reset

Admins can open `/admin/events/[eventId]/rehearsal` to reset rehearsal data
after testing. The page keeps event setup and content, but can selectively clear
operational data created during rehearsal.

Preserved:

- event basic information, participant screen settings, and venue screen settings
- quiz sessions and questions
- survey forms and survey questions
- prize names and quantities
- admin access and event settings
- operation log history, except that a new reset log is added

Selectable reset targets:

- participants
- quiz answers
- survey responses and survey answers
- submitted Q&A questions
- lucky draw winners
- survey form runtime status and timer fields
- `live_state` back to `mode = waiting`, `screen_scene = waiting`, and empty
  `screen_payload`

The reset form starts with nothing selected. Operators must type
`RESET [event_code]`, for example `RESET sim-202606`, and then accept the
browser confirmation prompt. Use this only for rehearsal or test events; the
delete actions cannot be undone.

The reset operation writes `operation_logs.action = reset_rehearsal_data` with
the selected reset target names and count. The log detail must not include
participant ids, phone numbers, emails, secrets, tokens, keys, passwords, or raw
screen payloads.

## Operation Checklist

Admins can open `/admin/events/[eventId]/checklist` before rehearsal or showtime
to review an event-scoped readiness checklist. This page is separate from the
global `/admin/health` page: health checks the system, while the operation
checklist checks one event's URLs, settings, content, and rehearsal data.

The page combines automatic checks and manual operator checks.

Automatic checks:

- event title, `event_code`, venue, and primary color
- participant home, join, and play URLs
- screen URL and current `live_state`
- participant screen title, description, and quiz/Q&A/survey/draw visibility
- venue screen title, subtitle, and logo visibility
- quiz session/question readiness when participant quiz is enabled
- survey form/question/readiness counts when participant survey is enabled
- Q&A enablement and submitted question counts
- lucky draw prize quantity, remaining quantity estimate, winner count, and
  survey respondent count
- rehearsal data counts for participants, quiz answers, survey responses, Q&A,
  and winners
- result download page availability and export-related counts
- current screen mode, scene, and last update time
- manual sound reminder for lucky draw audio

Status rules:

- `위험`: at least one required item is missing, such as an invalid event code,
  missing live state, no quiz questions while quiz is enabled, or survey forms
  with no questions while survey is enabled.
- `확인 필요`: the system can run, but an operator should review the item, such
  as missing venue, missing custom screen copy, no prizes, rehearsal data that
  may need reset, or audio that must be checked on the screen PC.
- `정상`: the item has enough setup for the selected event configuration.

The checklist links directly to the relevant admin page or public test URL:
settings, participant pages, screen, questions, surveys, Q&A, lucky draw, live
console, rehearsal reset, and result downloads.

Manual checks are stored in the current browser only. They include screen
connection, screen PC audio, QR visibility, real-phone QR entry, survey submit
test, lucky draw test, CSV download test, and rehearsal reset review. These
hardware and field checks cannot be judged automatically, so they must still be
completed with the actual venue screen, network, and phones.

The checklist is read-only. It uses counts and event setup values only, and must
not display participant names, phone numbers, emails, participant IDs, survey
answer details, raw operation log detail, secrets, tokens, keys, passwords, or
raw `screen_payload`.

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

Showing an approved Q&A question on screen requires confirmation. The button
also shows a pending "송출 중..." state after it is pressed.

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
submit state. The one-minute timer and lazy automatic close are part of the
current survey flow. Keep survey answer details inside protected admin flows only.

The one-minute survey start and survey close controls show confirmation prompts.
Screen buttons for waiting, break, QR, survey guide, and survey status also ask
for confirmation and show pending text while the server action is running.

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
"럭키드로우 준비 화면 송출" and "최근 당첨 결과 다시 송출".

"새 당첨자 추첨 실행" creates a new saved winner from the selected candidate
pool and then announces it on the screen. It is visually separated in a warning
style card and requires confirmation.

"최근 당첨 결과 다시 송출" does not draw anyone. It only replays the latest saved
winner on the screen, uses a quieter secondary style, and also asks for
confirmation.

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

Waiting, break, QR, Q&A, survey status, and draw replay controls are protected
with browser confirmation prompts because they immediately change what the
venue screen displays. The pending label confirms the click was accepted and
prevents double submission while the request is running.

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

The public event object may include display-only event settings such as
`screen_title`, `screen_subtitle`, scene messages, `screen_footer_message`,
`screen_show_logo`, `primary_color`, `logo_url`, and `screen_notice`.

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

## Post-Event Result Downloads

After the event, admins can open `/admin/events/[eventId]/exports` from the
event navigation and download CSV files for reporting, settlement, and operation
review.

Available CSV files:

- Participant list
- Survey responses, one file per survey
- Survey respondent list, one file per survey for draw-candidate review
- Lucky draw winners
- Q&A list
- Operation logs

Each CSV filename includes the event code and the download date. CSV responses
are UTF-8 with a BOM so Korean text opens correctly in Excel.

Privacy rules for exports:

- Do not export `participant_id`, phone numbers, normalized phone numbers,
  email addresses, session tokens, secrets, keys, passwords, or raw
  `screen_payload`.
- Survey response CSVs format answers by question column and do not export raw
  answer JSON.
- Operation log CSVs use Korean action names and a sanitized description instead
  of raw `operation_logs.detail`.
- Export route handlers must call admin auth and event-access checks directly;
  they must not rely only on the protected layout.

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

## Unified Operations Console

Use `/admin/events/[eventId]/operations` as the main field-operator screen
during a live event. It gathers the high-frequency controls from the existing
live, survey, Q&A, and lucky draw pages without replacing those detailed pages.

The console includes:

- Current screen status, screen URL, participant join URL, and participant play URL.
- Quick screen controls for waiting, break, and QR join scenes.
- Survey cards with status, question count, participant count, submission count,
  submission rate, remaining time, start, close, and status-screen buttons.
- Q&A counts and recent question text/status, plus a quick action to show the
  latest approved question.
- Lucky draw counts, recent winner summary, a ready-screen button, and a latest
  winner replay button.
- Participant status counts and participant feature ON/OFF settings.
- Links to the operation checklist, rehearsal reset, result exports, settings,
  participant screen, and venue screen.

New winner selection should still be done from the lucky draw management page
because it requires deliberate source and prize selection. The unified console
only sends the ready scene or replays an already saved winner. Replaying a
winner is not a new draw.

The console is count/status oriented. It must not show phone numbers, email
addresses, participant IDs, survey answer details, raw operation log detail, or
raw `screen_payload`.

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
