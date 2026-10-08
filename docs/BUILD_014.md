# Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger

Status: **IMPLEMENTED — PROMOTION GATES PENDING.**

## Roadmap scope

Build 014 delivers:

- strict separation of transactional, operational and marketing messaging purposes;
- append-only consent evidence and normalized preference events;
- provider-neutral STOP/START/HELP synchronization;
- outbound enforcement before an SMS/MMS provider is called;
- configurable jurisdiction rules with a conservative Canadian fallback;
- technical CASL-readiness controls for commercial messaging consent and unsubscribe evidence.

## Delivered design

### Existing Build 009 records remain canonical

Build 014 extends, rather than replaces, the Build 009 communications model.

- `communication_preferences` remains the current purpose/channel preference.
- `communication_consents` remains append-only purpose/channel consent evidence.
- Build 014 adds only the compliance policy and provider-synchronization records needed to make those records enforceable for messaging.

### Private compliance and preference state

Migration `0018_messaging_consent_preference_ledger.sql` adds:

- `icamp_private.communication_compliance_rules`;
- `icamp_private.messaging_preference_state`;
- `icamp_private.messaging_preference_events`.

The preference-event ledger is append-only. It stores semantic actions and provider event identifiers, never raw message bodies or endpoint values.

### STOP

A recognized STOP keyword:

1. records a normalized provider event;
2. sets provider-level messaging suppression according to the active jurisdiction rule;
3. disables marketing SMS and MMS preferences;
4. appends marketing-consent withdrawal evidence for SMS and MMS;
5. blocks ordinary outbound SMS/MMS before the provider adapter is invoked.

Compliance/help confirmations may be allowed by the active rule even while the endpoint is suppressed.

### START

START clears provider-level transport suppression.

The conservative Canadian fallback deliberately does **not** treat START as fresh marketing consent. A separate current marketing-consent record is still required before promotional SMS/MMS can be sent.

A jurisdiction rule can explicitly change that behavior where lawful and operationally appropriate.

### HELP

HELP is normalized into the same preference ledger without changing the user's suppression state. It remains available while suppressed when the active rule allows compliance responses.

### Jurisdiction rules

Rules can configure:

- whether marketing requires consent;
- optional consent evidence expiry;
- whether STOP suppresses all normal messaging;
- whether START may create marketing consent;
- whether HELP/compliance responses remain available while suppressed.

If no campground rule exists, iCamp fails safe to a conservative `CA` policy:

- marketing consent required;
- no automatic consent expiry;
- STOP suppresses normal messaging;
- START does not restore marketing consent;
- HELP/compliance responses allowed.

This is technical compliance readiness, not a legal certification.

## Enforcement

`startOutboundMessage` now calls the consent/preference policy before creating a provider dispatch.

Marketing requires:

- no provider-level suppression;
- an enabled marketing preference; and
- current granted consent when the jurisdiction rule requires it.

Operational/transactional messages remain purpose-distinct, but ordinary messages are still blocked by provider-level STOP suppression.

## Provider synchronization

Inbound exact STOP/START/HELP control keywords are recognized before ordinary menu/intent parsing.

The provider event ID is used for idempotent preference-ledger synchronization, and the same inbound message still receives privacy-safe messaging evidence without persisting its raw body.

## I.T. health

I.T. & Analysis now shows only aggregates:

- tracked/suppressed endpoint counts;
- STOP/START/HELP event counts for 24 hours;
- current marketing granted/withdrawn evidence counts;
- active compliance-rule count;
- explicit confirmation that bodies and endpoint values stay excluded.

## Automated proof

Build 014 adds:

- keyword and policy unit tests;
- schema/privacy verification;
- repository integration tests;
- a PostgreSQL lifecycle proof covering STOP, suppressed dispatch rejection, HELP response allowance, START, marketing still blocked after START, explicit marketing consent, provider-event idempotency and privacy-safe ledger evidence;
- a dedicated database CI gate;
- advisor-driven covering index closure for compliance-rule foreign keys.

## Manual action

**None expected.**

No paid SMS provider, production number or provider-specific compliance service is required for this build.

## Promotion

Promotion evidence is recorded here only after the exact tested tree has passed `dev`, `main`, hosted Supabase verification and final closeout gates.

## Next build

**Build 015 — Telephone/SMS Workflow Parity Harness**
