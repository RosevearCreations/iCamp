import pg from "pg";

const { Pool } = pg;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for authorization operations.");
  }

  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

function currentAssignmentClause(alias = "a") {
  return `
    ${alias}.assignment_state = 'active'
    and ${alias}.starts_at <= statement_timestamp()
    and (${alias}.ends_at is null or ${alias}.ends_at > statement_timestamp())
  `;
}

export async function closeAuthorizationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function getCampgroundAuthorization(userId, campgroundId) {
  const result = await getPool().query(
    `select
       a.id as assignment_id,
       a.organization_id,
       a.campground_id,
       coalesce(
         array_agg(distinct r.role_code)
           filter (where r.id is not null),
         '{}'::text[]
       ) as role_codes,
       coalesce(
         array_agg(distinct rp.permission_key)
           filter (where rp.permission_key is not null),
         '{}'::text[]
       ) as permissions
     from icamp_private.campground_assignments a
     left join icamp_private.campground_assignment_roles ar
       on ar.assignment_id = a.id
     left join icamp_private.roles r
       on r.id = ar.role_id
      and r.lifecycle_state = 'active'
     left join icamp_private.role_permissions rp
       on rp.role_id = r.id
     where a.user_id = $1
       and a.campground_id = $2
       and ${currentAssignmentClause("a")}
     group by a.id, a.organization_id, a.campground_id
     limit 1`,
    [userId, campgroundId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    assignmentId: row.assignment_id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    roleCodes: row.role_codes,
    permissions: row.permissions,
  };
}

export async function hasCampgroundPermission(
  userId,
  campgroundId,
  permission,
) {
  const result = await getPool().query(
    `select exists (
       select 1
       from icamp_private.campground_assignments a
       join icamp_private.campground_assignment_roles ar
         on ar.assignment_id = a.id
       join icamp_private.roles r
         on r.id = ar.role_id
        and r.lifecycle_state = 'active'
       join icamp_private.role_permissions rp
         on rp.role_id = r.id
       where a.user_id = $1
         and a.campground_id = $2
         and rp.permission_key = $3
         and ${currentAssignmentClause("a")}
     ) as allowed`,
    [userId, campgroundId, permission],
  );

  return result.rows[0]?.allowed === true;
}

export async function hasAnyCampgroundPermission(userId, permission) {
  const result = await getPool().query(
    `select exists (
       select 1
       from icamp_private.campground_assignments a
       join icamp_private.campground_assignment_roles ar
         on ar.assignment_id = a.id
       join icamp_private.roles r
         on r.id = ar.role_id
        and r.lifecycle_state = 'active'
       join icamp_private.role_permissions rp
         on rp.role_id = r.id
       where a.user_id = $1
         and rp.permission_key = $2
         and ${currentAssignmentClause("a")}
     ) as allowed`,
    [userId, permission],
  );

  return result.rows[0]?.allowed === true;
}

export async function listAssignedCampgrounds(userId) {
  const result = await getPool().query(
    `select
       a.organization_id,
       a.campground_id,
       c.name as campground_name,
       c.slug as campground_slug,
       array_agg(distinct r.role_code)
         filter (where r.id is not null) as role_codes
     from icamp_private.campground_assignments a
     join public.campgrounds c
       on c.id = a.campground_id
      and c.organization_id = a.organization_id
     left join icamp_private.campground_assignment_roles ar
       on ar.assignment_id = a.id
     left join icamp_private.roles r
       on r.id = ar.role_id
      and r.lifecycle_state = 'active'
     where a.user_id = $1
       and ${currentAssignmentClause("a")}
     group by
       a.organization_id,
       a.campground_id,
       c.name,
       c.slug
     order by c.name`,
    [userId],
  );

  return result.rows.map((row) => ({
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    roleCodes: row.role_codes ?? [],
  }));
}

export async function listRoleTemplates() {
  const result = await getPool().query(
    `select
       r.id,
       r.role_code,
       r.display_name,
       r.description,
       coalesce(
         array_agg(rp.permission_key order by rp.permission_key)
           filter (where rp.permission_key is not null),
         '{}'::text[]
       ) as permissions
     from icamp_private.roles r
     left join icamp_private.role_permissions rp
       on rp.role_id = r.id
     where r.role_kind = 'template'
       and r.lifecycle_state = 'active'
     group by r.id
     order by r.display_name`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    roleCode: row.role_code,
    displayName: row.display_name,
    description: row.description,
    permissions: row.permissions,
  }));
}

