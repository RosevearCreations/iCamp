# Numeric Keypad / DTMF Interaction Engine

## Purpose

Build 011 turns the Build 010 IVR state-machine foundation into a usable numeric keypad interface without creating a second communications business model.

DTMF input remains a provider/transport concern. Campground actions are expressed as provider-neutral semantic transitions such as:

- prompt site number;
- prompt reservation number;
- prompt pass number;
- repeat;
- back;
- main menu;
- staff transfer;
- lookup site/reservation/pass.

## Keypad conventions

The short main menu uses:

- `1` — site number entry;
- `2` — reservation number entry;
- `3` — pass number entry;
- `8` — repeat the current main prompt;
- `9` — transfer to campground staff;
- `0` — return to the main menu;
- `*` — back to the main menu from an entry flow.

A trailing `#` may terminate a multi-digit site, reservation or pass entry.

Menu design is intentionally short. Deeper business workflows are introduced by later domain builds rather than turning one IVR menu into an unmaintainable tree.

## Numeric entry

Build 011 supports transient numeric collection for:

- site identifiers;
- reservation identifiers;
- pass identifiers.

Accepted entries are returned to trusted server code as a transient value for downstream lookup. They are not persisted as keypad input.

The DTMF engine currently accepts up to 12 numeric digits for these identifiers.

## Timeout and retry behavior

Each IVR session uses the existing bounded retry model:

- default maximum retries: 3;
- invalid keypad input increments the retry count;
- DTMF timeout increments the retry count;
- a valid menu selection or accepted numeric entry resets retries;
- reaching the retry limit routes to staff transfer.

The session lifetime remains 15 minutes from Build 010.

## Sensitive input

PIN and verification input are classified as sensitive.

Raw sensitive digits:

- are never written to provider-event metadata;
- are never written to IVR event evidence;
- are never returned by I.T. health;
- are never included in ordinary error summaries;
- are never echoed in caller-facing webhook responses.

The reusable masking helper emits only a redaction marker and digit count, for example `[redacted:4]`.

Build 011 does not treat possession of a PIN or caller ID as authorization. Build 013 owns identity verification and risk-based authentication.

## Signed provider boundary

DTMF events use the same signed webhook boundary as Build 010.

The mock provider normalizes:

- `dtmf.input`;
- `dtmf.timeout`.

The normalized in-memory event may temporarily contain the keypad value so the server can route it, but persistence deliberately records only:

- input kind;
- digit count;
- sensitivity flag;
- `rawDigitsExcluded: true`;
- semantic IVR transition/action.

DTMF provider event status is forced to the semantic event type so an external provider cannot accidentally copy digits into the status field.

## Idempotency

DTMF provider events reuse the Build 009 provider-event uniqueness boundary.

A duplicate provider event:

- is acknowledged;
- does not advance the IVR state again;
- does not create another IVR event;
- does not return a previously entered numeric value.

## Staff transfer

The `9` menu choice and exhausted retry paths use the same same-campground staff transfer route from Build 010.

The raw transfer destination remains inside trusted server code.

## Diagnostics

I.T. & Analysis may show only aggregate DTMF signals:

- DTMF semantic inputs in the last 24 hours;
- invalid inputs in the last 24 hours;
- timeouts in the last 24 hours.

It never shows keypad values.

## Persistence model

Build 011 requires no new domain tables.

It reuses:

- `icamp_private.communication_provider_events` for normalized, digit-free provider evidence;
- `icamp_private.voice_ivr_sessions` for current semantic state/retry position;
- `icamp_private.voice_ivr_events` for append-only semantic transitions.

This preserves the Build 010 rule that raw keypad digits do not belong in ordinary voice/IVR persistence.

## Channel matrix

| Channel | Build 011 support |
| --- | --- |
| Web/PWA | Safe aggregate DTMF health; later domain UI can invoke the same lookup actions |
| Voice | Full sandbox voice transport from Build 010 |
| IVR/DTMF | Full Build 011 keypad routing foundation |
| Speech | No speech-to-intent mapping yet; uses staff fallback |
| SMS/MMS | Unchanged Build 009 foundation; Build 012 adds the conversation gateway |
| Staff-assisted | Transfer available for explicit choice, timeout or retry exhaustion |
| Secure link | Used later when a protected or visual workflow cannot safely remain on keypad |

## Automated proof

Build 011 CI proves:

- menu routing;
- repeat/back/main conventions;
- site/reservation/pass numeric collection;
- timeout and invalid-input retry limits;
- staff transfer after retry exhaustion;
- provider normalization for DTMF input/timeouts;
- provider-event idempotency;
- sensitive-input redaction;
- no raw test digits in persisted provider metadata;
- no raw test digits in IVR evidence;
- safe aggregate DTMF health.

## Manual setup

None.

The mock voice provider remains sufficient for Build 011 acceptance. No phone-number purchase, telephony account or provider credential is required.
