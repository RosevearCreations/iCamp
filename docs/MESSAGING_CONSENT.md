# Messaging Consent & Preference Policy

## Purpose

This document is the source of truth for iCamp messaging consent, purpose separation, provider STOP/START/HELP synchronization and jurisdiction policy.

## Purpose separation

Every outbound message is classified as one of:

- **transactional** — a message directly tied to a requested transaction or stay;
- **operational** — campground/service operations;
- **marketing** — promotional/commercial outreach.

A provider transport state never replaces purpose-specific consent.

## STOP

STOP is a transport-level safety boundary.

Under the conservative fallback policy it suppresses all ordinary SMS/MMS dispatch to the endpoint and also withdraws/turns off marketing messaging. This prevents a purpose-classification mistake from bypassing a user's explicit STOP.

## START

START reverses provider transport suppression but does not automatically create marketing consent under the conservative Canadian policy.

Marketing remains blocked until current granted marketing consent exists.

## HELP

HELP is always normalized as a compliance event. It does not change consent or suppression state.

The active rule may allow a HELP or consent-confirmation response while normal messaging is suppressed.

## Consent evidence

Marketing consent evidence is append-only in `communication_consents` and current user preference is held in `communication_preferences`.

The Build 014 preference ledger adds normalized state transitions without copying:

- phone numbers;
- endpoint values;
- raw message text;
- provider webhook bodies.

## Jurisdiction policy

`communication_compliance_rules` allows each campground to define a default or jurisdiction-specific rule.

The application fallback is deliberately conservative and Canadian:

- jurisdiction `CA`;
- marketing requires granted consent;
- STOP suppresses ordinary messaging;
- START does not grant marketing consent;
- HELP/compliance responses may be delivered while suppressed.

Configurable policy is an engineering control and does not replace legal review of a campground's actual messaging program.

## CASL readiness

For Canadian commercial messaging, the Build 014 model can retain purpose-specific consent evidence and withdrawal timestamps, keep promotional messages blocked without current consent, and maintain an unsubscribe/preference audit trail.

Future sender-identification/template requirements can build on the same policy without changing the ledger.
