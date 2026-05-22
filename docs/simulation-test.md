# Simulation Test

This guide creates a fake rehearsal event for local or staging QA. It must not be used with real participant data.

## Purpose

- Create one `sim-` event.
- Add 20 fake participants.
- The seed uses only the current database schema. If `participants.email` or timestamp columns such as `joined_at` are not present, they are not written by the script.
- Add 10 quiz questions with four options and answer keys.
- Add fake answers, Q&A questions, prizes, winners, and one operation log.
- Rehearse the full admin, participant, and screen flow without touching real events.

## Safety Rules

- Default event code is `sim-202606`.
- Seed refuses to run unless `ALLOW_TEST_DATA_SEED=true`.
- Clear refuses to delete non-`sim-` event codes.
- Clear is dry-run by default.
- Actual clear requires `CONFIRM_CLEAR_SIMULATION_DATA=true`.
- Scripts print only event IDs, event codes, relative URLs, and counts.
- Do not paste real names, phone numbers, email addresses, secrets, keys, or tokens into these scripts.

## Create Data

PowerShell:

```powershell
$env:ALLOW_TEST_DATA_SEED="true"
npm run seed:simulation
```

Optional custom simulation event code:

```powershell
$env:ALLOW_TEST_DATA_SEED="true"
$env:SIMULATION_EVENT_CODE="sim-local-rehearsal"
npm run seed:simulation
```

The seed script reuses the existing simulation event when it exists. It clears only the child data for that `sim-` event, then recreates the rehearsal dataset.

## Clear Data

Dry-run:

```powershell
npm run clear:simulation
```

Actual delete:

```powershell
$env:CONFIRM_CLEAR_SIMULATION_DATA="true"
npm run clear:simulation
```

The clear script deletes the simulation event row by `event_code`. Cascading foreign keys remove child simulation rows. It will not run for event codes that do not start with `sim-`.

## Browser Test URLs

Use the seed output for the exact event ID. For the default event code:

- Admin event list: `/admin/events`
- Admin event detail: `/admin/events/[eventId]`
- Admin event settings: `/admin/events/[eventId]/settings`
- Live console: `/admin/events/[eventId]/live`
- Question management: `/admin/events/[eventId]/questions`
- Q&A management: `/admin/events/[eventId]/qna`
- Lucky draw management: `/admin/events/[eventId]/draw`
- Survey management: `/admin/events/[eventId]/surveys`
- Result downloads: `/admin/events/[eventId]/exports`
- Event clone: `/admin/events/[eventId]/clone`
- Rehearsal reset: `/admin/events/[eventId]/rehearsal`
- Operation checklist: `/admin/events/[eventId]/checklist`
- Operation logs: `/admin/events/[eventId]/logs`
- Participant join: `/e/sim-202606/join`
- Participant play: `/e/sim-202606/play`
- Participant surveys: `/e/sim-202606/survey`
- Screen: `/screen/sim-202606`

## Participant Screen Settings Test

1. Open `/admin/events/[eventId]/settings`.
2. Save participant title "설문 참여 이벤트" and a short participant description.
3. Turn quiz off, Q&A off, survey on, and lucky draw guidance on.
4. Open `/e/sim-202606/play`.
5. Confirm fixed "퀴즈쇼" style copy is not shown.
6. Confirm Q&A submission UI is hidden.
7. Start a survey and confirm the active survey card appears while survey is on.
8. Confirm lucky draw guidance appears while draw guidance is on.
9. Open `/e/sim-202606/survey` and confirm survey access works while survey is on.
10. Turn survey off.
11. Confirm `/e/sim-202606/survey` and `/e/sim-202606/survey/[surveyFormId]` show the survey-disabled message.
12. Confirm Q&A submission and quiz answer submission are rejected while those participant features are off.
13. Turn all participant features back on and confirm the existing quiz, Q&A, survey, and draw participant flow appears again.
14. Confirm admin survey/Q&A/draw pages and `/screen/sim-202606` still follow the operator-controlled `live_state`.

## Screen Display Settings Test

1. Open `/admin/events/[eventId]/settings`.
2. Save screen title "설문 참여 이벤트".
3. Save screen subtitle "설문 제출 후 경품 추첨이 진행됩니다."
4. Save waiting message "잠시 후 설문 이벤트가 시작됩니다."
5. Save QR message "QR을 찍고 입장한 뒤 설문에 참여해주세요."
6. Save survey message "지금부터 1분간 설문조사를 진행합니다."
7. Save lucky draw message "설문 제출자 중 무작위 추첨을 진행합니다."
8. Save footer message "참여해주셔서 감사합니다."
9. Turn logo display off.
10. Open `/screen/sim-202606`.
11. Send waiting, QR, survey, Q&A, draw-ready, and draw-winner scenes.
12. Confirm each scene uses the configured title/message where applicable and
    the footer appears.
13. Confirm `logo_url` is hidden when logo display is off and shown again when
    logo display is turned back on.