export async function createCustomRole({
  actorUserId,
  authorizationCampgroundId,
  organizationId,
  roleCode,
  displayName,
  description = "",
  permissions = [],
}) {
  const mayManageRoles = await hasCampgroundPermission(
    actorUserId,
    authorizationCampgroundId,
    "role.manage",
  );

  if (!mayManageRoles) {
    throw new Error("Not authorized to manage roles.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const scope = await client.query(
      `select 1
       from public.campgrounds
       where id = $1
         and organization_id = $2
       limit 1`,
      [authorizationCampgroundId, organizationId],
    );

    if (scope.rowCount !== 1) {
      throw new Error("Authorization campground is outside the organization.");
    }

    const inserted = await client.query(
      `insert into icamp_private.roles (
         organization_id,
         role_code,
         display_name,
         description,
         role_kind
       )
       values ($1, $2, $3, $4, 'custom')
       returning id, organization_id, role_code, display_name, description`,
      [organizationId, roleCode, displayName, description],
    );

    const role = inserted.rows[0];
    const uniquePermissions = [...new Set(permissions)];

    if (uniquePermissions.length > 0) {
      const permissionResult = await client.query(
        `select permission_key
         from icamp_private.permission_catalog
         where permission_key = any($1::text[])`,
        [uniquePermissions],
      );

      if (permissionResult.rowCount !== uniquePermissions.length) {
        throw new Error("Custom role contains an unknown permission.");
      }

      await client.query(
        `insert into icamp_private.role_permissions (
           role_id,
           permission_key
         )
         select $1, unnest($2::text[])`,
        [role.id, uniquePermissions],
      );
    }

    await client.query("commit");

    return {
      id: role.id,
      organizationId: role.organization_id,
      roleCode: role.role_code,
      displayName: role.display_name,
      description: role.description,
      permissions: uniquePermissions,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function assignStaffToCampground({
  actorUserId,
  targetUserId,
  campgroundId,
  roleIds,
}) {
  const [mayManageStaff, mayManageRoles] = await Promise.all([
    hasCampgroundPermission(actorUserId, campgroundId, "staff.manage"),
    hasCampgroundPermission(actorUserId, campgroundId, "role.manage"),
  ]);

  if (!mayManageStaff || !mayManageRoles) {
    throw new Error("Not authorized to assign campground staff roles.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const campgroundResult = await client.query(
      `select organization_id
       from public.campgrounds
       where id = $1
       limit 1`,
      [campgroundId],
    );

    const campground = campgroundResult.rows[0];

    if (!campground) {
      throw new Error("Campground does not exist.");
    }

    const uniqueRoleIds = [...new Set(roleIds)];

    if (uniqueRoleIds.length === 0) {
      throw new Error("At least one role is required.");
    }

    const roles = await client.query(
      `select id
       from icamp_private.roles
       where id = any($1::uuid[])
         and lifecycle_state = 'active'
         and (organization_id is null or organization_id = $2)`,
      [uniqueRoleIds, campground.organization_id],
    );

    if (roles.rowCount !== uniqueRoleIds.length) {
      throw new Error(
        "One or more roles are not assignable to this campground.",
      );
    }

    const assignmentResult = await client.query(
      `insert into icamp_private.campground_assignments (
         user_id,
         organization_id,
         campground_id,
         assignment_state
       )
       values ($1, $2, $3, 'active')
       on conflict (user_id, campground_id)
       do update set
         organization_id = excluded.organization_id,
         assignment_state = 'active',
         ends_at = null
       returning id`,
      [targetUserId, campground.organization_id, campgroundId],
    );

    const assignmentId = assignmentResult.rows[0].id;

    await client.query(
      `delete from icamp_private.campground_assignment_roles
       where assignment_id = $1`,
      [assignmentId],
    );

    await client.query(
      `insert into icamp_private.campground_assignment_roles (
         assignment_id,
         role_id
       )
       select $1, unnest($2::uuid[])`,
      [assignmentId, uniqueRoleIds],
    );

    await client.query("commit");

    return { assignmentId, roleIds: uniqueRoleIds };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function listVisibleCampgroundsViaRls(userId) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);

    const result = await client.query(
      `select id, organization_id, name, slug, timezone
       from public.campgrounds
       order by name`,
    );

    await client.query("commit");

    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
    }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
