# Build 282 — original provider alert and recovery escalation

The protected /sysop/acceptance282 console separates historical signed restore
receipts from current Build 281 evidence. It never treats an expired owner MFA
session as proof of compromise. It creates an immutable original recovery
incident for an actual current HOLD linked to an independently reverified
historical restore receipt. A distinct approved original AAL2 operator can
verify and record the real external provider's signed delivery acknowledgment.

Migration 0256 is required on the independently identified original production
database. Do not migrate an unknown database. A disposable migration test
is not production adoption. No credential reset, access grant, production
restore or direct customer notification is performed.

## Original provider procedure

1. Open the protected Build 282 console after completing original provider
   enrollment and the Build 281 original evidence checks.
2. Select a historically verified original ACK and a current HOLD reason.
   Record the recovery incident. Copy its UUID and original ACK digest.
3. Through the authorized original provider's independently operated delivery
   system, arrange actual delivery of that incident. Do not send credentials
   or tenant details. The console does not send or schedule messages.
4. Obtain the exact UTF-8 JSON statement signed by the original approved
   provider key. Fields: kind (icamp-original-provider-alert-delivery-v1),
   alertId (incident UUID), priorAckDigest (original ACK SHA-256), providerId,
   keyId, eventId (new unique 16–160 character identifier), deliveredAt
   (actual ISO UTC time).
5. A different original AAL2 reviewer submits the unmodified JSON and
   86-character unpadded base64url Ed25519 signature within five minutes.
   The signature, approved fingerprint, incident ID, prior ACK digest and
   event uniqueness must verify. Historical delivery does not close an
   incident or certify current owner recovery.
6. If the actual provider cannot supply the receipt, leave DELIVERY HOLD.
   Automatic transmission, independent provider enrollment, and ongoing
   incident polling require a separately authorized real integration.

Protected release requires format, lint, types, tests, build, disposable
migration verification, browser checks and security scans. Production
software readiness is separate from original field acceptance.
