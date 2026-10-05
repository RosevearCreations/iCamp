# Build 004 — Authentication & Secure Sessions

## Status
**FULLY PROMOTED — `main` verification GREEN.**

## Objective

Establish secure guest/staff identity, browser sessions, password recovery and MFA readiness without mixing authentication with Build 005 authorization.

## Development database target

The current hosted development PostgreSQL target is:
- Supabase organization: `rosevearcreations`
- project: `iCamp`
- ref: `cxgszmpbeswdikzofvjv`
- region: Canada Central

Build 003 and Build 004 canonical migrations have been applied successfully to that project.

A rollback-only live Supabase verification exposed a trigger mismatch in the initial auth-session schema: `auth_sessions` used the shared `touch_row` trigger but did not yet contain `updated_at`.

The already-applied migration was **not rewritten**. A new canonical migration, `0003_auth_session_updated_at.sql`, added the required timestamp. The remote rollback verification then passed and retained zero synthetic test accounts.

GitHub remains the source of truth for schema/migration design, and CI verifies the same migrations against vanilla PostgreSQL 17.

## Authentication storage

Sensitive records live under `icamp_private`:
- `user_accounts`;
- `password_credentials`;
- `auth_sessions`;
- `password_recovery_tokens`;
- `mfa_factors`.

Authentication tables are not exposed through the public schema.

## Password security

Passwords use Node's built-in scrypt with:
- random 16-byte salt;
- N=32768;
- r=8;
- p=1;
- 32-byte derived key.

Policy:
- minimum 12 characters;
- maximum 128 characters;
- long passphrases allowed;
- no arbitrary composition rule.

## Enumeration resistance

### Login
- generic invalid-credentials response;
- unknown email still performs scrypt verification against a dummy verifier;
- disabled/locked accounts do not receive distinct public errors.

### Registration
- public registration creates guest identities only;
- duplicate email follows the same external confirmation path as successful registration;
- invalid input is reported without disclosing account existence.

### Recovery
- response is identical whether or not the email exists;
- raw recovery tokens are not logged or returned through public status messages.

## Failed sign-in / lockout

Active accounts track failed password attempts.

Initial rule:
- 5 failed attempts;
- 15-minute lock.

The rule is enforced server-side and can be made configurable in later policy-management builds.

## Sessions

Browser sessions:
- use 32 random bytes / 256 bits;
- persist only SHA-256 token hashes;
- use server-side expiration;
- support explicit revocation/reason;
- default to 12 hours;
- update last-seen at a throttled cadence;
- require active account state.

Production cookie:
- `__Host-icamp_session`;
- HttpOnly;
- Secure;
- SameSite=Lax;
- Path=/;
- no Domain attribute.

Development cookie remains usable over local non-TLS development while retaining HttpOnly/SameSite behavior.

## Logout

Logout:
1. validates same origin;
2. revokes the matching server-side session;
3. clears the session cookie;
4. redirects to iCamp home.

## Password reset

Recovery tokens:
- are cryptographically random;
- are stored only as hashes;
- expire after 30 minutes;
- are single-use;
- supersede older outstanding recovery tokens when a new request is issued.

A successful password reset:
- replaces the password hash;
- consumes the recovery token;
- revokes every active session for the account.

## Recovery delivery boundary

Build 004 includes a provider-neutral recovery-delivery interface.

The current no-op adapter:
- does not log the raw token;
- does not expose it in the browser;
- reports no false claim that email/SMS delivery is operational.

Actual email/SMS delivery connects through the communications foundation beginning in Build 009.

## MFA readiness

The private data model supports future:
- TOTP;
- WebAuthn/passkeys;
- recovery codes.

Build 004 does not prematurely create factor secrets or claim MFA enrollment is operational.

## Web interfaces

Added:
- `/auth/login`;
- `/auth/register`;
- `/auth/recover`;
- `/auth/reset`;
- `/auth/account`;
- `/auth/not-authorized`.

