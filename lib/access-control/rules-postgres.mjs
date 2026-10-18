import pg from "pg";

import { evaluateZoneAccess } from "./rules.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for access-rule evaluation.");
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

export async function closeAccessRulesPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function evaluateAccessForDevice({
  campgroundId,
  deviceId,
  context,
}) {
  const client = await getPool().connect();

  try {
    const zoneRows = await client.query(
      `select
         z.id,z.zone_kind,z.is_active
       from public.access_zone_devices zd
       join public.access_zones z
         on z.organization_id=zd.organization_id
        and z.campground_id=zd.campground_id
        and z.id=zd.zone_id
       where zd.campground_id=$1
         and zd.device_id=$2
       order by z.zone_code`,
      [campgroundId, deviceId],
    );

    if (zoneRows.rowCount === 0) {
      return {
        allowed: false,
        reason: "device_has_no_enforceable_zone",
        zoneDecisions: [],
      };
    }

    const zoneIds = zoneRows.rows.map((row) => row.id);
    const ruleRows = await client.query(
      `select
         id,zone_id,schedule_id,priority,effect,subject_kind,
         event_reference,require_active_stay,decision_reason,is_active
       from public.access_rules
       where campground_id=$1
         and zone_id=any($2::uuid[])
       order by priority desc,effect,id`,
      [campgroundId, zoneIds],
    );

    const scheduleIds = [
      ...new Set(
        ruleRows.rows
          .map((row) => row.schedule_id)
          .filter((value) => value != null),
      ),
    ];

    const scheduleRows =
      scheduleIds.length === 0
        ? { rows: [] }
        : await client.query(
            `select
               id,weekdays,start_local::text,end_local::text,
               valid_from::text,valid_until::text,is_active
             from public.access_schedules
             where campground_id=$1
               and id=any($2::uuid[])`,
            [campgroundId, scheduleIds],
          );

    const schedules = scheduleRows.rows.map((row) => ({
      id: row.id,
      weekdays: row.weekdays,
      startLocal: row.start_local,
      endLocal: row.end_local,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      isActive: row.is_active,
    }));

    const zoneDecisions = zoneRows.rows.map((zone) =>
      evaluateZoneAccess({
        zone: {
          id: zone.id,
          zoneKind: zone.zone_kind,
          isActive: zone.is_active,
        },
        rules: ruleRows.rows
          .filter((rule) => rule.zone_id === zone.id)
          .map((rule) => ({
            id: rule.id,
            scheduleId: rule.schedule_id,
            priority: rule.priority,
            effect: rule.effect,
            subjectKind: rule.subject_kind,
            eventReference: rule.event_reference,
            requireActiveStay: rule.require_active_stay,
            decisionReason: rule.decision_reason,
            isActive: rule.is_active,
          })),
        schedules,
        context,
      }),
    );

    const denied = zoneDecisions.find((decision) => !decision.allowed);
    if (denied) {
      return {
        allowed: false,
        reason: denied.reason,
        zoneDecisions,
      };
    }

    return {
      allowed: true,
      reason: "all_bound_zones_allow",
      zoneDecisions,
    };
  } finally {
    client.release();
  }
}
