# Build 151 / QL-256 — Authentic signer provisioning and source custody evidence

**Repository:** RosevearCreations/iCamp  
**Evidence collected:** 2026-10-29, public GitHub and Vercel metadata only.  
**Source A (independently checked):** `32b7c466ad34f7018863c8b837f94c5a3b1103a5`  
**GREEN source CI:** https://github.com/RosevearCreations/iCamp/actions/runs/40887376895  
**Verified CI head_sha:** `32b7c466ad34f7018863c8b837f94c5a3b1103a5`; completed successfully.  
**Immutable original QL-246 proof at A:** HTTP 404 at `https://raw.githubusercontent.com/RosevearCreations/iCamp/32b7c466ad34f7018863c8b837f94c5a3b1103a5/docs/integration/ql246-source-proof.json`.  
**Decision:** `SIGNER_STATUS_UNKNOWN`. No authenticated source confirms a provisioned signer or verified custody. This is **not** an assertion that no signer exists.

## Concrete private provisioning task (NOT completed)

1. Assign a named accountable signer custodian, separate independent witness and separately authenticated reviewing assessor. The real people and custody details belong ONLY in the private trust registry, not this repository. Record independently authenticated role assignment receipt IDs (opaque only).
2. Confirm approval of the source signer trust amendment, **before** generating or enabling any signing credential. Assign key use to iCamp only, nonproduction only, immutable source A; never reuse AI Hub or other-app keys.
3. Custodian generates an Ed25519 key in their approved encrypted hardware-backed or OS-protected secret store, with export prohibited where supported. Do NOT use GitHub Actions, Vercel build logs, sample fixtures or this document as key storage. Record the authentic **public** SPKI SHA-256 and private key reference inside the private registry; only a public digest is reportable.
4. An independently authenticated assessor retrieves the public key through a separately trusted channel and verifies the SPKI SHA-256 against the registry. A different witness issues and signs a fresh <=5-minute nonce challenge linked to the source A, later proof B, tenant and original registry snapshot digest. Record independent opaque receipt IDs. A self-reported digest or shared repository owner does not establish custody.
5. Independently verify a real isolated nonproduction campground/company tenant ID and its isolation test against another tenant. `Camp Rosevear` is merely a demo name and **not** a verified tenant ID; do not reuse a live guest tenant.
6. Once approved, custodian signs a genuine canonical `rosevear.integration.v1` QL-248 nonproduction source-proof statement *referencing source A*, with accurate truthful negative-test metadata. No invented seven-denial receipts, owner identity, prior GET, or audit receipt. Save its signed envelope at exactly `docs/integration/ql246-source-proof.json` in a new descendant proof commit B (A != B); promote through protected dev/main. The QL-256 document itself is **not** proof B.
7. Independently fetch immutable B raw bytes (HTTP 200), calculate the exact raw SHA-256, verify Ed25519, exact A CI head_sha, A→B ancestry, expiry and tenant; compare signer SPKI to trusted independently witnessed registry before any TEST request.
8. Only then privately request separately authenticated owner authorization for **one future <=30-minute UTC nonproduction window**, GET only `/api/integration/v1/health` and `/api/integration/v1/capabilities`. No request or private relay daemon is authorized by this build. Campground gates, wristbands, bookings, deposits and availability must remain untouched.

## Proven current configuration and binding inventory

GitHub `.env.example` contains only safe template defaults: `NEXT_PUBLIC_APP_NAME=iCamp`, `ICAMP_APP_NAME=iCamp`, `ICAMP_APP_VERSION=0.1.0`, `ICAMP_MEDIA_STORAGE_PROVIDER=supabase`, `ICAMP_MEDIA_SIGNED_URL_SECONDS=300`, `ICAMP_COMMUNICATIONS_PROVIDER=mock`, `ICAMP_VOICE_PROVIDER=mock`, `ICAMP_MESSAGING_PROVIDER=mock`, `ICAMP_FEATURE_EXTERNAL_WATCHDOG=false`. Values in the template are **not evidence of production configuration**.

The non-decrypted Vercel project-variable listing for `prj_h0MDMYdA0Cc3jwTz48aQ6fghaMyQ` returned `envs: []`, `hiddenProductionEnvCount: 0` at inspection. Do not infer secret values from successful builds or local/Supabase configurations.

Required only where the relevant runtime feature is enabled: `DATABASE_URL` (server secret), `ICAMP_SUPABASE_URL` (project-specific public URL), `ICAMP_SUPABASE_SECRET_KEY` (server secret), `ICAMP_VOICE_WEBHOOK_SECRET` and `ICAMP_MESSAGING_WEBHOOK_SECRET` (server secrets if receiving provider webhooks). **Actual values NOT_AVAILABLE through this audit.** No integration signing private key, private witness credential, private registry URI, or gateway authorization token should ever be published, requested in chat or added to `NEXT_PUBLIC_*`.

Potential future integration bindings (NOT confirmed in application runtime): trusted public signer SPKI digest, immutable source A, later proof B, exact CI URL, approved isolated tenant ID, original out-of-band registry snapshot digest, opaque custody/witness receipt IDs, and short-lived owner TEST receipt. Treat all as private registry facts or public proof metadata, not default invented environment variables. Do not activate real networking using only a boolean flag.

## Sanitized QL-256 return

```text
App: iCamp
Current main SHA at evidence collection: 32b7c466ad34f7018863c8b837f94c5a3b1103a5
Signer provisioning decision: SIGNER_STATUS_UNKNOWN
Source A: 32b7c466ad34f7018863c8b837f94c5a3b1103a5
Matching GREEN CI: https://github.com/RosevearCreations/iCamp/actions/runs/40887376895
Verified nonproduction campground tenant ID: NOT_AVAILABLE
Custodian / independent witness / reviewer: NOT_ASSIGNED / PRIVATE_REVIEW_REQUESTED
Proof B + raw SHA-256 + independently verified SPKI: NOT_AVAILABLE
Owner TEST-only authorization: NOT_GIVEN
Genuine gateway GET/denial receipts: NOT_RUN
Connection: DISCONNECTED / HOLD
Next concrete blocker: Have a separately authenticated owner-approved private trust administrator assign three distinct accountable custody/review roles and confirm isolated nonproduction tenant ID, then approve iCamp-only Ed25519 key creation and independently verify the public SPKI fingerprint.
```

No real signer, private registry witness, tenant isolation, gateway request or owner authorization has been executed by this source-only evidence capture. Code deployment GREEN does not change that.
