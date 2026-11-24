# iCamp Build 277 — Original Source Pin Adoption, Field Challenge & External Restore Acceptance

## What changes and what remains HOLD

Build 277 includes protected original source pin adoption tied to the actual Rosevear AAL2 session and an independent owner login witness; immutable database migration 0251; original Ed25519 challenge/response for seven applications with server-issued one-time 90-second challenges; independent external isolated restore evidence comparison; the protected operator console; a public step-by-step owner setup page; and a CLI to run only from real source repositories.

A GREEN GitHub/Vercel software release **does not** certify original login, exact production database, live physical signer identity or actual restored host. Never treat test fixture data, an unreviewed key, a guessed database connection, or a restored sample as genuine production evidence.

Before Build 277, Vercel metadata contained DATABASE_URL but not ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST, and the available Supabase connector did not expose an eligible account. We cannot select the original project or assert migration adoption without reliable independent evidence.

## Exact user instructions: what, where, how, when

### Phase A: The original database host pin — do once, after Build 277 is Vercel READY

1. Open the original iCamp Supabase Dashboard. Select the confirmed production project and use the Connect panel to inspect its original Postgres connection endpoint. Do not substitute another project or an example.
2. Open Vercel (John's Projects team) → i-camp → Settings → Environment Variables → Production. Find the existing sensitive DATABASE_URL. Compare the original project and the **actual hostname from that exact runtime connection URL** against the separately confirmed Supabase project. A direct database endpoint and a pooler endpoint are often not equal.
3. If these do not match or cannot be verified independently, STOP. Do not replace DATABASE_URL or set an expected host to silence errors.
4. If they match, choose Add New Variable under Production:
   - Name: ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST
   - Value: only the hostname part of the actual DATABASE_URL, lower case; do not include username, password, port or postgresql://.
   - Environment: Production only.
5. Save. Go to Vercel → i-camp → Deployments, select the successful latest Build 277 main deployment and choose Redeploy. Do it once after saving this pin so new environment metadata is loaded. Check https://i-camp-pi.vercel.app/api/health/ready after Vercel reports READY.
6. This host match is **necessary but not sufficient**: actual original data, migration history and owner/provider witnesses must independently agree.

### Phase B: Original SQL migrations — after Phase A only

1. In the same verified original Supabase project → SQL Editor, run only the read-only statement:

    select version from icamp_meta.schema_migrations
    where version in ('0241','0242','0243','0244','0245','0246','0247','0248','0249','0250','0251')
    order by version;

2. Confirm every expected migration is present. The CI migration suite is an isolated ephemeral database; its success does not show that live original production migrations have been applied.
3. If any migration is absent, arrange a reviewed original-database maintenance window and backup. Use the repository's existing migration runner (npm run db:migrate) **only** with the independently verified original DATABASE_URL under authorized original production deployment credentials. Do not run scripts against another Supabase project or copy production credentials into chat.
4. Open https://i-camp-pi.vercel.app/sysop/migration-audit to verify applied migration readback once authorized access works. If original access is not ready, keep original migration adoption HOLD.

### Phase C: Original Rosevear login — after Phase B, before owner adoption

1. Open https://i-camp-pi.vercel.app/auth/owner-diagnostics.
2. Sign in at https://i-camp-pi.vercel.app/auth/login using username Rosevear and the personal password established at the private one-time ceremony.
3. If no personal password has ever been set, open https://i-camp-pi.vercel.app/auth/owner-setup and use the **still-valid original credential privately issued to the owner**. An expired or consumed credential requires independently verified owner reissuance. Do not guess passwords or request an exposed reset.
4. Complete real authenticator MFA. The existing original user must have an independently approved platform binding and a separate Build 272 original session witness; Build 277 does not grant access by itself.
5. Only continue if the protected operator console recognizes a recently reauthenticated original Rosevear AAL2 session. Existing session code reduces AAL2 to AAL1 if reauthentication is over 15 minutes old, so perform owner approval immediately after MFA.

### Phase D: Original peer signers — do per peer, after Phase C and original approval

1. Verify the true original deployed Git SHA and the true original Ed25519 public-key fingerprint independently for each source:
    ai-data-platform
    rosevear-comms-hub
    rosevear-ai-hub
    yard-workers
    rosie-dazzlers
    devil-n-dove
    icamp
2. In https://i-camp-pi.vercel.app/sysop/acceptance276, an MFA-verified operator proposes the **public** SPKI Ed25519 key, original key identifier, original source commit, SHA-256 of public DER key and out-of-band source evidence SHA-256. A different verified operator then independently checks the key and revision and approves the proposal. Never paste a private key into the web UI.
3. In https://i-camp-pi.vercel.app/sysop/acceptance277, sign in as original Rosevear with freshly verified MFA. Enter the approved proposal UUID and independent original-owner source proof digest, then select Adopt original source pin with active MFA. The server refuses if the original owner/session, independent Build 272 witness or prior Build 276 approval is missing.
4. Only on the **actual peer source machine**, in the original peer repository directory, open PowerShell. Configure the values *from the enrolled original source*:
    
    $env:ICAMP_277_SOURCE_ID = "yard-workers"
    $env:ICAMP_277_KEY_ID = "actual_enrolled_key_id"
    $env:ICAMP_277_APPROVED_COMMIT_SHA = "actual_40_hex_original_source_commit"
    $env:ICAMP_277_PRIVATE_KEY_PATH = "C:\secure\actual-original-peer-signing-key.pem"

   Replace yard-workers with the peer's actual source ID. The path must point to that **original peer's already enrolled protected private Ed25519 key** on that host. Do not make up a key or copy a private key from a different peer simply to pass the test. Verify the source's Git HEAD with git rev-parse HEAD.

5. From the original source directory, run the reusable script from the reviewed iCamp clone (edit the iCamp clone path, not the source Git working directory):

    node C:\path\to\iCamp\scripts\build277-original-peer-field-drill.mjs

   The script verifies exact peer source revision; refuses missing/wrong key; signs an anti-replay request to https://i-camp-pi.vercel.app/api/internal/peer-challenge277; reads an unpredictable server challenge with 90-second expiry; signs and submits a new raw JSON response to https://i-camp-pi.vercel.app/api/internal/peer-response277. It never sends a private key to iCamp or prints its contents.
6. Within five minutes after a successful original field response, open the Build 277 protected operator console. Review source-specific signature status. Repeat each original peer. Seven simultaneously fresh sources and independent final witness review are required; one signed iCamp-only response is not sufficient.
7. If a peer has no enrolled original key or original source cannot be independently confirmed, leave that peer on HOLD. Do not run samples, regenerate arbitrary keys or falsely certify it.

### Phase E: Original external provider isolated restore — after actual source verification, not live production

1. Through the real original backup provider's own secure console, create/verify an original backup and restore **only to an isolated environment**. Never overwrite live production.
2. Independently compare all four original, isolated and production-readback fingerprints: tenant isolation, reservation integrity, payment ledger and service health, using actually captured provider evidence.
3. Original Build 272 backup/isolated review, Build 273 signed provider host attestation and Build 276 independent closure review must exist. Record actual private source and isolated host digests from the provider.
4. A platform reviewer distinct from the Build 272 dry-run reviewer and Build 276 closure reviewer opens /sysop/acceptance277. Enter the real Build 276 closure review UUID, externally verified source/isolated host digests and original private provider review digest. Only a matching original attestation and independent operator can store the receipt.
5. The receipt is a **review record**, not a command to restore production, and does not establish that an independent provider or affected tenant formally certified restoration. The final field certification remains a separate acceptance gate.

## Security and release acceptance

- All Build 277 private tables have forced row-level security, immutable evidence triggers and replay uniqueness. No public database reader is granted direct access.
- Two private POST endpoints are signature-gated and return generic rejection responses; their GET requests must be refused.
- The protected console requires the existing original AAL2 platform permission checks. Public instructions never disclose the original database host, password, private key, owner account status or source enrollment.
- CI: Verify, disposable migrations, browser E2E, CodeQL and secret scan. Promote exact Build 277 files from accepted dev PR to clean main PR because dev and main history is divergent.
- Production: Vercel READY for the exact merged protected main SHA, alias i-camp-pi.vercel.app and HTTPS route smoke checks.
- Mark **operational certification HOLD** unless verified original account, real host pin/migrations, seven actual source services and external original restore proofs are independently present.

## Next proposed

iCamp Build 278 — Original Seven-Source Field Attestation Review, Owner MFA Recovery Completion & External Restore Service Readback Closure.