14. Confirm `/api/screen/sim-202606/state` does not expose participant IDs,
    phone numbers, email addresses, raw `screen_payload`, secrets, tokens, or
    keys.

## Rehearsal Flow

1. Open `/admin/events` and confirm the simulation event appears.
2. Open the event detail page and confirm the participant registration QR is visible.
3. Open `/screen/sim-202606` in a visible screen window.
4. In the live console, send the waiting screen.
5. Send the QR participation guide screen.
6. Send the break screen.
7. Start question 1.
8. Submit an answer from a participant browser.
9. Confirm duplicate answer prevention.
10. Close responses.
11. Reveal the answer.
12. Start the next question.
13. Open survey management and create the starter four surveys if needed.
14. Add questions to one survey or use "기본 질문 10개 추가", then press "1분 설문 시작".
15. Confirm the survey start confirmation prompt appears, accept it, and check the button shows a pending state.
16. Confirm the current screen status card shows the active survey output and the same `/screen/sim-202606` automatically switches to `survey_active` with countdown, submitted count, participant count, and submitted rate.
17. Use the survey management screen controls to send waiting, break, QR entry, survey guide, and survey status screens. Confirm each risky screen transition asks for confirmation.
18. Press "설문 마감", confirm the warning prompt, and check the pending state.
19. Open `/e/sim-202606/play` and confirm the active survey card appears automatically.
20. Open `/e/sim-202606/survey`, submit the survey once, and confirm duplicate submission is blocked.
21. Confirm the survey form warns before submit that answers cannot be edited, content should be reviewed, and closed surveys cannot be submitted.
22. Confirm the completion message says the survey was submitted, edits are unavailable, and prize drawing follows operator-announced criteria.
23. Reopen the same survey and confirm the already-submitted screen says duplicate submission or editing is unavailable.
24. Confirm the admin survey page increments the live submission count.
25. Confirm the admin survey page shows the submitter name, submitted time, and answer details.
26. Confirm rating, single-choice, and multiple-choice selections visibly change immediately on the participant form.
27. Confirm the participant submit button shows a pending state and prevents double clicks.
28. Send the survey submission-status screen and confirm the count updates after polling without a full-screen flash.
29. Wait 60 seconds and confirm the survey is lazily closed, participant submission is blocked, and the screen shows the closed/status view.
30. Switch waiting -> QR -> survey active -> survey status -> break and confirm the screen does not turn blank.
31. Use "작성 중으로 되돌리기" only when you need to edit the closed survey again.
32. On the Q&A management page, confirm the current screen status card appears, then use the screen controls for waiting, QR, break, and Q&A waiting.
33. Approve a Q&A question and send it to screen. Confirm the Q&A screen-output button asks for confirmation and shows pending text.
34. On the lucky draw page, confirm the current screen status card appears, then use the screen controls for waiting, QR, break, and lucky draw ready.
35. Confirm "새 당첨자 추첨 실행" and "최근 당첨 결과 다시 송출" are visually separate and have different descriptions.
36. Run a survey respondent draw by selecting `설문 제출자`, choosing the submitted survey, confirming the candidate count, and accepting the new-draw confirmation prompt.
37. Confirm the same `/screen/sim-202606` switches from survey to `draw_winner`.
38. Run an all-participant draw again to confirm the original source still works.
39. Press "효과음 켜기" on the screen if testing draw sound.
40. Run a draw and confirm the countdown/rolling animation appears.
41. Confirm the final winner screen shows a short celebration effect and optional pop sound.
42. Use "최근 당첨 결과 다시 송출", accept the replay confirmation prompt, and confirm it replays the latest saved winner without drawing a new winner.
43. Confirm the final winner matches the saved draw result.
44. Switch away from the draw scene during animation and confirm the old timer does not overwrite the new screen.
45. Confirm operation logs were written.
46. Open `/admin/events/[eventId]/exports`.
47. Download participant list, survey response, survey respondent, draw winner, Q&A, and operation log CSV files.
48. Confirm each CSV opens in Excel with Korean text readable.
49. Confirm empty datasets still download with headers.
50. Confirm CSV files do not contain participant IDs, phone numbers, email addresses, raw `screen_payload`, secrets, tokens, or keys.
51. Confirm a logged-out browser is redirected to login or receives a protected response when opening an export URL directly.
52. Open `/admin/events/[eventId]/clone`.
53. Confirm the clone page shows the source event, copied item counts, copied items, and excluded data.
54. Try an existing event code and confirm duplicate validation appears.
55. Clone with a new `sim-` event code.
56. Confirm the cloned event detail page opens and uses the new event code in QR, participant, and screen URLs.
57. Confirm participant screen settings and venue screen display settings were copied.
58. Confirm quiz sessions/questions, survey forms/questions, and prizes were copied.
59. Confirm cloned survey forms are `draft` with no submitted responses.
60. Confirm participants, quiz answers, Q&A questions, draw winners, and source operation logs were not copied.
61. Confirm the cloned event screen opens in waiting state with an empty payload.

## Rehearsal Reset Test

