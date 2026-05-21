# Lucky Draw

This step implements prize management, winner selection, saved draw results, and screen presentation.

It does not implement Q&A, score ranking, Kakao/SMS notification, winner export, or prize images.

## Prize Management

Prizes are stored in `prizes`.

Fields used:

- `event_id`
- `name`
- `quantity`
- `created_at`

The admin draw page supports:

- create prize
- update prize name and quantity
- delete prize only when no `draw_winners` row is linked
- show total winner history per prize
- show remaining quantity

Remaining quantity is:

```text
prizes.quantity - count(draw_winners where status in pending, claimed)
```

`cancelled` and `redrawn` rows are not counted as active prize fulfillment, but they remain winner history.

## Source Types

`draw_winners.source_type` uses the existing allowed values.

### `all_participants`

The pool is every participant in the event.

### `correct_answers`

The pool is every participant who has at least one `answers.is_correct = true` row in the event.

The admin page also allows an optional session filter. When a session is selected, only correct answers from questions in that session are used.

### `question_correct_answers`

The pool is participants who answered one selected question correctly.

This source requires `source_question_id`.

## Random Selection

Winner selection happens on the server.

The app loads the eligible pool and selects one participant with Node `crypto.randomInt`. `Math.random` is not used for draw selection.

The selected winner is inserted into `draw_winners` before the screen is changed. A winner is never shown only in memory.

## Duplicate Winner Policy

The current database has a unique constraint on:

```text
draw_winners(event_id, participant_id)
```

That means the same participant cannot win more than once in the same event.

This applies even if the previous winner row is later marked:

- `cancelled`
- `redrawn`

The UI defaults to excluding already won participants. If a future duplicate-winner option is needed, the DB constraint must be changed with a migration and the draw logic should be updated together.

## Winner Status

`draw_winners.status` is used as follows.

- `pending`: selected but not fulfilled yet
- `claimed`: prize was received
- `cancelled`: selected winner was cancelled
- `redrawn`: selected winner was replaced by a new draw

`claimed_at` is set only for `claimed` winners.

## Redraw

Redraw marks the existing winner as `redrawn`, then selects a new winner using the same saved prize/source/question condition.

Because the current schema does not store `source_session_id`, a redraw for a session-filtered `correct_answers` draw cannot replay that session filter. If that distinction becomes important, add a schema field in a future migration.

## Screen Presentation

After a winner is inserted, the app updates `live_state`:

- `mode = 'draw'`
- `screen_scene = 'draw_winner'`
- `screen_payload` contains presentation-safe winner data and animation metadata

Allowed screen payload fields:

- `winner_id`
- `animation_id`
- `participant_display_name`
- `winner_name`
- `prize_name`
- `prize_title`
- `source_type`
- `draw_phase`
- `candidate_names`
- `message`
- `duration_ms`
- `countdown_seconds`
- `created_at`

The screen API still sanitizes the payload and returns only these fields.
The rolling animation is presentation only. The selected winner is inserted into
`draw_winners` before the screen starts the animation, and the final result uses
that saved winner.

## Celebration Effect

When the final winner screen appears, the screen plays a short celebration effect:

- "당첨!" pops into place.
- The winner card briefly glows with a soft gold highlight.
- Colorful paper confetti bursts in front of the winner text, then falls away.
- If enabled on the screen, a short generated pop sound plays at the same time.

This is a screen-only visual effect. It does not select, change, or re-randomize
the winner. The final winner is still the `draw_winners` row saved by the server.
If the operator switches to another scene during the animation, the front
confetti effect is cleaned up with the screen component.

The pop sound is generated with the browser Web Audio API. Browsers can block
automatic audio, so the screen operator must press "효과음 켜기" once on the
screen page before the draw. The screen PC audio output must be connected to the
venue sound system if the effect should be heard in the room. If audio unlock or
playback fails, the visual celebration still runs.

## Privacy Rules

Never put these fields in `screen_payload`:

- `phone`
- `phone_normalized`
- `email`
- `participant_id`
- raw participant rows
- private admin data

The screen displays `display_name` first and falls back to `name`. If an event needs stricter privacy, add a name masking function before writing `screen_payload`.

## Operation Logs

The draw flow writes these actions:

- `prize_created`
- `prize_updated`
- `prize_deleted`
- `draw_winner_selected`
- `draw_winner_claimed`
- `draw_winner_cancelled`
- `draw_winner_redrawn`

Log details include operational identifiers such as `event_id`, `prize_id`, `source_type`, `source_question_id`, `screen_scene`, `draw_phase`, and `winner_id`.

Logs must not include participant ids, phone numbers, or email addresses.

## Current Limits

Not implemented yet:

- winner Excel download
- prize images
- SMS or Kakao notification
- duplicate winner allow option
- weighted draw rules
- Q&A integration
