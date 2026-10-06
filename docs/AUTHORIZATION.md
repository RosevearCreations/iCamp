# iCamp Authorization & Row-Level Security Source of Truth

## Purpose

Authentication answers **who is this identity?**

Authorization answers:
- which campground/property is this staff identity assigned to;
- which roles apply within that assignment;
- which permissions those roles grant;
- which data rows and operations are available.

Build 005 establishes the canonical authorization model for iCamp.

A global staff identity does **not** imply access to every campground.

## Core security model

iCamp uses multiple, reinforcing authorization layers:

1. **Authenticated identity** — Build 004 establishes the signed-in user.
2. **Campground assignment** — staff must have an active assignment to a specific campground.
3. **Role membership** — assignments receive one or more role templates/custom roles.
4. **Permission checks** — server services check explicit permission keys.
5. **PostgreSQL Row-Level Security** — scoped public data remains protected even if an application-layer guard is missed.

Authorization is deny-by-default.

## Permission catalogue

Canonical permissions live in `icamp_private.permission_catalog`.

Permission keys are stable capabilities such as:
- `reservation.read`;
- `maintenance.assign`;
- `gate.override.open`;
- `refund.issue`;
- `winterization.signoff`;
- `financing.manage`;
- `role.manage`;
- `it.diagnostics.export`;
- `system.admin`.

The catalogue deliberately separates capabilities instead of making a job title equivalent to unrestricted access.

Risk metadata classifies permissions as standard, elevated or high for later audit/re-authentication policy.

## Role templates

Build 005 seeds reusable templates:
- Front Desk;
- Maintenance;
- Maintenance Lead;
- Security;
- Store / POS;
- Finance;
- I.T. Administrator;
- Campground Manager;
- Owner / Administrator.

`owner_admin` currently receives the complete permission catalogue.

Other templates receive only capabilities appropriate to their operating purpose.

Templates are global definitions. Their use still requires an explicit campground assignment.

## Custom roles

A campground organization may define custom roles.

Custom roles:
- belong to exactly one organization;
- may contain only known permission keys;
- cannot be attached to an assignment from another organization;
- must be active before assignment.

The database enforces cross-organization rejection with a trigger, not only application code.

## Campground staff assignments

`icamp_private.campground_assignments` binds:
- one staff identity;
- one organization;
- one campground;
- assignment state;
- start/end validity.

Only identities whose authentication account type is `staff` may receive staff assignments.

Assignments are time-aware and can become inactive/expired without deleting history.

## Assignment roles

`icamp_private.campground_assignment_roles` connects an assignment to one or more roles.

The database trigger verifies:
- assignment exists;
- role exists;
- role is active;
- custom role organization matches assignment organization.

## Server authorization API

Server-side authorization helpers include:
- `getCampgroundAuthorization`;
- `hasCampgroundPermission`;
- `hasAnyCampgroundPermission`;
- `listAssignedCampgrounds`;
- `listRoleTemplates`;
- `createCustomRole`;
- `assignStaffToCampground`;
- `listVisibleCampgroundsViaRls`.

Route/page guards include:
- `requireAnyCampgroundPermission`;
- `requireCampgroundPermission`.

Business actions must call the narrowest relevant permission check.

A client-supplied role name or permission claim is never trusted as authorization.

## Workspace gates

The application workspace registry maps operating workspaces to minimum permissions.

Examples:
- Front Desk → `reservation.read`;
- Maintenance → `maintenance.read`;
- Security → `gate.state.read`;
- Store/POS → `inventory.read`;
- Staff → `staff.read`;
- Foreman → `maintenance.assign`;
- Management → `reports.read`;
- I.T./Analysis → `it.health.read`;
- Finance → `finance.read`.

These gates protect entry to a workspace. They do **not** replace action-level authorization inside the workspace.

## Trusted RLS application role

Build 005 creates PostgreSQL role:

`icamp_app`

Properties:
- NOLOGIN;
- NOINHERIT;
- limited schema/table/function grants;
- intended only for trusted server-side database operations.

The canonical migration/server principal is explicitly granted membership so it can deliberately run:

