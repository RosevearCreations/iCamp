# Build 254 Owner-Ordered Seven-App Security & Receipt Handoff

A source-only handoff (not network, signer, or owner authority). The owners'
required application order is preserved; **runtime CONNECTED remains HOLD**.
Source of roles: `.github/rosevear-master-topology.v1.json`.

1. **ai-data-platform** — `RosevearCreations/ai-data-platform`; top-tier
   Master and contract validation authority, tier T0–T5 enforced independently.
   iCamp does not claim the live AI Data Platform receipt has been authenticated.
2. **rosevear-ai-hub** — `RosevearCreations/rosevear-ai-hub`; Master, physical
   local-host OFF/ON custody separate and no iCamp build may energize it.
3. **rosevear-comms-hub** — `RosevearCreations/rosevear-comms-hub`; Master,
   public discovery vs private signed operations must stay separate.
4. **iCamp** — `RosevearCreations/iCamp`; governed external shell. Build 254
   introduces guarded nonce-unique original signed receipt ledger, MFA/tenant/
   owner-scoped claims and second-person append-only remediation HOLDs.
   Three original Master Ed25519 receipts must be separately verified, dated
   within 15 minutes and pinned to the exact deployed iCamp source SHA; the
   derived freshness view identifies renewal horizons. The underlying
   receiver/owner decision remains **HOLD**.
5. **YW** — `RosevearCreations/yw`; governed external shell. Receive only
   versioned high-level events with independently signed source, scoped
   permissions and explicit owner authority; no iCamp guest PII transfer.
6. **devilndove** — `RosevearCreations/devilndove-site`; direct Master
   application, not a campground tenant. Brand-safe products/communications
   only with independent consent and source signing.
7. **rosiedazzlers** — `RosevearCreations/rosiedazzlers`; direct Master
   application, not a campground tenant. Booking/vehicle/media only under
   independent consent and source signing.

## Contract for receiving next application

`schema=rosevear.seven-app-original-security-handoff.v1`
`sender=icamp`
`build=254`
`main_sha=<verify GitHub main after production READY>`
`production_deployment=<exact-SHA READY only>`
`master_original_receipts=<3 independently signed FRESH or HOLD>`
`nonce_admission=<verified original DB 0234 migration and claims or HOLD>`
`independent_disposition=<original distinct reviewer evidence or HOLD>`
`receiver_connected=HOLD`
`formal_owner_acceptance=HOLD`

Do not send private signing keys, credential values, database passwords, raw
device evidence, or guest/contact/payment PII to another repository. This is
not a remote API. Local schema/contract tests and developer receipts cannot
be substituted for original source signing. Existing integration protocols
must independently validate their real runtime senders and T5 authority.

The Standard / Meadow theme belongs to the iCamp platform, not only Camp
Rosevear. All visuals, campground photographs and Orbit choice are retained.
Future cross-app work: see
`docs/roadmap/BUILD254_264_SEVEN_APP_SECURITY_PRODUCT_EXPANSION.md`.
