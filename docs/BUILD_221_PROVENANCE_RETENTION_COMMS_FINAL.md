# iCamp Build 221 — original-source provenance, external retention and final Comms attachment

This is the **final software-level iCamp attachment review** against the
[Comms QL-365D six-app handoff](https://github.com/RosevearCreations/rosevear-comms-hub/blob/main/docs/handoffs/QL365D_SIX_APP_COMMS_ATTACHMENT_VALIDATION_HANDOFF.md).
It does not create credentials, original issuer/witness status, signer trust,
external archive custody, a one-use private TEST, customer messages, campground
tenant actions or a persistent connection. Genuine missing field evidence stays
`DISCONNECTED / HOLD`; do not treat synthetic CI keys as original enrollment.

## Source-owned contract attachment

| Item | Exact iCamp value |
| --- | --- |
| Source ID / app ID | `icamp` / `icamp` |
| Repository | `RosevearCreations/iCamp` |
| Boundary | `platform_shell`, never Camp Rosevear or another campground tenant |
| Public discovery | `public/.well-known/rosevear-integration-manifest.json` |
| Private one-use handler | `lib/integration-v1/ql364-source-health.mjs` |
| Next.js handler mount | `app/api/integration/v1/shell/health/route.ts` |
| Only permitted private TEST route | `GET /api/integration/v1/shell/health` |
| Audience | `rosevear-master` |
| QL-363 signer and contract | External independently pinned Ed25519 **required; not installed by this build** |
| QL-362 request `repository` | `iCamp` (the Comms source map's short repo name) |
| QL-363 signed contract `repository` | `RosevearCreations/iCamp` |
| Public manifest revision | Immutable Build 220 protected `main` reference; fresh source contract must separately pin the **actual current production `main` commit** |
| Real connection state | `DISCONNECTED / HOLD` |

The public manifest remains **unsigned** until an actual source owner has
authenticated the signer out of band and signed it. Its immutable historical
revision is a discovery anchor, **not an assertion that Build 221 or a current
QL-363 source contract has been signed**. A private operator must read back
and pin the *actual current 40-character `main` SHA* when it executes the
separate QL-363 contract flow.

The QL-364 adapter checks exact source request and ownership proof, the pinned
HTTPS origin matching the actual request, a separate original authorization
callback, a durable one-use claim, and a source-owned receipt signer. The
deployed Next.js route has **none of these private callbacks configured** and
continues denying requests. This is correct until independent field enrollment.
The response cannot contain campground/tenant, camper, reservation or device data.

## Build 221 independent provenance and retention review

Build 221 extends Build 220's actual original ZIP SHA readback and four-key
cross-device audit. It accepts two **additional, separately signed external
statements**, authenticated cryptographically against out-of-band enrolled
Ed25519 public-key pins:

1. Original GitHub artifact source-review statement: binds artifact ID, Actions
   run/job, immutable source commit, digest, locally read ZIP record, ledger
   head and the review evidence hash.
2. External offsite-retention statement: same immutable source/bytes/ledger,
   different signer and claimed device, with its separate retained evidence
   digest and expiry.
3. Owner closure eligibility audit: reruns all Build 220 original signatures
   and the two new independently pinned statement signatures; requires **six
   different signing fingerprints** and four distinct claimed devices.

**Important limitation:** these signatures authenticate signed *claims*, not
GitHub as an original issuer, a person's physical computer, or offsite storage.
The output is an owner review candidate at most. It always reports
`retentionExceptionClosed:false`, `commsTestAuthorized:false` and
`connectionState:"DISCONNECTED / HOLD"`. Original-source API provenance and
offsite retention still require separate human/issuer verification.

### Offline Windows commands (no private data in GitHub)

Run in a trusted iCamp checkout on a **real authorized original device**.
Private `C:\private-icamp-evidence` is an example only: create it outside Git
with restricted access and fill it with the genuine already-verified Build 220
ledger, observations, original ZIP byte record and signed receipts. These files
must never be uploaded to ChatGPT or the repository.

The input `bundle.json` holds the exact actual Build 220 evidence objects under
their existing field names: `ledger`, `observation`, `byteRecord`,
`custodianReceipt`, `custodianPins`, `exceptionReceipt`, `ownerPins`, `schedule`,
`runnerReceipt`, `runnerPins`, `report`, `manifestReceipt`, `manifestPins`,
`ownerClosureReceipt`. It contains **no private keys**. A claimed device ID and
a SHA-256 evidence reference are not independently verified hardware or source.

```powershell
$p = 'C:\private-icamp-evidence'
$bundle = Join-Path $p 'bundle.json'

# Independently authenticated ORIGINAL SOURCE reviewer, on their own device:
node .\scripts\build221-provenance-retention-audit.mjs prepare $bundle SOURCE sha256:REPLACE_WITH_64_REAL_LOWERCASE_HEX SOURCE-ORIGINAL-DEVICE original-source-reviewer-key (Join-Path $p 'source-request.json')
node .\scripts\build221-provenance-retention-audit.mjs sign (Join-Path $p 'source-request.json') (Join-Path $p 'source-reviewer-private.pem') (Join-Path $p 'source-signed.json') --confirm-original-device-signature
node .\scripts\build221-provenance-retention-audit.mjs verify $bundle (Join-Path $p 'source-signed.json') (Join-Path $p 'source-reviewer-pins.json') SOURCE

# Separately authenticated OFFSITE RETENTION reviewer, different device/key:
node .\scripts\build221-provenance-retention-audit.mjs prepare $bundle RETENTION sha256:REPLACE_WITH_64_REAL_LOWERCASE_HEX RETENTION-ORIGINAL-DEVICE original-retention-reviewer-key (Join-Path $p 'retention-request.json')
node .\scripts\build221-provenance-retention-audit.mjs sign (Join-Path $p 'retention-request.json') (Join-Path $p 'retention-reviewer-private.pem') (Join-Path $p 'retention-signed.json') --confirm-original-device-signature
node .\scripts\build221-provenance-retention-audit.mjs verify $bundle (Join-Path $p 'retention-signed.json') (Join-Path $p 'retention-reviewer-pins.json') RETENTION

# Read-only audit of actual signed owner and external evidence (no closure):
node .\scripts\build221-provenance-retention-audit.mjs audit $bundle (Join-Path $p 'source-signed.json') (Join-Path $p 'source-reviewer-pins.json') (Join-Path $p 'retention-signed.json') (Join-Path $p 'retention-reviewer-pins.json') --confirm-readonly-review
```

Replace the two `sha256:` placeholders with SHA-256 of **real external evidence
bytes**; if missing, stop. Independently authenticate each public key and
identity before trusting its pin. The CLI cannot do that enrollment for you.
Do not reuse Ree/Jack's Comms master keys or keys from other applications.

## Exact owner-run Comms sequence for **iCamp only**

1. Ree on original `DESKTOP-AE894KC`, Windows `ree`, opens the current
   `rosevear-comms-hub` worktree. Jack independently opens his worktree on
   `TEMPLAR`, Windows `jfros`. Each checks clean Git and current `main` and runs:

   ```powershell
   git status -sb
   git fetch origin
   git pull --ff-only origin main
   node .\runtimes\hub-relay\ql365d-original-test-cli.mjs --status
   node .\runtimes\hub-relay\ql365d-original-test-cli.mjs --help
   ```

2. Both finish QL-365A/B original owner custody and QL-365C **independent
   reviewer identity and archive-byte readback**, using real public files and
   different original keys. They select only `icamp`. If any issuer, witness,
   reviewer or original device cannot be independently authenticated, stop.
3. Ree, with actual receiver OFF, runs `--prepare icamp` using the five real
   local file paths and a fresh output path. Each owner independently runs
   `--inspect` and `--sign` on the **same** 90-second request SHA on their own
   computer; never copy private keys. Ree reconciles with `--assemble` and
   `--inspect-signed`.
4. These owner signatures are an **offline review only**. A separately
   appointed original private operator still independently authenticates
   QL-355 issuer+witness, QL-354 protected database enrollment, source's own
   pinned signer/QL-363 signed contract, exact current protected commit,
   original receiver STOP/Tailnet isolation and QL-362 one-use claim.
5. Only if **all** those gates pass may the protected operator perform a
   single approved TLS-pinned private `GET` (4-second timeout, max 4096 bytes,
   no redirect or retry), verify its detached source Ed25519 receipt, archive
   the original response and the STOP witness, then keep persistent connection
   **HOLD** pending a different production grant.

Authoritative Comms field procedure:
[QL-365D original-device instructions](https://github.com/RosevearCreations/rosevear-comms-hub/blob/main/docs/build-records/QL-365D_ORIGINAL_REVIEWER_ENROLLMENT_CROSS_DEVICE_AND_FIRST_PRIVATE_TEST_REVIEW.md).
The QL-365D CLI has no `--test`, `--activate` or `--authorize` operation.

## CI and release boundaries

- `npm run build221:ci-contract` preserves all five mandatory GitHub checks.
- Synthetic cryptographic test fixtures prove denials and receipt shape only.
- `npm run verify` covers formatting, lint, types, full unit tests, Next.js build.
- No source keys, offsite ZIPs, real TEST receipts or customer data belong in CI.
- Real connection stays `DISCONNECTED / HOLD` until independently verified
  original-device source signatures, signed manifest/QL-363 contract, private
  TLS/one-use GET, and later separate persistent production grant.
