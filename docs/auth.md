# Admin Authentication

This project uses Supabase Auth for administrator sign-in and `public.admin_profiles` for application-level admin authorization.

This step implements the login shell and admin route protection only. It does not implement participant registration, quiz CRUD, realtime operation, or broad RLS policies.

## Flow

1. An administrator opens `/admin/login`.
2. The login form submits email and password to a server action.
3. The server action calls Supabase Auth `signInWithPassword`.
4. After Auth succeeds, the server checks `public.admin_profiles` through the server-only admin helper.
5. Only active admin profiles with `is_active = true` can continue.
6. Successful login redirects to `/admin/events`.
7. Logout calls Supabase Auth `signOut` and redirects to `/admin/login`.

## Auth Users and Admin Profiles

Supabase Auth stores the account in `auth.users`.

The application stores admin authorization data in `public.admin_profiles`.

`admin_profiles.id` must match `auth.users.id`.

This split keeps authentication and application authorization separate:

- Supabase Auth verifies the password and session.
- `admin_profiles` decides whether the authenticated user can operate the admin console.
- `event_admins` will later decide which events an admin can operate.

## First Super Admin

Create the first admin user in Supabase Dashboard:

1. Open Supabase Dashboard.
2. Go to Authentication > Users.
3. Create a user with email and password.
4. Copy the created user's UUID.
5. Insert or update the matching `admin_profiles` row in SQL Editor.

Use placeholders first, then replace them with real values:

```sql
insert into public.admin_profiles (id, email, name, role, is_active)
values (
  'AUTH_USER_ID_HERE',
  'admin@example.com',
  '관리자',
  'super_admin',
  true
)
on conflict (id) do update
set
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();
```

## Role Notes

`super_admin` is intended for platform-wide access.

`event_admin` is intended for assigned event administration.

`operator` is intended for live event operation.

`screen_operator` is intended for projection and screen control.

`qna_moderator` is intended for audience Q&A moderation.

Detailed event access checks should be implemented in the next step with `event_admins`.

## Middleware and Authorization Split

Next.js 16 calls Middleware "Proxy", so this project uses `proxy.ts`.

The proxy performs only an optimistic session check for `/admin` routes:

- `/admin/login` is public.
- other `/admin` routes require a Supabase Auth session.

The proxy does not check `admin_profiles`.

Actual admin authorization happens in `requireAdmin()`:

- `getCurrentUser()` verifies the current Supabase Auth user.
- `getCurrentAdmin()` reads `public.admin_profiles` with the server-only admin client.
- inactive or missing admin profiles return `null`.
- `requireAdmin()` redirects invalid admins to `/admin/login`.

## Service Role Security

`SUPABASE_SERVICE_ROLE_KEY` is used only by `lib/supabase/admin.ts`.

Rules:

- Never import the admin client from Client Components.
- Never expose the service role key in browser bundles.
- Never log the service role key.
- Keep `.env.local` out of Git.
- Use the admin client only from trusted server code.

`admin_profiles` currently has RLS enabled and no permissive public policy. That is why `getCurrentAdmin()` uses the server-only admin client for now.

## Not Implemented Yet

- Admin invitation flow
- Event-scoped permission checks through `event_admins`
- Full RLS policies for admin reads/writes
- Password reset flow
- Participant registration
- Quiz CRUD
- Realtime live control
- Operation log writes

## Next Step

The next step should add event-scoped authorization helpers:

1. Load the current active admin profile.
2. Check whether the admin is `super_admin`.
3. For non-super admins, check `event_admins`.
4. Add server-side helpers such as `requireEventAdmin(eventId)`.
5. Start wiring admin pages to real data only after these checks are in place.
