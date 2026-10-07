# Telephone/SMS Identity, Verification & Staff Re-Authentication

## Security boundary

Build 013 treats caller ID, SMS sender address and phone possession as **routing hints only**. They never prove identity, campground authorization or permission to perform a business action.

Telephone and SMS verification use one provider-neutral verification domain shared with the existing authentication, authorization and privileged-action controls.

## Guest verification

Guest site/reservation/pass intents use two pieces of evidence:

1. the transient site/reservation/pass reference supplied by the guest; and
2. a short-lived one-time verification code delivered through the selected voice/SMS channel.

The reference is stored only as a salted scrypt verifier bound to its semantic kind. The one-time code is also stored only as a salted scrypt verifier. Raw site/reservation/pass numbers and raw verification codes are not persisted by the Build 013 verification domain.

Build 013 supplies identity proof for these lookups. The actual reservation/site/pass records arrive in later roadmap builds, so verification does not invent or pre-seed business records that do not yet exist.

## Staff verification

Staff telephone/SMS workflows require a dedicated numeric channel PIN stored only as a salted scrypt verifier.

A privileged channel action requires:

- the staff channel PIN; plus
- either a short-lived one-time code or a recently re-authenticated approved staff session.

The resulting channel verification is short-lived and produces AAL2-equivalent verification evidence for the channel challenge without silently elevating the underlying browser session.

Campground authorization remains separate. A verified staff identity still must have the permission required by the target action.

## Re-authentication reuse

Build 013 reuses the Build 006 recent re-authentication timestamp and privileged-action assurance helpers. It does not create a competing session system.

A recent browser/password re-authentication may satisfy the second factor of a staff telephone/SMS challenge only when:

- the session belongs to the same active staff user;
- the session has not expired or been revoked; and
- the Build 006 freshness check still passes.

## Rate limits, lockout and fraud signals

Verification is deliberately bounded:

- six-digit one-time codes;
- five-minute challenge lifetime by default;
- maximum five challenge attempts by default;
- fifteen-minute lock period after repeated failures;
- issuance rate limit per campground/channel/remote endpoint;
- separate staff-PIN failure counter and lockout;
- semantic fraud/abuse signals such as repeated failure, context mismatch, expiry and delivery failure.

Fraud signals are categorical only. They do not contain raw PINs, codes, phone numbers, message bodies or reservation/site/pass numbers.

## No secret echo

Verification code and staff PIN input is transient.

The application must never place raw codes or PINs in:

- API responses;
- provider-event metadata;
- audit JSON;
- ordinary logs;
- I.T. health;
- SMS replies;
- IVR semantic event history.

## Channel parity

| Channel | Build 013 support |
| --- | --- |
| Web/PWA | Existing authenticated session and recent re-authentication remain canonical |
| Voice/IVR/DTMF | Site/reservation/pass entries are verification-gated; PIN/code input remains sensitive and transient |
| SMS/MMS | Structured lookup commands remain verification-gated and use the same challenge domain |
| Staff-assisted | Staff handoff remains available and does not bypass identity/authorization |
| Secure link | Existing secure handoff remains available for protected/visual workflows |

## Provider and cost boundary

Build 013 does not require a paid provider, telephone number, production SMS registration or new production secret.

Challenge delivery is an injected provider callback. The existing mock/sandbox voice and messaging providers remain the development default, and a later real provider can deliver the one-time code without changing verification state, authorization or audit rules.
