# iCamp Build 280 — Original Provider-Signed Closure, Owner Recovery Witness and Independent Isolated Restore Certificate

## Guarantees and limitations

Build 280 requires a genuine independent **external provider Ed25519 signature** from its separately verified original key; a different real original Rosevear AAL2 recovery witness; seven source-correlated records; and a distinct, independently authorized isolated restore reviewer.

The application never issues an original provider private key or uses a sample key to claim field success. It never resets passwords, bypasses MFA, creates a platform grant, writes customer booking/payment data, or performs a production restore. A stored certificate is an **internal immutable reviewed-evidence certificate**, not an automatic independent provider service warranty, formal external approval or proof of restoring production.

Migration **0254** adds FORCE RLS append-only evidence tables: external_provider_key_proposal280, external_provider_key_review280, external_provider_signed_closure280, owner_recovery_witness280, and isolated_restore_certificate280. All original writes require an approved platform AAL2 operator and separate reviewers. JavaScript independently verifies the real Ed25519 signature before insert and on readback.

## Exact owner steps — WHAT, WHERE, HOW, WHEN

### Phase 1: Confirm original iCamp database target (before opening any review form)

1. In Vercel, select **John's Projects → i-camp → Settings → Environment Variables → Production**.
2. Verify that the existing **DATABASE_URL** and **ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST** entries are present. The last metadata read confirmed both entries existed. **Do not edit DATABASE_URL or reveal a password.** The expected hostname is masked; existence does not prove it matches the original database.
3. In the Supabase dashboard, open **the independently confirmed original iCamp production project → Connect**. The supplied prior screenshot showed a Shared pooler hostname **aws-0-ca-central-1.pooler.supabase.com** and port **6543**; this hostname is shared across multiple projects. Verify the exact original Supabase project ID, the original connection username containing its project reference, and the actual endpoint in the existing Vercel database secret through a trusted private record. A direct connection host can be different.
4. If the original project and endpoint cannot be matched, STOP and leave database identity HOLD. Do not create a replacement Supabase project, copy credentials to chat, overwrite existing production secrets, or use a different database merely to clear a HOLD.
5. In that verified original Supabase project → SQL Editor, run **read-only**:

    select version from icamp_meta.schema_migrations
    where version in ('0249','0250','0251','0252','0253','0254')
    order by version;

6. If version 0254 or any prerequisite is missing, perform only a reviewed original production backup and controlled migration using the project's existing trusted migration runner **against that independently confirmed original DATABASE_URL**. Passing isolated CI migrations does not apply or certify original production schema.

### Phase 2: Enroll the actual external backup provider's PUBLIC key — two distinct operators

1. From the **real backup/restore provider's authorized console or verified out-of-band security contact**, obtain its original Ed25519 public SPKI PEM, key ID, provider ID, exact DER public key SHA-256 fingerprint, and evidence of the independently verified original provider identity. Never create a new signing key on behalf of the provider.
2. The provider ID must match the one in the original iCamp Build 273 external restore provider attestation, not a made-up identifier. The provider key must be **separate** from an iCamp app source signing key; do not reuse a developer's key.
3. As independently authorized AAL2 platform operator, open **https://i-camp-pi.vercel.app/sysop/acceptance280**, under "Provider public key proposal." Enter genuine provider ID, key ID, **public key only**, DER SHA-256 fingerprint and independent external provider identity evidence SHA-256.
4. A **different** independent approved AAL2 operator checks the public key and original provider fingerprint with the provider through a separate trusted channel, then fills the key proposal UUID and external review SHA-256 in "Record second-person original provider key review." Never self-approve a proposed key.
5. Only the approved review UUID is eligible to verify the signed provider closure. If the provider does not offer an original verifiable Ed25519 signer, leave provider signature **HOLD**; do not manufacture evidence.

### Phase 3: Obtain provider-signed isolated restore closure from the REAL backup provider

1. In the real original provider's secure service, restore the actual backup to **an isolated system only**, never overwrite production. Verify original and isolated host identities are distinct, confirm the original backup manifest, tenant isolation, reservation integrity, payment ledger and service health, and complete genuine Builds 272–279 private proof reviews.
2. The external provider signs the **exact UTF-8 JSON bytes** of a closure object with its already approved private Ed25519 key. The signed message contains EXACTLY these case-sensitive keys:

    {
      "kind":"icamp-isolated-provider-closure-v1",
      "providerId":"actual-original-provider-id",
      "keyId":"actual-reviewed-provider-key-id",
      "providerEventId":"original-unique-provider-event-id",
      "nonce":"unique-original-provider-nonce",
      "sourceHostSha256":"64-lowercase-hex-original-host-digest",
      "isolatedHostSha256":"64-lowercase-hex-isolated-host-digest",
      "backupManifestSha256":"64-lowercase-hex-original-backup-manifest-digest",
      "scopeDigestSha256":"64-lowercase-hex-four-scope-and-manifest-digest",
      "observedAt":"2026-11-24T20:00:00.000Z"
    }

   The timestamp above is **only an illustrative formatting example**, not a real provider receipt. For actual operations the provider must supply its current original observed time (no older than five minutes when submitted), a unique provider event ID and a fresh nonce. The JSON property order can vary; the actual signed *bytes* must not be edited or prettified after signing.