Contextual ⓘ help topics cover sign-in, registration, recovery and sessions.

## Coarse identity protection

- Public workspace: anonymous.
- Guest/My Stay workspace: signed-in identity required.
- Operational workspaces: staff identity required.
- I.T./Analysis: staff identity required.

This is intentionally not the final authorization system. Build 005 adds roles, permissions, campground assignments and row-level policies.

## Mutation safeguards

Authentication POST handlers require matching request Origin.

Return paths are constrained to same-application paths to prevent open redirects.

## CI verification

The PostgreSQL CI job is extended to:
- apply all migrations;
- verify all database contracts;
- run a real guest/staff authentication lifecycle;
- prove failed login;
- prove successful login;
- create/resolve session;
- issue recovery token;
- reset password;
- reject token reuse;
- verify old session revoked;
- verify old password rejected;
- verify new password accepted.

Unit tests additionally cover:
- email normalization;
- password policy;
- unique scrypt salts;
- password verification;
- opaque-token uniqueness/entropy;
- token-hash behavior.

## Supabase advisor review

After applying the migrations to the real iCamp project:
- security advisor reports Build 003 public tables with RLS enabled/no policies — expected until Build 005;
- performance advisor reports new indexes unused — expected on a new database with no workload.

No advisor finding requires weakening security or deleting new indexes in Build 004.

## Manual action

### GitHub main-branch protection
The connected GitHub integration cannot modify repository administration settings.

The repository owner should enable protection on `main`.

Recommended settings:
- require pull request before merging;
- zero required approving reviews during current autonomous single-maintainer development;
- require application Verify check;
- require Database migrations check;
- require Gitleaks check;
- require conversation resolution where offered;
- prohibit force pushes;
- prohibit deletion;
- do not lock the branch.

No other manual action is required for Build 004 at this stage.


## Current GitHub Actions blocker

The current `dev` implementation cannot yet be called GREEN because GitHub Actions is not starting runners.

Observed on multiple commits and a failed-job rerun:
- CI Verify check fails before step 1;
- Database migrations check fails before step 1;
- Gitleaks check fails before step 1;
- GitHub timing API reports **0 ms billable runner time** for every failed job;
- CodeQL remains separately eligibility-skipped as expected.

This pattern is external to the Build 004 code and is consistent with an account/repository Actions usage, billing/spending-limit or runner-availability restriction. The connected GitHub integration cannot read the account billing annotation shown in the web UI.

After the repository visibility change to public, Build 004 completed a fresh full CI run successfully.


## Final dev verification

Verified on `dev` commit `4895c8d2a84f9386fbd053c0feb48ece334ae2e4` lineage with final corrected head `6615f10cce647aa0762436179a50b7dc6560487b` and ESM declaration fix head `4895c8d2a84f9386fbd053c0feb48ece334ae2e4`; the final fully verified Build 004 head is the current dev commit at promotion time.

Passed on the final public-repository verification:
- canonical formatting;
- ESLint with zero warnings;
- strict TypeScript;
- repository/application tests;
- Next.js production build;
- high/critical production dependency audit;
- PostgreSQL migration verification;
- full authentication lifecycle verification;
- Gitleaks secret scan;
- CodeQL JavaScript/TypeScript analysis.

The previous GitHub Actions billing blocker is resolved by the repository's public visibility and no longer affects Build 004 verification.


## Production/release verification

Build 004 production commit: `d2364119e5d3e19af74a17f91913ecba8689d567`.

Verified GREEN on `main`:
- canonical formatting;
- ESLint;
- strict TypeScript;
- tests;
- Next.js production build;
- production dependency audit;
- PostgreSQL migrations and authentication lifecycle;
- Gitleaks;
- CodeQL JavaScript/TypeScript analysis.

The repository is public, so standard GitHub-hosted Actions and CodeQL now run without consuming the prior private-repository Actions allowance.
