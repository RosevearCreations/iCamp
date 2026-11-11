# MASTER363-ICAMP-SOURCE-CONVERGE — iCamp public revision and signer boundary

**Controller:** `ai-data-platform` / Build 364

**Source:** `icamp` / RosevearCreations/iCamp

**Role:** `platform_shell` (product-level monitoring only)

**Discovery:** `/.well-known/rosevear-integration-manifest.json`

**Status endpoint:** `/api/integration/v1/shell/convergence` (read-only; no tenant identifier)

## Source-side work

1. Build 241 updates the committed discovery manifest from historic `dc1369338a4b191fc72031b7e62f7e48fd805bcd` to verified Build 240 production base `e2d343595363ca9106e7f1dbc60006e3a6c616aa`.
2. At each Vercel Git deployment, `scripts/build241-sync-public-source-manifest.mjs` replaces the *deployed* manifest `source_revision` with the exact `VERCEL_GIT_COMMIT_SHA`; production builds fail closed if the SHA is missing or invalid. This avoids a self-referential Git commit SHA. The committed JSON is a baseline, not proof of the future Build 241 release.
3. The public convergence endpoint reports deployment self-consistency, not independent signer verification. Recheck its `sourceRevision` and `manifestRevision` against **independently retrieved** `main` GitHub SHA, the Vercel deployment SHA, and successful exact-revision CI.
4. Existing QL-364 source health uses a strict read-only request contract. Its private original-authority, durable replay, and Ed25519 source-signer callbacks are **not installed** in this hosted iCamp deployment. It remains DENY/HOLD by design.
5. No private signer, independent authenticated public SPKI pin, signer-custodian assignment, externally witnessed receipt, nonproduction one-GET intent, or original host evidence was available to this repository-only build. None was fabricated, and no child campground records are exported.

## Required independent enrollment, outside GitHub/ChatGPT

An authorized signer custodian must independently approve the iCamp-only source role, provision an Ed25519 key under separately controlled private custody, verify the *public* SPKI SHA-256 through a second trusted channel, and connect a protected original-authority reviewer, durable replay store and source signer to the already defined QL-364 callback interface. The owner's explicit limited-scope TEST authorization is still required. Only after an actual canonical source-bound signed health receipt is independently verified by AI Data Platform Build 364 can it change the connection assessment. A public revision match alone is **not** a signed receipt.

## Sanitized handoff (fill exact release SHA after deployment)

```text
MASTER363-ICAMP-SOURCE-CONVERGE | controller=ai-data-platform | source=icamp | role=platform_shell | main=<exact_verified_40_hex_sha> | manifest=/.well-known/rosevear-integration-manifest.json | runtime-evidence=/api/integration/v1/shell/convergence | revision=VERIFY_AGAINST_DEPLOYMENT | source-signer=HOLD | independent-pin=HOLD | signed-health-receipt=HOLD | durable-replay=HOLD | tenant-boundary=PLATFORM_SHELL_ONLY | connection=HOLD | owner-acceptance=HOLD | credential-disclosure=NONE
```

The source-side doc should be shared with AI Data Platform Build 364. It is not a source-signed receipt or approval to enable Comms Hub traffic.
