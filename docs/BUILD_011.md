# Build 011 — Numeric Keypad/DTMF Interaction Engine

Status: **IMPLEMENTED — PROMOTION PENDING**

## Roadmap scope

Build 011 implements:

- numeric keypad collection;
- short menu conventions;
- repeat/back/main-menu navigation;
- site/reservation/pass numeric entry;
- bounded timeouts and retry limits;
- sensitive PIN/verification redaction;
- automated DTMF flow verification.

## Runtime

New DTMF engine:

- `lib/voice/dtmf.mjs`;
- `lib/voice/dtmf.d.mts`.

The engine maps raw provider keypad input to semantic IVR actions without making numeric digits part of the durable business model.

Build 010 IVR states are extended for:

- `site_entry`;
- `reservation_entry`;
- `pass_entry`.

The signed voice webhook now accepts normalized `dtmf.input` and `dtmf.timeout` events.

## Main menu

- `1` → site entry;
- `2` → reservation entry;
- `3` → pass entry;
- `8` → repeat;
- `9` → staff transfer;
- `0` → main menu;
- `*` → back/main from entry flows.

## Data safety

Raw keypad strings are transient only.

Provider-event evidence stores only:

- input kind;
- digit count;
- sensitivity flag;
- raw-digits-excluded marker.

IVR evidence stores only semantic state/action fields.

PIN and verification values are classified as sensitive and receive redaction treatment. Sensitive values are not returned as transient lookup entries.

## Database

**No new Build 011 table is introduced.**

Build 011 deliberately reuses the existing Build 009/010 provider-event and IVR evidence model. This avoids duplicating communications state and preserves the rule that raw DTMF values are not ordinary persisted data.

## Reliability

- DTMF events are idempotent by provider event ID;
- duplicates do not replay state transitions;
- invalid input and timeout retries are bounded;
- valid selections reset retries;
- exhausted retries transfer to staff;
- multi-digit site/reservation/pass values are available only transiently to trusted server code;
- caller-facing webhook responses expose semantic next actions, not entered identifiers.

## I.T. & Analysis

Voice health now includes aggregate DTMF activity:

- inputs in 24h;
- invalid inputs in 24h;
- timeouts in 24h.

Keypad digits are never displayed.

## Automated proof

New CI command:

`npm run dtmf:verify`

The lifecycle proof exercises:

- signed-provider-normalized DTMF-compatible event shapes;
- menu selection;
- site entry;
- reservation entry;
- pass entry;
- back/repeat/main conventions;
- sensitive PIN classification;
- duplicate provider-event handling;
- timeout/retry exhaustion;
- staff transfer;
- aggregate DTMF health;
- database queries proving known raw test digits are absent from provider metadata and IVR evidence.

Unit tests also cover DTMF parsing, validation, masking and IVR entry-state timeout behavior.

## Provider/cost boundary

The default mock/sandbox voice provider remains the Build 011 test adapter.

No external account, phone number, billing setup, regulatory registration or production provider secret is required.

## Manual action

**None.**

## Next build

**Build 012 — SMS/MMS Conversation & Command Gateway**
