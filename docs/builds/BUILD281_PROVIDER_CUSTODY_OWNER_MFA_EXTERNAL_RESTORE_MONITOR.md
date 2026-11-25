# iCamp Build 281 — Original provider custody, MFA continuity and signed restore monitoring

## Intended evidence

Build 281 adds migration 0255, including append-only FORCE-RLS original provider-custody review, original Rosevear MFA continuity witness, genuine new Ed25519 external-provider final restore ACK, and timestamped independent review-monitor snapshots. Provider signature is reverified on readback against the separately approved original external provider public key. Every review requires an independently authorized original platform AAL2 operator. No password reset, grant, new signing key, customer transaction change, backup restore or production restore is performed.

This is authenticated **on-demand** monitoring when the protected page loads or a separate reviewer records a snapshot. It is not autonomous background polling. A software release GREEN is not an operational certificate.

## Step-by-step original owner procedure

### 1. Confirm genuine production project and schema

1. Go to Vercel → John's Projects → i-camp → Settings → Environment Variables → Production. Confirm DATABASE_URL and ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST exist. Do not reveal or overwrite the original private connection string. Both variable names were present at the start of Build 281; that does not establish their value or the identity of the actual original database.
2. In the independently authenticated **original iCamp** Supabase project, open Connect and confirm its project reference, project-specific database username and endpoint match the existing original Vercel production secret through a trusted private record. The screenshot in prior owner discussion displayed the shared pooler hostname aws-0-ca-central-1.pooler.supabase.com and port 6543. This host can be shared across projects, so **hostname alone is not proof**. Do not guess or use a replacement database to pass acceptance.
3. In that same original Supabase project → SQL Editor, run this **read-only** query: SELECT version FROM icamp_meta.schema_migrations WHERE version IN ('0252','0253','0254','0255') ORDER BY version;
4. If the original schema lacks 0255 or predecessors, stop field operations and arrange an approved original database migration window with a verified backup and the repository's existing trusted migration runner pointed at the genuine original target. Passing disposable CI migrations does NOT update original production.

### 2. Verify actual external provider custody independently

1. Finish original Builds 273–280 provider/backup evidence with their genuine existing original provider Ed25519 PUBLIC signing key, verified out-of-band public-key fingerprint, actual distinct original and isolated host identities, four-scope restore proofs, and original provider-signed Build 280 closure. Never fabricate a public/private key pair or treat a source-signed iCamp message as provider certification.
2. A DIFFERENT authorized original AAL2 reviewer from the previous provider-key proposer, key reviewer, original closure reviewer and restoration reviewer opens https://i-camp-pi.vercel.app/sysop/acceptance281.
3. Under Original provider signing-key custody audit, enter the actual verified Build 280 provider closure UUID and the genuine out-of-band custody evidence SHA-256. The app verifies the stored original Ed25519 provider signature, independent original key fingerprint, original provider identity, original/isolated host data, backup manifest and distinct reviewer. Leave HOLD if original evidence is missing.

### 3. Observe current original Rosevear MFA continuity

1. Sign into https://i-camp-pi.vercel.app/auth/login as the existing Rosevear account with its privately chosen password, complete its real authenticator MFA and independent platform binding. Do not paste login credentials, one-time codes or keys into chat. An old first-login credential at /auth/owner-setup must not be reused after expiry.
2. A previous independently approved original operator must have actually completed the original account/session recovery reviews in Builds 272, 278, 279 and 280, while the real owner AAL2 session remains active.
3. Another separate authorized AAL2 operator opens /sysop/acceptance281. Enter the actual Build 280 original recovery-witness UUID, the same currently active owner session UUID and the genuine separate observation evidence SHA-256 **within 15 minutes of original owner reauthentication**.
4. A revoked, expired or AAL1 session, absent independent binding or mismatched session must remain HOLD. This does not sign the owner in or reset a password.

### 4. Obtain a NEW real backup-provider-signed FINAL acceptance event

1. In the real original backup provider's secure service, independently verify that a genuine original backup was restored to a separate ISOLATED environment, not over live production. Verify original provider identity, source/isolated host fingerprints, original backup manifest, tenant isolation, reservation integrity, payment ledger and isolated service-health reports. Require the independent original Build 280 review certificate.
2. The provider's actual, separately enrolled Ed25519 key—not a developer's or user's substitute—must sign the exact UTF-8 JSON statement. This must be a NEW event with a different providerEventId and nonce from Build 280.
3. The signed JSON contains EXACTLY these case-sensitive fields: kind = icamp-external-restore-final-ack-v1; providerId; keyId; providerEventId; nonce; observedAt; originalClosureId; certificateId; originalClosureDigest; sourceHostSha256; isolatedHostSha256. originalClosureId is the verified Build 280 provider closure UUID. certificateId is its Build 280 isolated review certificate UUID. originalClosureDigest is SHA-256 of its original signed closure bytes. The two host SHA-256 values must match original independently verified host identity proofs and be DISTINCT. observedAt must be the genuine current provider ISO-8601 UTC timestamp, no more than five minutes old at submission.
4. The actual provider supplies only (a) the exact unaltered original signed JSON bytes and (b) an 86-character unpadded base64url Ed25519 signature. Do not share private keys, modify signed JSON formatting, invent a signature, or use test keys to claim original provider completion.
5. A DIFFERENT authorized platform AAL2 operator than the key, custody, owner and prior certificate reviewers opens /sysop/acceptance281. Enter the verified original Build 280 certificate UUID, Build 281 custody review UUID, fresh owner continuity UUID, exact signed JSON bytes and original external-provider signature.
6. The application rechecks original provider public key/DER fingerprint, real signature, distinct event/nonce, actual original signed closure, isolated evidence, current original owner MFA and all SEVEN fresh independently correlated original Build 275/277 source receipts. Any failure remains HOLD. A provider-signed final ACK is evidence only, not an instruction to restore production.

### 5. Record and monitor independent moment-in-time evidence

1. While the newly signed provider final ACK is within its five-minute freshness window, the real Rosevear owner AAL2 session is still valid within 15 minutes of reauthentication, and all seven original source receipts remain current, another DIFFERENT approved AAL2 reviewer opens /sysop/acceptance281 → Independent original monitoring receipt.
2. Enter the actual current provider final ACK UUID and genuine out-of-band monitoring evidence SHA-256. The server re-verifies the external signature and current original owner/source evidence before accepting an immutable timestamped monitor observation.
3. Click Refresh original evidence readback to see currently valid status. Old signed provider events, stale owner MFA sessions or expired original source receipts return HOLD; a past certificate or stored monitoring receipt does not override live validity.
4. The page does not poll any external provider unattended and cannot restore production. For recurring autonomous monitoring/alerts, a separately authorized scheduled provider integration is required.

## Protected release verification

Development and production release candidates require Verify (formatting, lint, typecheck, tests, build), disposable database migrations, browser end-to-end, Gitleaks and CodeQL. Mirror only the exact accepted Build 281 files from dev to clean main to avoid unrelated divergent histories. Require Vercel READY at the exact protected main SHA; confirm production i-camp-pi.vercel.app alias, health HTTP 200, original setup HTTP 200 and private /sysop/acceptance281 gated by login.

## Next proposed

iCamp Build 282 — Independent Original Provider Alert Delivery, Signed Restore Receipt Continuity and Owner Recovery Incident Escalation.
