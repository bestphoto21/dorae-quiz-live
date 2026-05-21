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
- Live console: `/admin/events/[eventId]/live`
- Question management: `/admin/events/[eventId]/questions`
- Q&A management: `/admin/events/[eventId]/qna`
- Lucky draw management: `/admin/events/[eventId]/draw`
- Survey management: `/admin/events/[eventId]/surveys`
- Operation logs: `/admin/events/[eventId]/logs`
- Participant join: `/e/sim-202606/join`
- Participant play: `/e/sim-202606/play`
- Participant surveys: `/e/sim-202606/survey`
- Screen: `/screen/sim-202606`

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
15. Confirm the same `/screen/sim-202606` automatically switches to `survey_active` with countdown, submitted count, participant count, and submitted rate.
16. Use the survey management screen controls to send waiting, break, QR entry, survey active, and survey status screens.
17. Open `/e/sim-202606/play` and confirm the active survey card appears automatically.
18. Open `/e/sim-202606/survey`, submit the survey once, and confirm duplicate submission is blocked.
19. Confirm the admin survey page increments the live submission count.
20. Confirm the admin survey page shows the submitter name, submitted time, and answer details.
21. Confirm rating, single-choice, and multiple-choice selections visibly change immediately on the participant form.
22. Confirm the participant submit button shows a pending state and prevents double clicks.
23. Send the survey submission-status screen and confirm the count updates after polling without a full-screen flash.
24. Wait 60 seconds and confirm the survey is lazily closed, participant submission is blocked, and the screen shows the closed/status view.
25. Switch waiting -> QR -> survey active -> survey status -> break and confirm the screen does not turn blank.
26. Use "작성 중으로 되돌리기" only when you need to edit the closed survey again.
27. On the Q&A management page, use the screen controls for waiting, QR, break, and Q&A waiting.
28. Approve a Q&A question and send it to screen.
29. On the lucky draw page, use the screen controls for waiting, QR, break, and lucky draw ready.
30. Run a survey respondent draw by selecting `설문 제출자`, choosing the submitted survey, and confirming the candidate count.
31. Confirm the same `/screen/sim-202606` switches from survey to `draw_winner`.
32. Run an all-participant draw again to confirm the original source still works.
33. Press "효과음 켜기" on the screen if testing draw sound.
34. Run a draw and confirm the countdown/rolling animation appears.
35. Confirm the final winner screen shows a short celebration effect and optional pop sound.
36. Use "최근 당첨 결과 다시 송출" and confirm it replays the latest saved winner without drawing a new winner.
37. Confirm the final winner matches the saved draw result.
38. Switch away from the draw scene during animation and confirm the old timer does not overwrite the new screen.
39. Confirm operation logs were written.

## Must Check

- The screen does not show phone, email, secrets, or raw `screen_payload`.
- Participant APIs do not expose `correct_option` before answer reveal.
- Participant registration keeps the session after refresh.
- Pending Q&A questions do not appear on the screen.
- The QR connects to `/e/[eventCode]/join`.
- Lucky draw rolling names contain display names only, and the final winner is the saved DB winner.
- Lucky draw celebration is a canvas-confetti central burst screen effect and does not expose private data.
- Lucky draw sound is optional, screen-only, and requires the screen operator to enable audio first.
- Survey submissions require participant registration and one participant can submit each survey only once.
- Survey start is blocked until a survey has at least one question.
- Empty surveys can receive the default 10-question set once.
- Survey screen controls show only survey title, description, status, counts, and a participation URL.
- Survey answer details are not shown on participant screens or screen projection.
- Survey answer details appear only in the protected admin survey page and do not include phone, email, or participant IDs.
- Survey respondent lucky draws use `survey_responses` candidates and do not expose answers or contact fields.
- Timed surveys run for 60 seconds, auto-close lazily, and show submitted count/rate on the screen.
- `/e/[eventCode]/play` shows the active survey card automatically while a timed survey is open.
- Live screen changes appear in about 1-2 seconds while the screen window is visible.
- Screen transitions keep the previous scene visible while polling is pending; the screen should not flash to a blank or full reload state.
- Korean labels are not broken.
- Buttons and labels remain readable.
- The brand color remains `#0a1a38`.
