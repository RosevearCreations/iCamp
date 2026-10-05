# iCamp Authentication & Secure Sessions Source of Truth

## Purpose

Authentication answers **who is this user/session?**

Authorization answers **what may this identity do, and for which campground/property?**

Build 004 establishes authentication. Build 005 establishes roles, permissions and tenant-aware RLS authorization.

## Current development hosting target

The current remote development database is:

- Supabase organization: `rosevearcreations`
- project: `iCamp`
- project ref: `cxgszmpbeswdikzofvjv`
- region: Canada Central (`ca-central-1`)
- database engine: PostgreSQL 17

This project is a hosting target, not the source of truth for schema design.

Canonical migrations remain in GitHub under `database/migrations`.

The same schema is continuously verified against vanilla PostgreSQL 17 in CI so iCamp can migrate to another managed or self-hosted PostgreSQL environment.

## Identity model

A global authentication account has:
- UUID identity;
- normalized email;
- account type: guest or staff;
- active/disabled state;
- optional email verification timestamp;
- failed sign-in tracking;
- temporary lockout timestamp;
- MFA-required readiness flag;
- normal lifecycle timestamps/row version.

Roles, job titles and campground/property assignments do not live in the authentication identity. They arrive in Build 005.

## Password storage

Passwords are never stored in plaintext.

The server uses Node's built-in `scrypt` with:
- independent random salt per password;
- N=32768;
- r=8;
- p=1;
- 32-byte derived key.

Password verifiers live in `icamp_private.password_credentials`.

Minimum password length is 12 characters and maximum is 128. Long passphrases are allowed; iCamp does not impose arbitrary upper/lower/symbol composition rules.

## Enumeration resistance

Public flows must not disclose account existence.

### Sign-in
- generic invalid-credentials response;
- password-verification work is performed even for unknown/disabled/locked identities to reduce timing differences;
- repeated failures can temporarily lock an existing active account.

### Registration
- public registration creates guest accounts only;
- duplicate existing emails receive the same external confirmation path as successful registration;
- staff accounts are never self-created through the public guest registration page.

### Recovery
- recovery request response is identical whether the address exists or not;
- recovery tokens are single-use and time-limited.

## Sessions

Browser sessions use:
- a cryptographically random 256-bit opaque token;
- only SHA-256 token hashes stored in PostgreSQL;
- server-side expiration and revocation;
- an HTTP-only cookie;
- SameSite=Lax;
- Secure + `__Host-` cookie prefix in production;
- path=/ and no Domain attribute.

Current default session lifetime is 12 hours.

The database never needs the raw browser token after initial issuance.

## Logout and revocation

Signing out:
1. revokes the matching server-side session;
2. records a revocation reason;
3. expires the browser cookie.

Password reset revokes every active session belonging to the account.

Future high-risk operations can require recent re-authentication/AAL2 without changing the base session model.

## Password recovery

The database and application support:
- random recovery token generation;
- hash-only token persistence;
- 30-minute validity;
- single use;
- password replacement;
- existing-session revocation.

Recovery **delivery** is provider-neutral.

Build 004 deliberately uses a no-op delivery adapter that never logs or exposes the raw token. Build 009 connects the communications system (email/SMS/etc.) to that adapter.

Therefore the recovery engine is implemented/tested now, while public self-service delivery is not falsely presented as operational before a communications provider exists.

## MFA readiness

The account model reserves factor records for:
- TOTP;
- WebAuthn/passkeys;
- recovery codes.

Build 004 does not invent or store factor secrets prematurely.

Management/security/finance MFA enforcement and enrollment workflows are added when the relevant privileged authorization surfaces exist.

## CSRF / mutation protections

Browser authentication mutations require a matching request Origin.

Return/redirect paths are constrained to local iCamp paths to prevent open redirects.

Future API/mobile/telephone authentication methods may use different authenticated anti-replay mechanisms; they must not weaken the web-session contract.

## Coarse identity gates

Build 004 applies identity-level protection:
- public workspace: anonymous allowed;
- guest/My Stay workspace: signed-in account required;
- operational/staff workspaces: staff identity required;
- I.T./Analysis: staff identity required.

This is not fine-grained authorization.

Build 005 determines which staff identity may access which campground, module, record and action.

## Sensitive database boundary

Authentication tables live under `icamp_private`, not the public exposed schema.

The public browser/API never receives:
- password hashes;
- raw session tokens from storage;
- recovery-token hashes;
- factor secrets;
- lockout internals beyond necessary user-facing messages.

## Testing

CI must verify:
- password hashing and verification;
- unique salts;
- opaque token entropy/hash behavior;
- real PostgreSQL auth migration;
- guest account creation;
- failed sign-in;
- successful sign-in;
- session creation/lookup;
- recovery token issuance;
- recovery token single use;
- password replacement;
- old-session revocation;
- old-password rejection;
- new-password acceptance;
- staff identity path.

## Remote Supabase discipline

DDL changes to the remote iCamp Supabase project originate from GitHub migration SQL and are applied through the Supabase migration interface.

Do not make ad-hoc schema changes in the Supabase dashboard that are absent from the GitHub migration history.

The Supabase security advisor's current "RLS enabled no policy" notices for Build 003 public tables are expected until Build 005 creates explicit tenant-aware policies.

Unused-index notices are expected on a newly created development database with no production workload.
