# iCamp Build 252 — Source-pinned Production Migration Ledger & Owner Remediation

**Next after:** Build 251, already GREEN in code production at commit `78dcf7d63198f56132796b034c5417a84c64cc4a`.

## User value and implementation
- New `/sysop/migration-audit` page, restricted to existing MFA-qualified Sysop access with `requireSysop`; linked from the outer shell.
- Reuses Build 251's production runtime and source-custody readback, then reads the **canonical migration-history table** `icamp_meta.schema_migrations` through the **actual configured `DATABASE_URL`**, and **only if** `ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST` matches the actual runtime hostname. Never infer the target from a similarly named Supabase project.
- Runs a `BEGIN READ ONLY` transaction and bounded timeout, checks only expected versions `0231`, `0232`, `0233`, associated migration name and SHA-256 digest **shape**. No secret, database hostname, account, tenant, raw signature, checksum, credential or guest PII is included in the displayed result. A recorded checksum is **not** independently verified against the original SQL bytes: report `MIGRATION_HISTORY_OBSERVED_SOURCE_CHECKSUM_NOT_ATTESTED`, not migration approval.
- Structured actionable checklist maps the observed schema gaps, separately authenticated source signer and independent reviewer custody gaps, historical hash comparison, and standard Meadow/Orbit visual reviews to named operator roles. No mutation pathway, database migration, receiver activation or signed acceptance is added.
- Existing `/sysop/readiness` stays available. Code never equates CI PostgreSQL migration checks with a real production SQL adoption event.

## Permissions, security and recovery
- Only existing Sysop authority may view the page. No new data tables, grants, user roles, secrets or PostgreSQL migrations required.
- If DB target pin missing or mismatched, fail CLOSED without reading the migration ledger. If database is unavailable or migration schema/history absent, the page displays precise HOLD and manual recovery directions.
- The operator must independently verify Vercel's real database target, take a backup, compare the migration runner's recorded SHA-256 values to the exact protected SQL bytes, and apply reviewed missing migrations to the **verified correct database** separately; this build does not do those steps on an unverified target.
- The original Ed25519 signer and independent reviewer must be authenticated and explicitly enrolled outside the app. The three Master readbacks, signed SOURCE_HEALTHY, formal owner production approval, private connection and any receiver ON stay HOLD until real evidence exists.
- No active booking, payment, inventory, guest record, gate-control, SMS or voice side effects. Web/PWA Sysop read-only; IVR/DTMF/SMS have no access to protected operator audit; staff-assisted via a separately authenticated operator session only.

## Theme and release
- The canonical **Standard / Meadow** green palette, original photograph and `/themes/standard/meadow-hero.webp` are unchanged. `Orbit Command` remains independently selectable. Owner tenant preferences are not changed.
- Exact Build 252 changed file transfer `dev` → `main` only after protected lint/typecheck/unit, PostgreSQL lifecycle, Chromium, CodeQL and Gitleaks gates, exact-SHA Vercel preview READY, then production deployment and alias READY.
- A code release GREEN is not a database/source/owner operations acceptance claim.
