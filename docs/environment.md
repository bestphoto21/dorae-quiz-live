# Environment Setup

This project is prepared for Supabase, but it does not connect to Supabase yet. No database query, authentication flow, participant registration, realtime feature, or admin function is implemented in this step.

## Required Variables

Create a local `.env.local` file from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not commit `.env.local`.

## Supabase Project URL

Find the project URL in Supabase:

1. Open the Supabase Dashboard.
2. Select the Dorae Quiz Live project.
3. Go to Project Settings > API.
4. Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.

## Public Key vs Service Role Key

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is for browser-safe Supabase access.

Use either:

- Supabase publishable key
- Supabase anon public key

This key is allowed to be bundled into browser code because access is still controlled by Row Level Security policies.

`SUPABASE_SERVICE_ROLE_KEY` is different. It is a secret server-only key that can bypass RLS. Treat it like a password.

Never:

- put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable
- import the admin client from a Client Component
- print the key in logs
- paste it into screenshots or support tickets
- commit it to Git

## Local `.env.local`

Use this shape locally:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

`.env.local` is ignored by Git. `.env.example` is safe to commit because it contains no real values.

## Vercel Environment Variables

When deploying later, add these variables in Vercel Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Use the same variable names across Production, Preview, and Development unless you intentionally connect each environment to a different Supabase project.

## Client Utility Split

The project has three Supabase utility entry points:

- `lib/supabase/browser.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`

`browser.ts` creates a browser client for Client Components. It uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`server.ts` creates a cookie-aware server client for Server Components, Server Actions, and Route Handlers. It also uses only the public Supabase URL and public/anon key. It does not use the service role key.

`admin.ts` creates a service-role admin client. It is server-only and must be used only from trusted server code after authorization checks are implemented.

## Security Rules

- Keep `.env.local` out of Git.
- Only `NEXT_PUBLIC_` variables may be used in browser code.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Do not create broad RLS policies just to make development easier.
- Prefer server actions or route handlers for sensitive writes.
- Do not expose participant phone numbers or normalized phone numbers to browser public screens.
