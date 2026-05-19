# Rehearsal And Operation Logs

This step adds two admin-only pages for field readiness:

- `/admin/events/[eventId]/rehearsal`
- `/admin/events/[eventId]/logs`

The goal is to help operators rehearse the event and inspect recent operation history without adding new database tables.

## Rehearsal Page Purpose

The rehearsal page gives operators a single readiness dashboard before the event starts.

It checks:

- event status
- participant registration count
- quiz session and question readiness
- Q&A moderation status
- lucky draw prize and winner status
- current live screen state
- rehearsal checklist progress

The checklist is stored only in the browser with `localStorage`.

## Day-Before Checklist

1. Confirm admin login works.
2. Confirm the event `event_code`.
3. Confirm event title, venue, and schedule.
4. Confirm quiz sessions and questions are created.
5. Confirm Q&A moderation page is reachable.
6. Confirm prizes are registered.
7. Confirm the screen URL opens in a new display window.
8. Confirm the participant entry URL is the one used for QR.
9. Confirm a production build passes.

## Event-Day Checklist

1. Open the live console.
2. Open the screen URL in a separate window.
3. Switch to the waiting screen.
4. Test participant registration with a staff device.
5. Start a sample quiz question.
6. Confirm the answer is hidden before reveal.
7. Reveal the answer and confirm the result display.
8. Switch to Q&A waiting.
9. Submit and approve a sample Q&A question.
10. Confirm unapproved Q&A questions are not visible on screen.
11. Switch to lucky draw preparation.
12. Confirm winner output with a test draw if appropriate.
13. Check that contact fields are not shown on screen.

## Participant URL

The participant entry path is:

```text
/e/[eventCode]
```

After Vercel deployment, use the full production domain plus that path in QR materials.

## Screen URL

The screen path is:

```text
/screen/[eventCode]
```

Open it in a separate browser window or display machine before the event starts.

## Quiz Rehearsal

Use the live console to:

1. Select a session.
2. Start a question.
3. Check participant and screen displays.
4. Close responses.
5. Reveal the answer.
6. Return to waiting or move to the next scene.

`correct_option` must only be visible after the live state has `reveal_answer = true`.

## Q&A Rehearsal

Use the Q&A page to:

1. Submit a test question as a participant.
2. Confirm it appears as pending.
3. Confirm pending questions are not shown on screen.
4. Approve the question.
5. Show the approved question on screen.

Question text should be reviewed by an admin before screen output.

## Lucky Draw Rehearsal

Use the draw page to:

1. Confirm prizes are registered.
2. Confirm the draw pool is not empty.
3. Run a test draw only if it is safe for the event data.
4. Confirm winner output appears on the screen.

Winner rows are saved before screen output.

## Operation Logs

The logs page shows the latest 100 rows from `operation_logs`.

The viewer intentionally does not render the raw `detail` JSON. It only shows allowed operational keys such as:

- `event_id`
- `mode`
- `screen_scene`
- `changed_at`
- `question_id`
- `qna_question_id`
- `prize_id`
- `winner_id`

It does not show question bodies, contact fields, auth tokens, passwords, secrets, keys, or raw screen payloads.

## Privacy Principles

The rehearsal and logs pages must not display participant contact data.

Do not show:

- phone values
- normalized phone values
- email addresses
- raw participant identifiers in log detail
- raw `screen_payload`
- secret keys or auth tokens

## Incident Checklist

If something looks wrong during rehearsal or live operation:

1. Switch the screen to waiting.
2. Check the live console current state.
3. Refresh the screen window.
4. Confirm the event is active.
5. Confirm the participant URL uses the correct event code.
6. Confirm quiz sessions and questions exist.
7. Confirm Q&A questions are approved before screen output.
8. Confirm a draw winner exists before winner output.
9. Review the operation logs page.
10. Run a production build before redeploying changed code.

## Not Implemented Yet

- server-side checklist storage
- CSV export for logs
- detailed role-management UI
- realtime log streaming
- automatic health checks
