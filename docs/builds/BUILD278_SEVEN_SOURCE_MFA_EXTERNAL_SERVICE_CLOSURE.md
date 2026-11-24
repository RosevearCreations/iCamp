# iCamp Build 278 — original seven-source field attestation, owner MFA and external restore service

This build adds independent immutable reviews of original Build 277 field challenges, genuine Rosevear account MFA readbacks, and external backup provider service output. The application never resets an owner's password, creates a signing key, grants privileged access or restores a production database.

## Deployment gates

- Both GitHub branches need passing Verify, disposable migrations, browser end-to-end, CodeQL and Gitleaks.
- Exact new protected main revision must be deployed Vercel production READY on i-camp-pi.vercel.app. The public page /auth/original-source-setup277 should load; /sysop/acceptance278 remains login-protected.
- Original field approval is separate. Never infer genuine production database adoption from CI tests or Vercel readiness.

## Screenshots — owner action

**Supabase screenshot:** The correct Connect to your project window is open. It shows a Shared pooler host aws-0-ca-central-1.pooler.supabase.com, port 6543. A shared pooler hostname alone is **not** sufficient to identify a specific original Supabase project. Check the project-specific username and project identity in the secure original Supabase Dashboard too.

**Vercel screenshot:** The correct Settings / Environment Variables area is open, but the existing sensitive DATABASE_URL editor is expanded. The placeholder postgres://user:pass@db.example.com:5432/app is only a displayed example, not a verified actual stored secret. **Close this editor without saving; never replace DATABASE_URL with the example.**

### Step 1 — when an actual original database source and current deployment are confirmed

1. In the securely authenticated original Supabase Dashboard select the correct iCamp original production project and its Connect panel. Note whether the original production connection uses direct, shared pooler or session pooler access. The hostname differs among endpoints.
2. In Vercel, i-camp → Settings → Environment Variables → Production, privately verify that the existing sensitive DATABASE_URL really points to that same original project and connection endpoint. Compare the project-specific pooler username as well as hostname; a shared hostname alone does not prove identity. Do not paste passwords or full connection strings into chat.
3. If this comparison cannot be completed, STOP; do not change database URLs or set the expected host merely to clear HOLD.
4. If verified, click Create New. Key: ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST. Value: ONLY the hostname from the actual existing DATABASE_URL. Proposed shared pooler host aws-0-ca-central-1.pooler.supabase.com is valid only if production already uses it.
5. Select Production. Use Config type (the hostname is not a secret), save the new variable. **Leave DATABASE_URL unchanged**.
6. In i-camp → Deployments, select the exact latest promoted production main build and click Redeploy once after saving. Confirm new deployment READY and aliased; test https://i-camp-pi.vercel.app/api/health/ready. This does not certify data or migrations.

### Step 2 — original production migration acceptance

1. In the verified same original Supabase project's SQL Editor run this *read-only* query:

    select version from icamp_meta.schema_migrations
    where version in ('0241','0242','0243','0244','0245','0246','0247','0248','0249','0250','0251','0252')
    order by version;

2. If schema versions are absent, do not copy SQL onto a random database. Obtain an original backup, confirm trusted original maintenance approval and use the repository's existing migration runner only with the **real original** database credentials in the trusted execution environment.
3. CI migrations use ephemeral fixtures; do not assume migration 0252 is applied to original production.

### Step 3 — original Rosevear MFA with distinct authorized reviewer

1. Visit https://i-camp-pi.vercel.app/auth/owner-diagnostics and sign in as Rosevear with the original owner personal password. If first setup was never done, follow /auth/owner-setup using the privately issued original one-time credential while still valid. Do not guess or share credentials.
2. Complete real authenticator MFA with an approved original owner binding and separate Build 272 witnessed login; never create a new grant or bypass MFA.
3. Open protected /sysop/acceptance278 with the actual Rosevear account. The page shows the owner's **own** account and current session UUID, not a password/token.
4. A different real independently approved AAL2 operator witnesses that original session and, within the original 15-minute MFA reauthentication window, enters the genuine owner account UUID, active session UUID and external observation SHA-256. This review cannot sign in the owner or prolong an expired session.

### Step 4 — independent review of all seven original signed field challenges

1. In /sysop/acceptance276 enroll the original application Ed25519 public key and exact original Git SHA, witnessed by a second person.
2. In /sysop/acceptance277 adopt the exact original peer key and source revision as Rosevear with real AAL2 session and independent original owner login witness.
3. On each actual original peer host run the vetted original-source field drill script from scripts/build277-original-peer-field-drill.mjs using its existing private key, original Git HEAD, and source ID. Never fabricate keys or use another application's signing identity. The server returns a 90-second one-time challenge.
4. Within five minutes, a different approved operator opens /sysop/acceptance278, checks the signed original source response and actual independent field source custody, and records the real response UUID and external evidence SHA-256. The private database double-checks signatures and freshness.
5. Repeat for AI Data Platform, Rosevear Comms Hub, Rosevear AI Hub, Yard Workers, Rosie Dazzlers, Devil n Dove and iCamp. If original signers or second reviewers are missing, mark HOLD, not GREEN.

### Step 5 — external isolated backup restore service readback

1. At the original real backup provider restore an original backup **only to a separate isolated environment**, never over live production.
2. Independently inspect tenant isolation, reservations, payment ledger and service health, and verify the original provider host and isolated host fingerprints through original Build 272–277 evidence.
3. A separate approved MFA reviewer (different from earlier Build 272/276/277 restore reviewers) opens /sysop/acceptance278. Supply the original Build 277 external review UUID and digests of the original provider service output, isolated service output and independent external comparison.
4. A database receipt is evidence of a review, not of executing a restore or obtaining an external provider's final recovery certification. Keep original operational closure HOLD without independently verified provider acceptance.

## Current limitation

Build 277 merged to both GitHub branches, but last production check still served Build 276 because the Vercel API reported HTTP 402 deployment quota. Do not call Build 278 production GREEN unless Vercel has a READY deployment on exact Build 278 main commit and the production domain aliases that deployment.

## Next proposed build

iCamp Build 279 — Seven-Source Independent Provider Receipt Correlation, Rosevear Recovery Access Audit & Isolated Restore Evidence Finalization.
