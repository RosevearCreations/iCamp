# Build 014 — Messaging Consent, STOP/START/HELP & Preference Ledger

Status: **FULLY PROMOTED — `main` GREEN.**

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

**None.**

No paid SMS provider, production number or provider-specific compliance service is required for this build.

## Promotion evidence

- implementation PR: #47;
- exact feature head: `e75c24008c77b780f6a931646c5016a541d60002`;
- feature-head CI `37702001171`: GREEN;
- feature-head CodeQL `37702001138`: GREEN;
- feature-head Secret Scan `37702001077`: GREEN;
- first dev merge: `202b99028a68e34a310a7bf82adbde6677b630f0`, with zero file differences from the tested feature tree;
- first independent dev CI `37703423375`: GREEN;
- first independent dev CodeQL `37703423355`: GREEN;
- first independent dev Secret Scan `37703423347`: GREEN;
- advisor-index closure PR: #48;
- exact advisor-fix head: `76a51162fc9b233ee75dfcdd55df564a28fe85d6`;
- advisor-head CI `37703934487`: GREEN;
- advisor-head CodeQL `37703934585`: GREEN;
- advisor-head Secret Scan `37703934588`: GREEN;
- final dev merge: `6ea0eadfba10c92d3863d5792b273e12728d878e`, with zero file differences from the tested advisor-fix tree;
- final independent dev CI `37704864177`: GREEN;
- final independent dev CodeQL `37704864207`: GREEN;
- final independent dev Secret Scan `37704864175`: GREEN;
- production promotion PR: #49;
- production PR CI `37706012432`: GREEN;
- production PR CodeQL `37706012505`: GREEN;
- production PR Secret Scan `37706012438`: GREEN;
- runtime production merge: `328c5939d506953a19d248a9b2a042b9ad621bef`, with zero file differences from the final GREEN dev tree;
- independent runtime-main CI `37706200147`: GREEN;
- independent runtime-main CodeQL `37706200138`: GREEN;
- independent runtime-main Secret Scan `37706200151`: GREEN;
- hosted Supabase migration `20261007234014 / 0018_messaging_consent_preference_ledger`: applied;
- hosted Supabase migration `20261007234624 / 0019_communication_compliance_fk_indexes`: applied;
- hosted Supabase Security Advisor: zero findings;
- Build 014 foreign-key performance findings: closed; remaining advisor notices are expected low-traffic unused-index INFO only.

The final source-of-truth closeout is promoted through the same protected `dev` → `main` path before Build 014 is reported complete.

## Next build

**Build 015 — Telephone/SMS Workflow Parity Harness**
