# Build 255 — Owner-Ordered Seven-App Contract Handoff

Schema: `rosevear.seven-app-identity-registry.v1`
Event envelope: `rosevear.seven-app-source-envelope.v1`
Sender: `icamp`
Build: `255`
Source: GitHub reviewed iCamp `dev` and `main` commits (fill exact SHA after verified release)
Deployment: exact SHA Vercel READY and HTTP/alias readback **required**

| Order | App | Connection model | Safe contract handoff |
| --- | --- | --- | --- |
| 1 | ai-data-platform | MASTER_TOP_TIER | Versioned identity schema and independent source validation |
| 2 | rosevear-ai-hub | MASTER_APPLICATION | Independent host OFF and source custody; never auto-enable |
| 3 | rosevear-comms-hub | MASTER_APPLICATION | Consent-aware private routing, separate signer enrollment |
| 4 | icamp | GOVERNED_EXTERNAL_SHELL | Campground-scoped role and tenant metadata, fail-closed T5 |
| 5 | yw | GOVERNED_EXTERNAL_SHELL | Independent tenant-scoped job and worker metadata, no guest PII |
| 6 | devilndove | DIRECT_MASTER_APPLICATION | Brand-owned catalog only, no iCamp guest contacts |
| 7 | rosiedazzlers | DIRECT_MASTER_APPLICATION | Separate booking/vehicle media grants, no iCamp guest PII |

Security tiers: `T0_PUBLIC → T1_SOURCE → T2_SIGNED_CUSTODY → T3_SCOPED_IDENTITY → T4_INDEPENDENT_REVIEW → T5_LIVE_TRANSPORT`. A T1–T4 audit is not a T5 grant.

Source-reviewed contracts: exact app ID/repository/model, version, SHA, declared tenant, non-sensitive metadata-only event type, fresh source nonce and per-app role. Independently issued Ed25519 original signatures, valid protected pins, proper owner/tenant authority, recipient acknowledgment and observed real network transport must remain independently verified outside the registry.

**Canonical release record**: merge PR for Build 255 into `dev`, then source-exact `main`; include final SHA, exact Vercel deployment and protected checks in the release PR. All Master CONNECTED, receiver ON, live production DB adoption and owner ACCEPTED claims remain **HOLD** absent external proof.

Next proposed build: **256 — Durable Signed-Event Renewal, Replay/Expiry Escalation & Revocation Propagation**.

No passwords, private keys, tokens, raw device evidence or payment/customer PII may be copied into another repository. Keep Standard/Meadow and selectable Orbit unchanged.