`SET LOCAL ROLE icamp_app`

for RLS-enforced queries.

Supabase public roles `anon` and `authenticated` are **not** members of `icamp_app`.

They also do not have USAGE on `icamp_private`.

## Request identity context

RLS obtains the current iCamp identity from transaction-local PostgreSQL setting:

`icamp.user_id`

The helper `icamp_private.request_user_id()`:
- returns null when context is missing;
- returns null when malformed;
- never treats malformed context as elevated access.

Trusted server code sets the value inside the database transaction before assuming `icamp_app`.

## Forced Row-Level Security

RLS is forced on the current property-scoped public tables:
- organizations;
- campgrounds;
- campground sections;
- campground subsections;
- admin refresh states.

FORCE ROW LEVEL SECURITY prevents the table owner path from casually bypassing policies during ordinary app-role operations.

## Current policies

Build 005 policies provide:
- assigned organization/campground read visibility;
- configuration updates only with `campground.configuration`;
- section/subsection visibility based on campground assignment;
- section/subsection updates only with campground configuration permission;
- admin refresh-state visibility for appropriate I.T./system permissions;
- refresh-state writes for system administration permission.

Later domain tables must introduce similarly scoped policies as they are created.

## Public grant posture

Build 005 revokes broad `public` privileges from the core exposed tables.

The NOLOGIN `icamp_app` role receives only the grants needed for the policy-controlled operations implemented so far.

Authorization tables remain in the private schema.

## Supabase development deployment

Current hosted development project:
- organization: RosevearCreations;
- project: iCamp;
- project ref: `cxgszmpbeswdikzofvjv`;
- region: Canada Central.

Canonical GitHub migrations applied through Build 005:
- 0001 core multi-property;
- 0002 authentication/sessions;
- 0003 auth-session timestamp;
- 0004 roles/permissions/RLS;
- 0005 trusted app-role membership;
- 0006 authorization FK/query indexes.

Supabase remains a PostgreSQL hosting target; GitHub migration files remain canonical.

## Remote security verification

Rollback-only tests against the actual hosted development project proved:
- front desk sees only its assigned campground;
- front desk cannot modify campground configuration;
- owner/admin can modify its assigned campground;
- owner/admin cannot modify another property;
- unassigned staff see no campgrounds;
- custom role cannot cross organization boundary.

The transaction was rolled back.

Retained synthetic verification records:
- organizations: 0;
- campgrounds: 0;
- users: 0;
- custom roles: 0.

Remote role verification proved:
- trusted `postgres` migration/server principal is a member of `icamp_app`;
- `anon` is not a member;
- `authenticated` is not a member;
- `anon` has no private-schema usage;
- `authenticated` has no private-schema usage.

Supabase security advisor result after Build 005: **no security lints**.

## Performance

The hosted database advisor identified two missing covering indexes for authorization foreign keys.

Migration 0006 adds:
- campground assignment scope index;
- permission-key/role index.

After the migration, the unindexed-foreign-key findings are gone.

Unused-index INFO notices on a new development database are expected and must not be treated as evidence that the indexes should be deleted before representative workload exists.

## Omnichannel rule

Authorization is channel-neutral.

Web/PWA, telephone/IVR/DTMF, SMS, staff-assisted calls and future provider integrations must invoke the same canonical permission/business-action layer.

A phone number, caller ID, SMS sender, keypad input or client-side UI state never bypasses server authorization.

Builds 009–015 add the communications/channel authentication adapters on top of this authorization core.

## Relationship to Build 006

Build 005 decides **whether an action is permitted**.

Build 006 now adds:
- append-only audit evidence;
- privileged-action reason capture;
- before/after evidence where appropriate;
- recent re-authentication and assurance-level hooks for high-risk actions;
- transactional audit evidence on custom-role creation and campground staff-role assignment.

See `docs/AUDIT_AND_PRIVILEGED_ACTIONS.md` for the canonical privileged-action contract.

Permission alone is not the final safeguard for high-risk operations such as refunds, financing, gate overrides or role administration.
