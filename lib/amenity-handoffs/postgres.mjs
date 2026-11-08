import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { listStaffAmenityAssets } from "../amenity-status/postgres.mjs";
import {
  handoffActorCanAct,
  normalizeHandoffCreate,
  normalizeHandoffDecision,
} from "./core.mjs";

const { Pool } = pg;
let pool;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const readPermissions = [
  "asset.read",
  "asset.manage",
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("Original campground database unavailable.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeAmenityHandoffPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

function uuid(value, label) {
  const text = String(value ?? "").trim();
  if (!UUID.test(text)) throw new Error(`${label} is invalid.`);
  return text;
}

async function capabilities(actorUserId, campgroundId) {
  const entries = await Promise.all(
    [
      ...readPermissions,
      "campground.configuration",
      "campground.map.publish",
    ].map(async (key) => [
      key,
      await hasCampgroundPermission(actorUserId, campgroundId, key),
    ]),
  );
  const grants = new Map(entries);
  const has = (key) => grants.get(key) === true;
  return {
    canRead: readPermissions.some(has),
    canCreate: has("asset.manage") || has("maintenance.create"),
    canAssign: has("asset.manage") || has("maintenance.assign"),
    canComplete: has("asset.manage") || has("maintenance.complete"),
    canPublish:
      has("campground.configuration") && has("campground.map.publish"),
  };
}

async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const value = await callback(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function migrationReady() {
  const result = await getPool().query(
    "select to_regclass('public.amenity_shift_handoffs') is not null as ready",
  );
  return result.rows[0]?.ready === true;
}

async function eligibleStaff(campgroundId) {
  const result = await getPool().query(
    `select distinct a.user_id,u.email_normalized
     from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id=a.user_id
     where a.campground_id=$1 and a.assignment_state='active'
       and a.starts_at <= statement_timestamp()
       and (a.ends_at is null or a.ends_at > statement_timestamp())
       and u.account_type='staff' and u.account_state='active'
     order by u.email_normalized`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.user_id,
    label: row.email_normalized,
  }));
}

function mapHandoff(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetCode: row.asset_code,
    kind: row.kind,
    priority: row.priority,
    summary: row.summary,
    nextAction: row.next_action,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id,
    assignedToLabel: row.assignee_label ?? null,
    createdByLabel: row.creator_label ?? "Campground staff",
    acknowledgedAt: row.acknowledged_at,
    closedAt: row.closed_at,
    resolutionNote: row.resolution_note,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAmenityHandoffs({ actorUserId, campgroundId }) {
  const scope = uuid(campgroundId, "Campground");
  const permission = await capabilities(actorUserId, scope);
  if (!permission.canRead)
    throw new Error("Not authorized for campground handoffs.");
  if (!(await migrationReady())) {
    return {
      migrationReady: false,
      items: [],
      staff: [],
      permissions: permission,
    };
  }
  const [items, staff, assets] = await Promise.all([
    withRls(actorUserId, async (client) => {
      const result = await client.query(
        `select h.* from public.amenity_shift_handoffs h
         where h.campground_id=$1
         order by case h.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
           case h.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
           h.updated_at desc
         limit 200`,
        [scope],
      );
      return result.rows;
    }),
    permission.canAssign ? eligibleStaff(scope) : Promise.resolve([]),
    listStaffAmenityAssets(actorUserId, scope),
  ]);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const staffById = new Map(staff.map((person) => [person.id, person.label]));
  return {
    migrationReady: true,
    items: items.map((row) => {
      const asset = assetById.get(row.asset_id);
      return mapHandoff({
        ...row,
        asset_name: asset?.displayName ?? "Facility unavailable",
        asset_code: asset?.code ?? "—",
        assignee_label: staffById.get(row.assigned_to_user_id) ?? null,
        creator_label:
          staffById.get(row.created_by_user_id) ?? "Campground staff",
      });
    }),
    staff,
    permissions: permission,
  };
}

async function assertFacility(campgroundId, assetId) {
  const result = await getPool().query(
    `select id,organization_id from public.operational_assets
     where id=$1 and campground_id=$2 and asset_class='facility'
       and lifecycle_state <> 'archived' limit 1`,
    [assetId, campgroundId],
  );
  if (result.rowCount !== 1)
    throw new Error("Facility is unavailable in this campground.");
  return result.rows[0];
}

async function assertAssignedStaff(campgroundId, userId) {
  const people = await eligibleStaff(campgroundId);
  if (!people.some((person) => person.id === userId)) {
    throw new Error("Choose a currently assigned campground staff member.");
  }
}

export async function createAmenityHandoff({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  assetId: rawAssetId,
  assignedToUserId: rawAssignee = null,
  input,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground");
  const assetId = uuid(rawAssetId, "Facility");
  const grant = await capabilities(actorUserId, campgroundId);
  if (!grant.canCreate) throw new Error("Not authorized to create handoffs.");
  if (!(await migrationReady()))
    throw new Error("Build 230 database migration is required.");
  const normalized = normalizeHandoffCreate(input);
  const assignee = rawAssignee ? uuid(rawAssignee, "Assignee") : null;
  if (assignee && !grant.canAssign)
    throw new Error("Not authorized to assign handoffs.");
  if (assignee) await assertAssignedStaff(campgroundId, assignee);
  const facility = await assertFacility(campgroundId, assetId);

  return withRls(actorUserId, async (client) => {
    if (normalized.kind === "guest_review") {
      const duplicate = await client.query(
        `select 1 from public.amenity_shift_handoffs
         where campground_id=$1 and asset_id=$2 and kind='guest_review'
           and status <> 'closed' limit 1`,
        [campgroundId, assetId],
      );
      if (duplicate.rowCount) {
        throw new Error(
          "An unresolved guest review already exists for this facility.",
        );
      }
    }
    const result = await client.query(
      `insert into public.amenity_shift_handoffs
       (organization_id,campground_id,asset_id,kind,priority,summary,next_action,
        assigned_to_user_id,created_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        facility.organization_id,
        campgroundId,
        assetId,
        normalized.kind,
        normalized.priority,
        normalized.summary,
        normalized.nextAction,
        assignee,
        actorUserId,
      ],
    );
    const row = result.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: facility.organization_id,
      campgroundId,
      actionKey: "amenity.handoff.create",
      permissionKey: null,
      subjectType: "amenity.handoff",
      subjectId: row.id,
      afterState: {
        kind: row.kind,
        priority: row.priority,
        status: row.status,
        assignedToUserId: row.assigned_to_user_id,
      },
    });
    return row.id;
  });
}

export async function decideAmenityHandoff({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  handoffId: rawHandoffId,
  assignedToUserId: rawAssignee = null,
  input,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground");
  const handoffId = uuid(rawHandoffId, "Handoff");
  const decision = normalizeHandoffDecision(input);
  const grant = await capabilities(actorUserId, campgroundId);
  if (!grant.canRead)
    throw new Error("Not authorized for campground handoffs.");
  if (!(await migrationReady()))
    throw new Error("Build 230 database migration is required.");
  const assignee =
    decision.action === "assign" ? uuid(rawAssignee, "Assignee") : null;
  if (assignee) await assertAssignedStaff(campgroundId, assignee);

  return withRls(actorUserId, async (client) => {
    const current = await client.query(
      `select * from public.amenity_shift_handoffs
       where id=$1 and campground_id=$2 limit 1 for update`,
      [handoffId, campgroundId],
    );
    if (current.rowCount !== 1)
      throw new Error("Handoff unavailable for this campground.");
    const before = current.rows[0];
    if (Number(before.row_version) !== decision.expectedRowVersion) {
      throw new Error(
        "This handoff changed. Refresh before making a decision.",
      );
    }
    if (
      !handoffActorCanAct({
        action: decision.action,
        kind: before.kind,
        status: before.status,
        actorId: actorUserId,
        assignedToUserId: before.assigned_to_user_id,
        ...grant,
      })
    )
      throw new Error("Not authorized for this handoff transition.");

    const changed = await client.query(
      `update public.amenity_shift_handoffs
       set assigned_to_user_id=case when $4='assign' then $5 else assigned_to_user_id end,
           status=case when $4='assign' and $5 is distinct from assigned_to_user_id then 'open'
             when $4='acknowledge' then 'acknowledged'
             when $4='close' then 'closed' else status end,
           acknowledged_by_user_id=case when $4='assign' and $5 is distinct from assigned_to_user_id then null
             when $4='acknowledge' then $6 else acknowledged_by_user_id end,
           acknowledged_at=case when $4='assign' and $5 is distinct from assigned_to_user_id then null
             when $4='acknowledge' then statement_timestamp() else acknowledged_at end,
           closed_by_user_id=case when $4='close' then $6 else closed_by_user_id end,
           closed_at=case when $4='close' then statement_timestamp() else closed_at end,
           resolution_note=case when $4='close' then $7 else resolution_note end
       where id=$1 and campground_id=$2 and row_version=$3 returning *`,
      [
        handoffId,
        campgroundId,
        decision.expectedRowVersion,
        decision.action,
        assignee,
        actorUserId,
        decision.resolutionNote,
      ],
    );
    if (!changed.rowCount)
      throw new Error("Handoff changed. Refresh and retry.");
    const after = changed.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: after.organization_id,
      campgroundId,
      actionKey: `amenity.handoff.${decision.action}`,
      permissionKey: null,
      subjectType: "amenity.handoff",
      subjectId: handoffId,
      reason: decision.resolutionNote || null,
      beforeState: {
        status: before.status,
        assignedToUserId: before.assigned_to_user_id,
      },
      afterState: {
        status: after.status,
        assignedToUserId: after.assigned_to_user_id,
      },
    });
    return after.id;
  });
}
