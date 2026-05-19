# Deployment Checklist

This document describes the pre-production and post-deployment checks for Dorae Quiz Live on Vercel.

Do not commit `.env.local`, Supabase secret values, or service role values.

## Before Creating The Vercel Project

1. Confirm the latest code is committed.
2. Confirm `npm.cmd run lint` passes locally.
3. Confirm `npm.cmd run build` passes locally.
4. Confirm Supabase migrations `001`, `002`, and `003` have been applied.
5. Confirm the first admin account exists in Supabase Auth and `admin_profiles`.
6. Confirm no real secret values are written in documentation or source files.

## GitHub And Vercel

1. Push the repository to GitHub.
2. Confirm the GitHub repository contains the latest production commit.
3. Create a Vercel project from the GitHub repository, or connect the existing Vercel project to the repository.
4. Use these Vercel settings:

```text
Framework Preset: Next.js
Root Directory: dorae-quiz-live project root
Build Command: npm run build
Install Command: npm install
Output Directory: Next.js default
Production Branch: master, or the branch your team uses for production
```

If Vercel auto-detects the Next.js defaults, keep the detected defaults unless the project structure changes.

Before deployment, confirm which Git branch Vercel treats as Production. If the production branch is not `master`, set the Vercel Production Branch to the branch actually used for release.

## Manual Deployment Steps

Codex does not operate the Vercel UI directly. The operator should:

1. Confirm the latest code is pushed to GitHub.
2. Open Vercel and create or open the project.
3. Connect the GitHub repository.
4. Confirm the project root is the `dorae-quiz-live` repository root.
5. Register environment variables for Production.
6. Trigger a production deployment.
7. Copy the production deployment URL.
8. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
9. Redeploy after changing `NEXT_PUBLIC_SITE_URL`.
10. Open `/admin/health`.
11. Run the production smoke test.

Use `docs/production-smoke-test.md` as the deployment verification checklist.

## Required Environment Variables

Register these in Vercel Project Settings > Environment Variables.

Public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PARTICIPANT_SESSION_SECRET`

This project does not use a separate `ADMIN_SESSION_SECRET`. Admin sessions are handled by Supabase Auth cookies. The current custom server-side session signing secret is `PARTICIPANT_SESSION_SECRET`.

`NEXT_PUBLIC_` values are browser-visible. Only values designed to be public may use this prefix.

Never add `NEXT_PUBLIC_` to:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PARTICIPANT_SESSION_SECRET`
- any future secret, password, token, or private key

`NEXT_PUBLIC_SITE_URL` should be the production site origin, for example:

```text
https://your-project.vercel.app
```

After changing any Vercel environment variable, redeploy the project. Already-built deployments do not automatically pick up new environment values.

Do not write real environment values in this document.

## Health Check After Deployment

Open:

```text
/admin/health
```

Confirm:

- required environment variables show as registered
- Vercel environment is detected
- Supabase connection is healthy
- `events` table check passes
- current admin is active
- no secret values are displayed

If `NEXT_PUBLIC_SITE_URL` is missing or wrong, set it to the production URL and redeploy.

## Supabase Key Handling

Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the browser-safe publishable or anon public key.

Use `SUPABASE_SERVICE_ROLE_KEY` only on the server.

Never:

- paste the service role value into browser code
- expose it through a Client Component
- print it in logs
- write it in documentation
- commit it to Git

## Supabase Auth Settings

If Supabase Auth redirects are used for admin login flows, check Supabase Dashboard settings:

- Site URL
- Additional Redirect URLs
- email/password provider settings

For the current password login flow, confirm the production domain is allowed where needed.

## RLS Principle

Do not open broad public RLS policies for convenience.

Current public participant and screen flows use server actions or server route handlers to return only safe data.

Before deployment, confirm:

- screen API does not return raw screen payload
- participant API does not return contact fields
- answer keys are returned only after reveal
- Q&A questions appear on screen only after approval

## Post-Deployment Check URLs

Open these after the first production deployment:

- `/admin/login`
- `/admin/health`
- `/admin/events`
- `/admin/events/[eventId]/rehearsal`
- `/admin/events/[eventId]/logs`
- `/admin/events/[eventId]/live`
- `/screen/[eventCode]`
- `/e/[eventCode]/join`
- `/e/[eventCode]/play`

## Event Rehearsal Order

1. Login as admin.
2. Open `/admin/health`.
3. Confirm all required environment variables are present.
4. Confirm Supabase connection and `events` table check pass.
5. Open the event rehearsal page.
6. Confirm participant URL and screen URL.
7. Open the screen URL in a new window.
8. Switch to waiting screen.
9. Start a quiz question.
10. Confirm answer is hidden before reveal.
11. Reveal answer and confirm result.
12. Switch to Q&A waiting.
13. Confirm pending Q&A does not show on screen.
14. Approve and show a Q&A question.
15. Switch to lucky draw preparation.
16. Confirm winner output with safe test data.
17. Check operation logs.

## Rollback

If production deployment has a critical issue:

1. Switch the live screen to waiting if the admin console is usable.
2. In Vercel, open Deployments.
3. Promote the previous known-good deployment.
4. Re-run `/admin/health`.
5. Re-run the event rehearsal checklist.

## Incident Notes

When reporting an issue, collect:

- event code
- approximate time
- current live mode and screen scene
- operation log action names around the incident
- browser/device type

Do not copy secret values, participant contact data, or raw payloads into incident notes.

## Not Implemented Yet

- Sentry or external error tracking
- uptime monitoring
- automated database backup verification
- realtime incident alerts
- automatic deployment smoke tests
