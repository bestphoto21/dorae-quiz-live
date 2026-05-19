# Participant Registration

This step implements the participant entry flow for `/e/[eventCode]`, `/e/[eventCode]/join`, and `/e/[eventCode]/play`.

It does not implement answer submission, scoring, ranking, lucky draw, or Q&A submission yet.

## Flow

1. A participant scans the event QR code and lands on `/e/[eventCode]`.
2. The landing page loads only safe event information and checks whether the event is active.
3. The participant moves to `/e/[eventCode]/join`.
4. The participant enters name, phone number, optional organization, optional group, and privacy consent.
5. A server action validates the input, normalizes the phone number, and writes to `participants`.
6. The server creates a signed HTTP-only participant session cookie.
7. The participant is redirected to `/e/[eventCode]/play`.

## Phone Normalization

`phone` stores the original input value. `phone_normalized` stores the duplicate-check value.

The current helper keeps only digits and prioritizes Korean mobile numbers such as `01012345678`. A value starting with `82` can be converted into a leading `0` format. Very short, very long, or non-mobile-looking numbers are rejected.

If international participation becomes important, replace this with a stricter agreed format such as E.164 and keep the same `event_id + phone_normalized` uniqueness rule.

## Duplicate Participants

The database prevents duplicate `phone_normalized` values within the same event.

When the same phone number joins again:

- The existing participant row is reused.
- Name, organization, group, consent, display name, and original phone input are updated with the latest form input.
- The behavior is intentional so typo fixes and changed organization/group values can be reflected before the event starts.

## Participant Session Cookie

Participants are not Supabase Auth users. The app stores a separate signed cookie after registration.

Cookie payload:

- `participant_id`
- `event_id`
- `event_code`
- `exp`

Cookie properties:

- Signed with HMAC-SHA256.
- Uses `PARTICIPANT_SESSION_SECRET`.
- `httpOnly: true`.
- `sameSite: lax`.
- `secure: true` in production.
- Expires after about 7 days.
- Scoped to `/e/[eventCode]`.

Client JavaScript cannot read the cookie. If a participant changes the cookie value manually, signature verification fails and the user is sent back to the join page.

## Privacy Rules

`phone` and `phone_normalized` are personal data.

Rules:

- Never show phone values on participant screens.
- Never return phone values from participant or screen APIs.
- Never include phone values in `operation_logs.detail`.
- Keep service-role Supabase access in server code only.
- Keep participant state APIs limited to event state, safe question fields, and answer reveal status.

## Question Safety

Participant pages must not query raw `questions` rows directly from the browser.

The participant state API returns:

- question text
- options
- question type
- time limit
- `correct_option` only when `reveal_answer=true`

Until the operator reveals the answer, `correct_option` must stay server-side.

## Current Limits

Not implemented yet:

- answer submission
- duplicate answer prevention in the UI
- response timing
- score/ranking calculation
- realtime subscriptions
- lucky draw entry logic
- Q&A submission

## Next Step

The next implementation step should connect `/e/[eventCode]/play` option buttons to a server action or route handler that writes to `answers`.

That path must verify:

- the signed participant session cookie
- event activity
- current `live_state`
- question timing
- duplicate answer prevention
- server-side `is_correct` calculation
