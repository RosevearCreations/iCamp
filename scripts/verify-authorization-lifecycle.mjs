import assert from "node:assert/strict";

import pg from "pg";

import {
  closeAuthPoolForTests,
  createStaffAccountForBootstrap,
} from "../lib/auth/postgres.mjs";
import {
  assignStaffToCampground,
  closeAuthorizationPoolForTests,
  createCustomRole,
  getCampgroundAuthorization,
  hasAnyCampgroundPermission,
  listRoleTemplates,
  listVisibleCampgroundsViaRls,
} from "../lib/authz/postgres.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for authorization verification.");
}

const setupPool = new Pool({ connectionString: databaseUrl, max: 2 });

const testPassword = ["authorization", "fixture", "password", "one"].join("-");

async function createCampground(
  organizationName,
  organizationSlug,
  campgroundName,
  campgroundSlug,
) {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ($1, $2)
     returning id`,
    [organizationName, organizationSlug],
  );

  const organizationId = organization.rows[0].id;

  const campground = await setupPool.query(
    `insert into public.campgrounds (
       organization_id,
       name,
       slug,
       timezone
     )
     values ($1, $2, $3, 'America/Toronto')
     returning id`,
    [organizationId, campgroundName, campgroundSlug],
  );

  return {
    organizationId,
    campgroundId: campground.rows[0].id,
  };
}

async function assignTemplateDirect(
  userId,
  organizationId,
  campgroundId,
  roleCode,
) {
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
       and role_code = $1
       and lifecycle_state = 'active'
     limit 1`,
    [roleCode],
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

  return assignment.rows[0].id;
}

try {
  const owner = await createStaffAccountForBootstrap({
    email: "build005-owner@example.test",
    password: testPassword,
  });

  const frontDesk = await createStaffAccountForBootstrap({
    email: "build005-front@example.test",
    password: testPassword,
  });

  const customStaff = await createStaffAccountForBootstrap({
    email: "build005-custom@example.test",
    password: testPassword,
  });

  const campA = await createCampground(
    "Build 005 Org A",
    "build005-org-a",
    "Build 005 Camp A",
    "build005-camp-a",
  );

  const campB = await createCampground(
    "Build 005 Org B",
    "build005-org-b",
    "Build 005 Camp B",
    "build005-camp-b",
  );

  await assignTemplateDirect(
    owner.id,
    campA.organizationId,
    campA.campgroundId,
    "owner_admin",
  );

  await assignTemplateDirect(
    frontDesk.id,
    campA.organizationId,
    campA.campgroundId,
    "front_desk",
  );

  const frontAuthorization = await getCampgroundAuthorization(
    frontDesk.id,
    campA.campgroundId,
  );

  assert.ok(frontAuthorization);
  assert.ok(frontAuthorization.permissions.includes("reservation.read"));
  assert.equal(
    frontAuthorization.permissions.includes("finance.manage"),
    false,
  );

  const ownerAuthorization = await getCampgroundAuthorization(
    owner.id,
    campA.campgroundId,
  );

  assert.ok(ownerAuthorization);
  assert.ok(ownerAuthorization.permissions.includes("role.manage"));
  assert.ok(ownerAuthorization.permissions.includes("system.admin"));

  const frontVisible = await listVisibleCampgroundsViaRls(frontDesk.id);
  assert.deepEqual(
    frontVisible.map((campground) => campground.id),
    [campA.campgroundId],
  );

  await assert.rejects(
    () =>
      createCustomRole({
        actorUserId: frontDesk.id,
        authorizationCampgroundId: campA.campgroundId,
        organizationId: campA.organizationId,
        roleCode: "front_illegal_role",
        displayName: "Front Illegal Role",
        permissions: ["reports.read"],
      }),
    /Not authorized to manage roles/,
  );

  const customRole = await createCustomRole({
    actorUserId: owner.id,
    authorizationCampgroundId: campA.campgroundId,
    organizationId: campA.organizationId,
    roleCode: "report_maintenance",
    displayName: "Report & Maintenance",
    description: "Build 005 custom-role verification.",
    permissions: ["reports.read", "maintenance.read"],
  });

  assert.deepEqual([...customRole.permissions].sort(), [
    "maintenance.read",
    "reports.read",
  ]);

  await assignStaffToCampground({
    actorUserId: owner.id,
    targetUserId: customStaff.id,
    campgroundId: campA.campgroundId,
    roleIds: [customRole.id],
  });

  const customAuthorization = await getCampgroundAuthorization(
    customStaff.id,
    campA.campgroundId,
  );

  assert.ok(customAuthorization);
  assert.ok(customAuthorization.permissions.includes("reports.read"));
  assert.ok(customAuthorization.permissions.includes("maintenance.read"));
  assert.equal(customAuthorization.permissions.includes("finance.read"), false);

  assert.equal(
    await hasAnyCampgroundPermission(customStaff.id, "reports.read"),
    true,
  );
  assert.equal(
    await hasAnyCampgroundPermission(customStaff.id, "finance.read"),
    false,
  );

  const customVisible = await listVisibleCampgroundsViaRls(customStaff.id);
  assert.deepEqual(
    customVisible.map((campground) => campground.id),
    [campA.campgroundId],
  );

  const ownerVisible = await listVisibleCampgroundsViaRls(owner.id);
  assert.deepEqual(
    ownerVisible.map((campground) => campground.id),
    [campA.campgroundId],
  );
  assert.equal(
    ownerVisible.some((campground) => campground.id === campB.campgroundId),
    false,
  );

  const templates = await listRoleTemplates();
  assert.ok(templates.length >= 9);
  assert.ok(templates.some((role) => role.roleCode === "owner_admin"));
  assert.ok(templates.some((role) => role.roleCode === "front_desk"));

  process.stdout.write("Authorization lifecycle verification passed.\n");
} finally {
  await Promise.allSettled([
    setupPool.end(),
    closeAuthorizationPoolForTests(),
    closeAuthPoolForTests(),
  ]);
}
