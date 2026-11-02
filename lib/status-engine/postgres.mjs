import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

export const accommodationStatusStates = [
  "available",
  "held",
  "reserved",
  "arriving",
  "occupied",
  "departing",
  "inspection",
  "maintenance",
  "winterized",
  "closed",
];

export const operationalAssetStatusStates = [
  "unknown",
  "operational",
  "limited",
  "inspection",
  "maintenance",
  "unavailable",
  "seasonal",
  "winterized",
  "closed",
];

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for status operations.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

function statusChoice(value, allowed, label) {
  const normalized = String(value ?? "").trim();
  if (!allowed.includes(normalized)) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function transitionReason(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > 500) {
    throw new Error("Status reason must be 500 characters or fewer.");
  }
  return normalized;
}

async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeStatusEnginePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function listAccommodationStatusHistory(userId, campgroundId) {
  const canRead =
    (await hasCampgroundPermission(
      userId,
      campgroundId,
      "accommodation.read",
    )) ||
    (await hasCampgroundPermission(
      userId,
      campgroundId,
      "accommodation.manage",
    ));
  if (!canRead) {
    throw new Error("Not authorized to read accommodation status history.");
  }

  return withRls(userId, async (client) => {
    const result = await client.query(
      `select h.*, a.code, a.display_name
       from public.accommodation_status_history h
       join public.accommodations a on a.id = h.accommodation_id
       where h.campground_id = $1
       order by h.changed_at desc, h.id desc
       limit 200`,
      [campgroundId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      accommodationId: row.accommodation_id,
      code: row.code,
      displayName: row.display_name,
      fromState: row.from_state,
      toState: row.to_state,
      reason: row.reason ?? "",
      statusRevision: Number(row.status_revision),
      changedByUserId: row.changed_by_user_id,
      changedAt: row.changed_at.toISOString(),
    }));
  });
}

export async function listOperationalAssetStatusHistory(userId, campgroundId) {
  const canRead =
    (await hasCampgroundPermission(userId, campgroundId, "asset.read")) ||
    (await hasCampgroundPermission(userId, campgroundId, "asset.manage")) ||
    (await hasCampgroundPermission(userId, campgroundId, "equipment.read")) ||
    (await hasCampgroundPermission(userId, campgroundId, "equipment.manage"));
  if (!canRead) {
    throw new Error("Not authorized to read operational asset status history.");
  }

  return withRls(userId, async (client) => {
    const result = await client.query(
      `select h.*, a.code, a.display_name
       from public.operational_asset_status_history h
       join public.operational_assets a on a.id = h.asset_id
       where h.campground_id = $1
       order by h.changed_at desc, h.id desc
       limit 200`,
      [campgroundId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      assetClass: row.asset_class,
      code: row.code,
      displayName: row.display_name,
      fromState: row.from_state,
      toState: row.to_state,
      reason: row.reason ?? "",
      statusRevision: Number(row.status_revision),
      changedByUserId: row.changed_by_user_id,
      changedAt: row.changed_at.toISOString(),
    }));
  });
}

export async function transitionAccommodationStatus(input) {
  const allowed = await hasCampgroundPermission(
    input.actorUserId,
    input.campgroundId,
    "accommodation.manage",
  );
  if (!allowed) {
    throw new Error("Not authorized to change accommodation status.");
  }

  const toState = statusChoice(
    input.toState,
    accommodationStatusStates,
    "Accommodation status",
  );
  const reason = transitionReason(input.reason);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      input.actorUserId,
    ]);
    await client.query("select set_config('icamp.status_reason', $1, true)", [
      reason ?? "",
    ]);

    const before = await client.query(
      `select *
       from public.accommodations
       where id = $1 and campground_id = $2
       limit 1
       for update`,
      [input.accommodationId, input.campgroundId],
    );
    if (before.rowCount !== 1) {
      throw new Error("Accommodation is unavailable.");
    }

    const updated = await client.query(
      `update public.accommodations
       set status_state = $3, updated_by_user_id = $4
       where id = $1 and campground_id = $2 and row_version = $5
       returning *`,
      [
        input.accommodationId,
        input.campgroundId,
        toState,
        input.actorUserId,
        Number(input.expectedRowVersion),
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Accommodation changed since this page was loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    const previous = before.rows[0];
    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorSessionId: input.actorSessionId ?? null,
      organizationId: row.organization_id,
      campgroundId: input.campgroundId,
      actionKey: "accommodation.status.transition",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation",
      subjectId: input.accommodationId,
      beforeState: {
        statusState: previous.status_state,
        statusRevision: Number(previous.status_revision),
      },
      afterState: {
        statusState: row.status_state,
        statusRevision: Number(row.status_revision),
        availabilityRevision: Number(row.availability_revision),
        reason,
      },
    });

    await client.query("commit");
    return {
      rowVersion: Number(row.row_version),
      statusState: row.status_state,
      statusRevision: Number(row.status_revision),
      availabilityRevision: Number(row.availability_revision),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionOperationalAssetStatus(input) {
  const target = await getPool().query(
    `select asset_class
     from public.operational_assets
     where id = $1 and campground_id = $2
     limit 1`,
    [input.assetId, input.campgroundId],
  );
  if (target.rowCount !== 1) {
    throw new Error("Operational asset is unavailable.");
  }
  const assetClass = target.rows[0].asset_class;
  const permission =
    assetClass === "equipment" ? "equipment.manage" : "asset.manage";
  const allowed = await hasCampgroundPermission(
    input.actorUserId,
    input.campgroundId,
    permission,
  );
  if (!allowed) {
    throw new Error("Not authorized to change operational asset status.");
  }

  const toState = statusChoice(
    input.toState,
    operationalAssetStatusStates,
    "Operational asset status",
  );
  const reason = transitionReason(input.reason);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      input.actorUserId,
    ]);
    await client.query("select set_config('icamp.status_reason', $1, true)", [
      reason ?? "",
    ]);

    const before = await client.query(
      `select *
       from public.operational_assets
       where id = $1 and campground_id = $2
       limit 1
       for update`,
      [input.assetId, input.campgroundId],
    );
    if (before.rowCount !== 1) {
      throw new Error("Operational asset is unavailable.");
    }

    const updated = await client.query(
      `update public.operational_assets
       set operating_state = $3, updated_by_user_id = $4
       where id = $1 and campground_id = $2 and row_version = $5
       returning *`,
      [
        input.assetId,
        input.campgroundId,
        toState,
        input.actorUserId,
        Number(input.expectedRowVersion),
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Operational asset changed since this page was loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    const previous = before.rows[0];
    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorSessionId: input.actorSessionId ?? null,
      organizationId: row.organization_id,
      campgroundId: input.campgroundId,
      actionKey: "operational_asset.status.transition",
      permissionKey: permission,
      riskLevel: "standard",
      subjectType: "operational_asset",
      subjectId: input.assetId,
      beforeState: {
        operatingState: previous.operating_state,
        statusRevision: Number(previous.status_revision),
      },
      afterState: {
        operatingState: row.operating_state,
        statusRevision: Number(row.status_revision),
        reason,
      },
    });

    await client.query("commit");
    return {
      rowVersion: Number(row.row_version),
      operatingState: row.operating_state,
      statusRevision: Number(row.status_revision),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
