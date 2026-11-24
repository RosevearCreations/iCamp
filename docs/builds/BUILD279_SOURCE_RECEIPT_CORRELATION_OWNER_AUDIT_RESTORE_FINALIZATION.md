# iCamp Build 279 — Seven-Source Independent Provider Receipt Correlation, Rosevear Recovery Access Audit, and Isolated Restore Evidence Finalization

## Scope

The software correlates **two separate original signed records** (a Build 277 field response and a Build 275 signed source handshake), records an independent original Rosevear MFA recovery access audit, and maintains an append-only six-digest review of four-scope isolated restore evidence.

A source-signed receipt does NOT automatically certify any independent third-party provider; a recorded SHA-256 digest is an evidence reference and does not prove that a provider completed work. No feature here creates a signer, resets a password, grants administrative access, charges a customer, or performs a production database restore.

Original database migration: 0253. New private FORCE-RLS immutable tables: provider_receipt_correlation279, owner_recovery_access_audit279 and isolated_restore_evidence279.

## Correct owner steps — where, what, how and when

### 1. Original database identity and migrations

1. After verified Build 279 is live, open Vercel → John's Projects → i-camp → Settings → Environment Variables → Production.
2. Confirm both DATABASE_URL and ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST appear. At the beginning of Build 279 both keys existed, but the protected value and the original database's genuine identity were NOT independently verified. Do not create a duplicate host variable or overwrite DATABASE_URL.
3. In the securely logged-in original iCamp Supabase project, click Connect. The previous screenshot showed Shared pooler hostname aws-0-ca-central-1.pooler.supabase.com and port 6543. This hostname is shared, so independently confirm the project reference and pooler username too; Vercel's actual runtime DATABASE_URL must belong to that exact project and use the same connection endpoint (direct vs session/transaction pooler may differ). Do not send private connection strings or passwords to chat.
4. If the original project, existing URL and expected host cannot be independently matched, STOP. Do not set a convenient guessed value to obtain GREEN.
5. In that original verified Supabase project's SQL Editor, run this READ-ONLY check:

    select version from icamp_meta.schema_migrations
    where version in ('0241','0242','0243','0244','0245','0246','0247','0248','0249','0250','0251','0252','0253')
    order by version;

6. If versions are missing, use the reviewed original production maintenance and backup procedure with the project's controlled migration runner, only after checking the original database target. CI migration tests are disposable and do not adopt production schema.

### 2. Original Rosevear MFA recovery access audit

1. Open https://i-camp-pi.vercel.app/auth/owner-diagnostics, then /auth/login. Sign in as the existing original Rosevear account with its privately chosen password and complete actual authenticator MFA. A first-login ceremony at /auth/owner-setup is only valid while its privately issued one-time credential remains valid; do not guess or paste passwords into chat.
2. Confirm independent original owner binding, active staff identity and Build 272 independent original login witness. In /sysop/acceptance278 a separate approved platform operator must witness and record the actual original AAL2 owner session.
3. Open https://i-camp-pi.vercel.app/sysop/acceptance279 as an independently approved DIFFERENT AAL2 reviewer. The console shows genuine original Build 278 MFA readback UUID candidates only if the original schema/host checks pass.
4. Enter the actual MFA readback UUID and its independently observed original owner-access audit SHA-256. Do so while the owner session remains genuinely active and recently reauthenticated (less than 15 minutes). The owner and previous MFA reviewer cannot audit their own record. If the original session or independent reviewer is absent, leave status HOLD.
5. This audit does not log anyone in, create MFA, or extend an expired session.

### 3. Original seven-source receipt correlation

1. In the protected Build 276 console, enroll every genuine original source's exact Ed25519 SPKI public key and original deployed Git commit. Two different approved operators must propose and verify the key.
2. As original Rosevear with genuine MFA, adopt the approved source pins at /sysop/acceptance277. Run the existing Build 277 original-source challenge drill only on each real original source host with its existing secured private key. Never fabricate original sources or copy signer keys between peers.
3. Within five minutes a different authorized AAL2 reviewer independently attests the real signed field challenge in /sysop/acceptance278.
4. A separate Build 275 genuine signed-source handshake from the SAME original application, key ID and commit must exist, with its own different nonce and challenge ID. It must have arrived within the original five-minute time window.
5. At /sysop/acceptance279 an independently approved correlation reviewer different from prior owner/public-key/field reviewers enters the actual Build 278 field review UUID, the separate Build 275 source-handshake receipt UUID, and a genuine out-of-band source custody SHA-256 evidence reference. The server verifies both raw original Ed25519 signatures, source ID, revision, nonce uniqueness and freshness.
6. Repeat promptly for all seven: ai-data-platform, rosevear-comms-hub, rosevear-ai-hub, yard-workers, rosie-dazzlers, devil-n-dove and icamp. Review the source-specific display before the five-minute window expires. Any unavailable or synthetic source remains HOLD. Two original SOURCE signatures do not independently establish third-party provider certification.

### 4. Isolated original restore final evidence

1. In the actual original backup provider's secure console, restore a real original iCamp backup ONLY to an isolated environment, NEVER over production. Independently verify the source and restored host identities and the full signed Build 272–278 provider and restore evidence chain.
2. Independently inspect reports for tenant isolation, reservation integrity, payment-ledger integrity and restored service health, plus original backup manifest and independent external comparison proof.
3. A different original approved AAL2 reviewer from all prior restore reviewers opens /sysop/acceptance279. Enter the real Build 278 restore service readback UUID and the SHA-256 digest of the backup manifest, tenant report, reservation report, payment-ledger report, service-health report and independent comparison report. Never enter arbitrary sample hashes.
4. The immutable database review is an audit record, not a production restore, and is NOT a certificate that the backup provider or end user confirmed a recovery. Keep external provider certification on HOLD until separately confirmed.

## Software production promotion requirements

1. Dev and protected main PRs must pass Verify, disposable Database migrations, Browser end-to-end, CodeQL and Gitleaks.
2. Mirror only Build 279 changed files from accepted dev onto protected main; do not merge unrelated divergent histories.
3. Require Vercel production READY at the **exact main merge SHA**, and production alias https://i-camp-pi.vercel.app pointing to it.
4. Verify production health HTTP 200, protected /sysop/acceptance279 requiring authentication and public /auth/original-source-setup277 HTTP 200.
5. Call only SOFTWARE production GREEN. Original real source and provider field certification remain HOLD without genuine independent evidence.

## Next proposed

iCamp Build 280 — Original Provider-Signed Closure, Account Recovery Witness Completion & Isolated Restore Acceptance Certificate.
