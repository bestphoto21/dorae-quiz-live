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
- Operation logs: `/admin/events/[eventId]/logs`
- Participant join: `/e/sim-202606/join`
- Participant play: `/e/sim-202606/play`
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
13. Approve a Q&A question and send it to screen.
14. Send the lucky draw ready screen.
15. Run a draw and confirm the countdown/rolling animation appears.
16. Confirm the final winner screen shows a short celebration effect.
17. Confirm the final winner matches the saved draw result.
18. Switch away from the draw scene during animation and confirm the old timer does not overwrite the new screen.
19. Confirm operation logs were written.

## Must Check

- The screen does not show phone, email, secrets, or raw `screen_payload`.
- Participant APIs do not expose `correct_option` before answer reveal.
- Participant registration keeps the session after refresh.
- Pending Q&A questions do not appear on the screen.
- The QR connects to `/e/[eventCode]/join`.
- Lucky draw rolling names contain display names only, and the final winner is the saved DB winner.
- Lucky draw celebration is a screen-only effect and does not expose private data.
- Live screen changes appear in about 1-2 seconds while the screen window is visible.
- Korean labels are not broken.
- Buttons and labels remain readable.
- The brand color remains `#0a1a38`.