3. The scope digest is SHA-256 of UTF-8 JSON.stringify of the exact ordered five-element array of existing original Build 279 evidence digests: **original backup manifest, tenant isolation, reservation integrity, payment ledger, service health**. It must match original already captured Build 279 evidence, not values picked from a sample. The provider's source and isolated host fingerprints and provider ID must also match original Build 273/277 evidence.
4. The provider returns exactly (a) the original signed JSON body (public evidence), (b) the Ed25519 signature encoded as unpadded base64url (86 characters), and (c) a verifiable provider event reference. It must **not** send or expose its private key. The provider can use its own secure signer; iCamp verifies but never signs on the provider's behalf.
5. As a **different**, independently verified AAL2 reviewer from previous provider/restore reviewers, open /sysop/acceptance280 "Original backup provider Ed25519-signed closure," enter the approved provider key review UUID, original Build 279 isolated evidence UUID, exact provider-signed UTF-8 JSON and original unmodified signature. The app checks Ed25519 signature, fingerprint, original evidence, provider ID, key ID, two distinct hosts, timestamp (five-minute window), and unique nonce/event. It refuses forged, reused, expired, unreviewed or synthetic data.
6. The form creates an append-only original provider signature receipt. This does **not** itself constitute an isolated restore acceptance certificate or a live restore.

### Phase 4: Independently witness the real Rosevear owner recovery

1. Sign in at **https://i-camp-pi.vercel.app/auth/login** with existing original username **Rosevear** and its privately established password; complete real authenticator MFA. If first setup never occurred, go to /auth/owner-setup only with the privately issued still-valid one-time credential; do not guess, paste secrets or bypass MFA.
2. Confirm the real original owner staff record and verified email, independent platform binding, genuine AAL2 session and distinct Build 272 and 278 original login reviews. At /sysop/acceptance279, a different real AAL2 auditor must complete original access audit while the owner session is active.
3. In /sysop/acceptance280, **another** approved AAL2 platform reviewer, distinct from the owner, prior owner login witness, prior MFA reviewer and access auditor, locates the actual Build 279 owner audit UUID and genuine out-of-band evidence SHA-256.
4. Within **15 minutes** of the original owner actually reauthenticating, the reviewer submits the original owner recovery witness. If the original session expires, is revoked, drops to AAL1 or another authorized operator is unavailable, keep owner recovery HOLD. A recorded witness never resets credentials, extends a session or logs anyone in.

### Phase 5: Independent isolated restore acceptance REVIEW certificate

1. In /sysop/acceptance279, correlate **all seven original sources** using true original Build 277 and Build 275 independently signed receipts from their real source hosts, within the actual five-minute freshness window. These seven are ai-data-platform, rosevear-comms-hub, rosevear-ai-hub, yard-workers, rosie-dazzlers, devil-n-dove and icamp. An absent signer or fake/expired original proof remains HOLD.
2. At /sysop/acceptance280 confirm it lists the original cryptographically verified external provider signed closure UUID and the current original Rosevear AAL2 completion witness UUID. Both must be current and from real original source evidence.
3. A **separate** authorized AAL2 final reviewer different from key proposer/reviewer, signed closure reviewer, restoration reviewer, owner witness and access auditor enters those genuine UUIDs and an independently observed final acceptance comparison SHA-256. The database requires seven recently correlated sources, the original signed provider chain, and still-active Rosevear MFA session before accepting a review certificate.
4. If the certificate is created, it records an immutable independent review of an **isolated** restore only. It is NOT an instruction to restore production. True formal provider final acceptance and actual owner closure remain separately tracked, not silently inferred from the internal certificate.

## Software release gates and verification

- Protected Verify (format check, lint, typecheck, unit tests, production build), disposable Database migrations, Browser end-to-end, CodeQL, Gitleaks must pass on dev and clean main release branches.
- Because dev and main have divergent histories, mirror only exact accepted Build 280 files to a clean protected main release branch; do not merge dev history wholesale.
- Vercel production must reach READY on the exact merged main SHA and the live alias i-camp-pi.vercel.app must point to it.
- Smoke test /api/health/ready HTTP 200, /sysop/acceptance280 redirects to the authenticated login, and public /auth/original-source-setup277 HTTP 200.
- A **software** production GREEN does not mean the original database migration is applied or that an external signer/owner/provider has actually completed recovery.

## Next proposed

**iCamp Build 281 — Original Provider-Custody Audit, MFA Witness Continuity and Externally Attested Restore Closure Monitoring.**
