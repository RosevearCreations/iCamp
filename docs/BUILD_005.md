# Build 005 — Roles, Permissions & Row-Level Security

## Status

**FULLY PROMOTED — `main` production GREEN.**

## Objective

Replace Build 004's coarse guest/staff identity boundary with campground-scoped roles, granular permissions and database-enforced row isolation.

Build 005 must ensure that:
- being staff does not imply access to all campgrounds;
- a workspace title is not an authorization mechanism;
- custom roles cannot cross organization boundaries;
- missing/malformed authorization context fails closed;
- public database tables remain protected even if an application guard is missed.

## Delivered

### Permission catalogue
A canonical private permission catalogue now covers current/future iCamp domains, including campground administration, bookings, guests, vehicles, visitors, access/security, maintenance, inspections, winterization, permanent units, financing, events, waterfront, rentals, POS, inventory, staff, vendors, finance, reports, communications and I.T.

### Role templates
Seeded templates:
- Front Desk;
- Maintenance;
- Maintenance Lead;
- Security;
- Store / POS;
- Finance;
- I.T. Administrator;
- Campground Manager;
- Owner / Administrator.

### Custom roles
Organization-scoped custom roles can be created from known permissions.

Cross-organization custom-role assignment is rejected by the database.

### Campground assignments
Staff authorization is scoped through explicit organization/campground assignments.

Only staff identities may receive staff assignments.

### Permission-specific workspace gates
Operational workspaces now require an explicit minimum permission instead of Build 004's coarse `requireStaff` gate.

### Server authorization services
Build 005 adds authorization lookup, permission-check, custom-role, staff-assignment and RLS-visible-campground services.

### Database application role
`icamp_app` is a NOLOGIN/NOINHERIT role used for controlled RLS-enforced access.

The canonical migration/server principal may deliberately assume the role.

Supabase `anon` and `authenticated` are not members.

### RLS request context
Transaction-scoped `icamp.user_id` identifies the server-authorized user to RLS.

Missing or malformed context returns null and therefore fails closed.

### Forced RLS
Core property-scoped public tables now FORCE RLS.

Broad public table grants are revoked.

## Migrations

### 0004 — roles, permissions and RLS
Adds:
- permission catalogue;
- roles;
- role permissions;
- campground assignments;
- assignment roles;
- role/assignment validation triggers;
- permission functions;
- RLS application role;
- table grants;
- forced RLS;
- policies.

### 0005 — trusted app-role membership
The real Supabase development deployment showed that the migration/server principal could not `SET ROLE icamp_app`.

The already-applied 0004 migration was not rewritten.

0005 grants `icamp_app` membership to the trusted migration principal while leaving `anon` and `authenticated` outside the role.

### 0006 — authorization indexes
Supabase performance advisor identified two authorization foreign keys without covering indexes.

0006 adds those indexes.

## Verification

### Vanilla PostgreSQL CI
Build 005 verifies:
- all migrations;
- expected authz tables;
- permission catalogue population;
- role-template population;
- staff-only assignment rule;
- custom-role organization scope;
- app-role assumption;
- forced RLS;
- front-desk scoped read;
- front-desk denied campground update;
- owner/admin permitted update inside assigned property;
- cross-property update denial;
- unassigned-user empty visibility;
- full server authorization lifecycle;
- migration idempotency.

### Application CI
Verified:
- formatter;
- ESLint zero warnings;
- strict TypeScript;
- repository/security invariants;
- Next.js production build;
- high/critical production dependency audit.

### Security
Verified:
- Gitleaks;
- CodeQL JavaScript/TypeScript analysis.

## Real Supabase verification

Project:
- RosevearCreations / iCamp;
- ref `cxgszmpbeswdikzofvjv`;
- Canada Central.

Migrations 0004, 0005 and 0006 were applied from the canonical GitHub SQL.

Rollback-only remote authorization tests passed and left zero synthetic records.

Supabase security advisor after Build 005: **no security lints**.

The advisor's unindexed-foreign-key findings were resolved by 0006.

Remaining unused-index INFO findings are expected on a new database without representative production workload.

## Contextual help

The authorization model is documented as a permanent source of truth.

Applicable management/role UI created in later builds must expose the universal ⓘ help system and may not expose privileged role instructions to unauthorized users.

## Admin freshness / I.T.

Role/permission data and future authorization administration will participate in the same admin freshness/refresh framework.

I.T. diagnostic access is now gated by `it.health.read` rather than merely checking whether a user is staff.

## Channel support

### Web/PWA
Authorization enforcement is active in server workspace gates and PostgreSQL RLS.

### IVR/DTMF
The permission engine is canonical and ready for the phone gateway. Telephone identity/verification arrives in Builds 010–015.

### SMS/MMS
The same permission engine applies. SMS sender identity never grants permission by itself.

### Staff-assisted / secure-link fallback
Staff-assisted actions remain subject to the acting staff user's campground assignment and permissions.

## Manual action

**None.**

No role, user or campground data must be entered manually for Build 005.

## Next build

**Build 006 — Audit Trail & Privileged Action Controls.**


## Production / release evidence

Build 005 implementation was promoted through PR #18.

Verified on the production/release branch:
- formatter GREEN;
- ESLint GREEN;
- strict TypeScript GREEN;
- repository/security invariant tests GREEN;
- Next.js production build GREEN;
- production dependency high/critical audit GREEN;
- PostgreSQL migration verification GREEN;
- authentication lifecycle GREEN;
- authorization lifecycle GREEN;
- migration idempotency GREEN;
- CodeQL JavaScript/TypeScript analysis GREEN;
- Gitleaks verified on the final Build 005 source state.

The RosevearCreations iCamp Supabase development database contains canonical migrations through 0006. Remote rollback-only authorization verification retained zero synthetic organizations, campgrounds, users or custom roles. The Supabase security advisor reports no security lints.

A GitHub Actions hosted-runner incident caused delayed/cancelled security jobs during promotion; those delays were infrastructure scheduling, not iCamp test failures. Final closeout validation was run on the completed source state before the build was considered closed.
