import assert from "node:assert/strict";

import pg from "pg";

import {
  closeAuthPoolForTests,
  createSession,
  createStaffAccountForBootstrap,
  getSessionByToken,
  reauthenticateSession,
} from "../lib/auth/postgres.mjs";
import {
  assertPrivilegedActionControl,
  RECENT_REAUTHENTICATION_SECONDS,
} from "../lib/audit/privileged.mjs";
import {
  assignStaffToCampground,
  closeAuthorizationPoolForTests,
  createCustomRole,
} from "../lib/authz/postgres.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for audit verification.");
}

const setupPool = new Pool({ connectionString: databaseUrl, max: 2 });
const testPassword = ["audit", "fixture", "password", "one"].join("-");

async function createCampground() {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 006 Audit Org', 'build006-audit-org')
     returning id`,
  );

  const organizationId = organization.rows[0].id;

  const campground = await setupPool.query(
    `insert into public.campgrounds (
       organization_id,
       name,
       slug,
       timezone
     )
     values ($1, 'Build 006 Audit Camp', 'build006-audit-camp', 'America/Toronto')
     returning id`,
    [organizationId],
  );

  return {
    organizationId,
    campgroundId: campground.rows[0].id,
  };
}

async function assignOwnerTemplate(userId, organizationId, campgroundId) {
  const assignment = await setupPool.query(
    `insert into icamp_private.campground_assignments (
       user_id,
       organization_id,
       campground_id
     )
     values ($1, $2, $3)
     returning id`,
    [userId, organizationId, campgroundId],
  );

  const role = await setupPool.query(
    `select id
     from icamp_private.roles
     where role_kind = 'template'
       and role_code = 'owner_admin'
       and lifecycle_state = 'active'
     limit 1`,
  );

  assert.equal(role.rowCount, 1);

  await setupPool.query(
    `insert into icamp_private.campground_assignment_roles (
       assignment_id,
       role_id
     )
     values ($1, $2)`,
    [assignment.rows[0].id, role.rows[0].id],
  );
}

try {
  const owner = await createStaffAccountForBootstrap({
    email: "build006-owner@example.test",
    password: testPassword,
  });
  const targetStaff = await createStaffAccountForBootstrap({
    email: "build006-target@example.test",
    password: testPassword,
  });
  const camp = await createCampground();

  await assignOwnerTemplate(
    owner.id,
    camp.organizationId,
    camp.campgroundId,
  );

  const createdSession = await createSession({ userId: owner.id });
  const session = await getSessionByToken(createdSession.token);

  assert.ok(session);
  assert.ok(session.reauthenticatedAt);
  assert.equal(session.assuranceLevel, "aal1");

  const staleReauthentication = new Date(
    Date.now() - (RECENT_REAUTHENTICATION_SECONDS + 60) * 1000,
  );

  assert.throws(
    () =>
      assertPrivilegedActionControl({
        riskLevel: "high",
        reason: "Attempt with intentionally stale evidence.",
        reauthenticatedAt: staleReauthentication,
        assuranceLevel: "aal1",
      }),
    /Recent re-authentication is required/,
  );

  const refreshed = await reauthenticateSession({
    sessionId: session.sessionId,
    userId: owner.id,
    password: testPassword,
  });

  assert.ok(refreshed);
  assert.equal(refreshed.assuranceLevel, "aal1");

  const customRole = await createCustomRole({
    actorUserId: owner.id,
    actorSessionId: session.sessionId,
    authorizationCampgroundId: camp.campgroundId,
    organizationId: camp.organizationId,
    roleCode: "audit_verifier",
    displayName: "Audit Verifier",
    description: "Build 006 privileged-action verification role.",
    permissions: ["audit.read", "reports.read"],
    reason: "Create a controlled role for Build 006 verification.",
    reauthenticatedAt: refreshed.reauthenticatedAt,
    assuranceLevel: refreshed.assuranceLevel,
    requestId: "build006-role-create",
  });

  const assignment = await assignStaffToCampground({
    actorUserId: owner.id,
    actorSessionId: session.sessionId,
    targetUserId: targetStaff.id,
    campgroundId: camp.campgroundId,
    roleIds: [customRole.id],
    reason: "Assign the controlled role for Build 006 verification.",
    reauthenticatedAt: refreshed.reauthenticatedAt,
    assuranceLevel: refreshed.assuranceLevel,
    requestId: "build006-staff-assignment",
  });

  assert.ok(assignment.assignmentId);

  const audit = await setupPool.query(
    `select
       id,
       action_key,
       permission_key,
       risk_level,
       outcome,
       reason,
       actor_user_id,
       actor_session_id,
       organization_id,
       campground_id,
       before_state,
       after_state,
       reauthenticated_at,
       assurance_level
     from icamp_private.audit_events
     where actor_user_id = $1
     order by occurred_at, action_key`,
    [owner.id],
  );

  assert.equal(audit.rowCount, 2);

  const roleEvent = audit.rows.find(
    (row) => row.action_key === "authorization.role.create",
  );
  const assignmentEvent = audit.rows.find(
    (row) => row.action_key === "authorization.staff_assignment.upsert",
  );

  assert.ok(roleEvent);
  assert.ok(assignmentEvent);
  assert.equal(roleEvent.permission_key, "role.manage");
  assert.equal(roleEvent.risk_level, "high");
  assert.equal(roleEvent.outcome, "succeeded");
  assert.match(roleEvent.reason, /controlled role/);
  assert.equal(roleEvent.actor_session_id, session.sessionId);
  assert.equal(roleEvent.organization_id, camp.organizationId);
  assert.equal(roleEvent.campground_id, camp.campgroundId);
  assert.equal(roleEvent.after_state.roleCode, "audit_verifier");
  assert.ok(roleEvent.reauthenticated_at);
  assert.equal(roleEvent.assurance_level, "aal1");

  assert.equal(assignmentEvent.before_state, null);
  assert.equal(
    assignmentEvent.after_state.assignmentId,
    assignment.assignmentId,
  );
  assert.deepEqual(assignmentEvent.after_state.roleIds, [customRole.id]);

  await assert.rejects(
    () =>
      setupPool.query(
        `update icamp_private.audit_events
         set reason = 'This mutation must be rejected.'
         where id = $1`,
        [roleEvent.id],
      ),
    /Audit events are append-only/,
  );

  await assert.rejects(
    () =>
      setupPool.query(
        "delete from icamp_private.audit_events where id = $1",
        [assignmentEvent.id],
      ),
    /Audit events are append-only/,
  );

  process.stdout.write(
    "Audit and privileged-action lifecycle verification passed.\n",
  );
} finally {
  await Promise.allSettled([
    setupPool.end(),
    closeAuthorizationPoolForTests(),
    closeAuthPoolForTests(),
  ]);
}
