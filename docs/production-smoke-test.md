# Production Smoke Test

Use this checklist immediately after a Vercel production deployment.

Do not paste real secret values, participant contact data, or raw payloads into screenshots, chat, or incident notes.

## Before Testing

1. Confirm the production deployment succeeded in Vercel.
2. Confirm `NEXT_PUBLIC_SITE_URL` matches the deployed production URL.
3. Redeploy if any environment variable changed.
4. Confirm Supabase is online.
5. Prepare one test event code.
6. Prepare one admin account with access to the test event.
7. Treat event start/end time as an operating reference, not automatic start or automatic shutdown. Live console controls the actual quiz start, close, answer reveal, Q&A output, and lucky draw flow.

## A. Admin Flow

1. Open `/admin/login`.
2. Login with the production admin account.
3. Open `/admin/health`.
4. Confirm required environment variables show as registered.
5. Confirm Supabase connection is healthy.
6. Open `/admin/events`.
7. Open the event detail page.
8. Confirm validation errors on event create/settings forms keep the typed values.
9. Confirm the event detail page shows the participant registration QR and that the QR URL points to `/e/[eventCode]/join`.
10. Open `/admin/events/[eventId]/live`.
11. Send the QR participation guide screen to the live screen.
12. Open `/admin/events/[eventId]/rehearsal`.
13. Open `/admin/events/[eventId]/logs`.

Expected result:

- No stack trace appears.
- No secret value appears.
- Admin email is not exposed in health or log detail views.
- If `event.is_active=false`, participant entry and screen behavior are intentionally restricted.

## B. Participant Flow

1. Open `/e/[eventCode]/join`.
2. Register a test participant.
3. Confirm redirect to `/e/[eventCode]/play`.
4. From the admin live console, start a quiz question.
5. Submit an answer from the participant page.
6. Confirm duplicate answer submission is blocked.
7. Submit a Q&A question.
8. Confirm the participant can see their own recent question status.

Expected result:

- Contact fields are never shown back on the participant play screen.
- Answer correctness is shown only after answer reveal.
- Q&A question starts as pending.

## C. Screen Flow

Open `/screen/[eventCode]` in a separate browser window.

Check:

1. Waiting screen.
2. QR participation guide screen with a scannable QR and visible `/e/[eventCode]/join` URL.
3. Break screen.
4. Quiz question output.
5. Before answer reveal, answer key is not visible.
6. After answer reveal, answer key is visible.
7. Q&A waiting screen.
8. Approved Q&A question output.
9. Pending, hidden, or deleted Q&A question does not appear on screen.
10. Lucky draw preparation screen.
11. Winner output after saved draw result.

Expected result:

- Raw screen payload is not visible.
- Participant contact data is not visible.
- QR screen does not expose phone, email, secret values, or raw payload data.
- Screen errors show a safe fallback, not internal details.

## D. Security Checks

Confirm the following are not visible in public screens, admin health, or log detail output:

- phone values
- normalized phone values
- email addresses
- secret values
- private keys
- access tokens
- refresh tokens
- passwords
- raw screen payload
- Q&A question text inside operation log detail

Allowed places for question text:

- quiz management
- live quiz display
- Q&A moderation
- approved Q&A screen output

Not allowed:

- operation log raw detail display
- health check
- error screens

## E. Incident Response Order

If something fails:

1. Open Vercel Deployment Logs.
2. Open `/admin/health`.
3. Check Supabase project status.
4. Check the latest operation logs for action names only.
5. Switch the live screen to waiting if the live console is usable.
6. If production is broken, restore the previous Vercel deployment.
7. Re-run this smoke test after rollback or redeploy.

## Rollback

Rollback is performed in the Vercel dashboard:

1. Open the project.
2. Go to Deployments.
3. Select the previous known-good deployment.
4. Promote it to production.
5. Re-open `/admin/health`.
6. Re-run the smoke test.

## Pass Criteria

Production is ready for rehearsal when:

- `/admin/health` is healthy.
- Admin login works.
- Participant registration works.
- Quiz answer submission works.
- Screen output works.
- Q&A approval and screen output work.
- Lucky draw winner output works.
- No sensitive data is visible.
- Error pages do not reveal stack traces.