1. Open `/admin/events/[eventId]/rehearsal`.
2. Confirm participant, quiz answer, survey response, Q&A, winner, live-state,
   active-survey, and closed-survey counts appear without personal details.
3. Confirm the reset button is disabled when no target is selected.
4. Select only screen state reset and confirm the button stays disabled until
   `RESET sim-202606` is typed exactly.
5. Accept the browser confirmation and confirm `/screen/sim-202606` returns to
   the waiting screen.
6. Select survey response reset and confirm `survey_responses` and
   `survey_answers` are cleared while survey forms and questions remain.
7. Select survey status reset and confirm survey forms return to `draft` with
   timer fields empty.
8. Select lucky draw winner reset and confirm `draw_winners` are cleared while
   prizes remain.
9. Select Q&A reset and confirm submitted Q&A questions are cleared.
10. Select participant reset only on a rehearsal event and confirm participants
    and participant-owned answers/responses/winners are cleared.
11. Confirm a `reset_rehearsal_data` operation log was added with only reset
    target names/counts and no participant ids, phone numbers, emails, secrets,
    tokens, keys, passwords, or raw `screen_payload`.
12. Confirm event settings, participant screen settings, venue screen settings,
    quiz questions, survey forms/questions, and prizes remain.

## Operation Checklist Test

1. Open `/admin/events/[eventId]/checklist`.
2. Confirm the summary card shows the overall state plus normal, review-needed,
   and danger counts.
3. Confirm each automatic check shows a status badge, description, current
   value, recommended action, and at least one relevant link.
4. Confirm participant home, join, play, and screen links open the expected
   event URLs.
5. Turn quiz off in participant settings and confirm the quiz readiness item is
   not marked dangerous only because quiz is off.
6. Turn survey on with no survey forms and confirm the survey item asks for
   review. Create a survey without questions and confirm it becomes dangerous.
7. Confirm zero prizes make the lucky draw item ask for review.
8. Confirm existing participants, quiz answers, survey responses, Q&A, or
   winners make the rehearsal data item ask the operator to review reset needs.
9. Toggle manual checklist items, refresh the page, and confirm the state stays
   in the same browser.
10. Confirm the page does not show participant names, phone numbers, emails,
    participant IDs, survey answer details, raw operation log detail, secrets,
    tokens, keys, passwords, or raw `screen_payload`.

## Must Check

- The screen does not show phone, email, secrets, or raw `screen_payload`.
- Participant APIs do not expose `correct_option` before answer reveal.
- Participant registration keeps the session after refresh.
- Pending Q&A questions do not appear on the screen.
- The QR connects to `/e/[eventCode]/join`.
- Participant screen settings hide disabled quiz/Q&A/survey buttons and block
  disabled participant submission paths.
- Screen display settings customize venue-screen title, scene messages, footer,
  and logo visibility without exposing raw screen payload.
- Lucky draw rolling names contain display names only, and the final winner is the saved DB winner.
- Lucky draw celebration is a canvas-confetti central burst screen effect and does not expose private data.
- Lucky draw sound is optional, screen-only, and requires the screen operator to enable audio first.
- Survey submissions require participant registration and one participant can submit each survey only once.
- Participant survey submit screens clearly say submissions cannot be edited after submit.
- Survey start is blocked until a survey has at least one question.
- Survey start, survey close, Q&A screen output, draw execution, draw replay, waiting, break, and QR screen buttons show confirmation prompts.
- Risky admin buttons show "처리 중..." or "송출 중..." pending text and are disabled while submitting.
- Lucky draw execution and latest-result replay are visually distinct and cannot be confused in the draw UI.
- Empty surveys can receive the default 10-question set once.
- Survey screen controls show only survey title, description, status, counts, and a participation URL.
- Survey answer details are not shown on participant screens or screen projection.
- Survey answer details appear only in the protected admin survey page and do not include phone, email, or participant IDs.
- Survey respondent lucky draws use `survey_responses` candidates and do not expose answers or contact fields.
- Result CSV downloads are available only in the protected admin event area.
- Survey response CSVs show formatted answers by question, not raw answer JSON.
- Operation log CSVs show sanitized Korean descriptions, not raw detail payloads.
- Event clone copies only setup data and never copies participants, answers,
  survey responses, submitted Q&A, winners, source logs, or raw screen payloads.
- Event clone includes participant feature settings and screen display settings.
- Rehearsal reset preserves event setup/content and clears only the selected
  operational data after exact `RESET [event_code]` confirmation.
- Operation checklist is read-only, count-based, and links to the right setup
  pages without exposing personal data.
- Timed surveys run for 60 seconds, auto-close lazily, and show submitted count/rate on the screen.
- `/e/[eventCode]/play` shows the active survey card automatically while a timed survey is open.
- Live screen changes appear in about 1-2 seconds while the screen window is visible.
- Screen transitions keep the previous scene visible while polling is pending; the screen should not flash to a blank or full reload state.
- Korean labels are not broken.
- Buttons and labels remain readable.
- The brand color remains `#0a1a38`.
