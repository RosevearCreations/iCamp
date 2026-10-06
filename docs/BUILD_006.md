# Build 006 — Audit Trail & Privileged Action Controls

## Status

**FULLY PROMOTED — `main` production GREEN.**

## Objective

Add a reusable, server-authoritative audit and privileged-action foundation before later financial, access-control, safety, map-publication and system-administration workflows are implemented.

## Delivered scope

### Append-only audit trail
- private-schema `audit_events` table;
- stable action/permission/risk/outcome fields;
- organization/campground and actor/session evidence;
- optional request correlation;
- before/after JSON objects where safe;
- database trigger rejects UPDATE and DELETE;
- indexes for scope, actor and action timeline queries.

### Privileged reason capture
- elevated/high-risk actions require an explicit reason;
- canonical 8-500 character normalization;
- database constraint reinforces the application rule.

### Recent re-authentication hook
- sessions gain `reauthenticated_at`;
- existing sessions are initialized from session creation time;
- high-risk controls default to a 10-minute freshness window;
- assurance-level checks are reusable for later AAL2/MFA enforcement.

### Transactional audit writer
- privileged mutations can append evidence using the same PostgreSQL transaction;
- mutation and successful audit evidence therefore commit or roll back together.

### First integrated privileged operations
Build 005 role-management mutations are upgraded to Build 006 controls:
- custom role creation;
- campground staff-role assignment.

These operations require their existing permissions plus:
- reason;
- recent re-authentication;
- assurance context;
- transactional before/after audit evidence.

## Security boundaries

Build 006 does **not**:
- expose audit tables to public browser roles;
- store authentication secrets in audit rows;
- add refund/gate/payment workflows ahead of their roadmap builds;
- implement MFA enrollment or SMS/voice identity verification early.

It provides the canonical controls those later builds must consume.

## Verification

Required Build 006 gates:
- repository invariant tests;
- formatter/lint/typecheck/build;
- dependency audit;
- PostgreSQL migrations and structural verification;
- Build 004 authentication lifecycle;
- Build 005 authorization lifecycle;
- Build 006 audit/privileged-action lifecycle;
- migration idempotency;
- repository security scans.

## Omnichannel contract

Web/PWA, IVR/DTMF and SMS may invoke privileged operations only through the same server controls. Visual/strong-authentication steps may use secure-link handoff, but no channel may bypass reason, authorization, re-authentication or audit requirements.

## Manual action

No manual application configuration is required for the repository/CI implementation.

Hosted development database application and security-advisor verification are complete.

## Production / release evidence

Build 006 was promoted through PR #20 to `dev` and PR #21 to `main`.

Verified on the exact production merge state:
- formatter GREEN;
- ESLint GREEN;
- strict TypeScript GREEN;
- repository/security invariant tests GREEN;
- Next.js production build GREEN;
- production dependency high/critical audit GREEN;
- PostgreSQL migration verification GREEN;
- authentication lifecycle GREEN;
- authorization lifecycle GREEN;
- audit/privileged-action lifecycle GREEN;
- migration idempotency GREEN;
- CodeQL JavaScript/TypeScript analysis GREEN;
- Gitleaks / Secret Scan GREEN.

Hosted iCamp Supabase verification:
- project status ACTIVE_HEALTHY on PostgreSQL 17.11;
- canonical migration `0007_audit_privileged_actions` applied;
- append-only UPDATE/DELETE rejection verified in a rollback-only transaction;
- retained synthetic audit verification rows: 0;
- `anon` and `authenticated` have no private-schema usage and no audit-table SELECT access;
- Supabase Security Advisor: zero security lints.

Performance advisor notices are INFO-only unused-index findings expected on the new low-traffic development database; they are not release blockers.

## Next build

**Build 007 — Background Jobs, Scheduler & Operational Queues.**
