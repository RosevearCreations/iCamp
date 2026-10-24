import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validUuid } from "../campground-rules/core.mjs";
import {
  normalizeEnforcementCase,
  normalizeEnforcementDecision,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for safety enforcement.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeEnforcementPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(userId, work) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
const permissions = [
  "safety.warning.issue",
  "safety.suspension.issue",
  "safety.suspension.review",
];
export async function getEnforcementPermissions(userId, campgroundId) {
  const entries = await Promise.all(
    permissions.map(async (permission) => [
      permission,
      await hasCampgroundPermission(userId, campgroundId, permission),
    ]),
  );
  return {
    warning: entries[0][1],
    request: entries[1][1],
    review: entries[2][1],
  };
}
async function assertPermission(actorId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(actorId, campgroundId, permission)))
    throw new Error("Not authorized for this enforcement action.");
}
async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select id,organization_id,name from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (!result.rowCount) throw new Error("Campground is unavailable.");
  return result.rows[0];
}
export async function getEnforcementDashboard(userId, campgroundId) {
  const perms = await getEnforcementPermissions(userId, campgroundId);
  if (!Object.values(perms).some(Boolean))
    throw new Error("Not authorized to view the enforcement register.");
  return transaction(userId, async (client) => {
    const campground = await campgroundScope(client, campgroundId);
    const [reservations, facilities, zones, rules, cases] = await Promise.all([
        client.query(
          `select r.id,r.guest_user_id,r.status,a.code as accommodation_code,
           r.arrival_date,r.departure_date
           from public.reservations r join public.accommodations a
            on a.id=r.accommodation_id and a.campground_id=r.campground_id
           where r.campground_id=$1 and r.status in ('confirmed','checked_in')
            and r.guest_user_id is not null
           order by r.arrival_date desc limit 250`,
          [campgroundId],
        ),
        client.query(
          `select id,code,display_name from public.operational_assets
           where campground_id=$1 and asset_class='facility'
            and lifecycle_state='active' order by code limit 200`,
          [campgroundId],
        ),
        client.query(
          `select id,zone_code,display_name from public.access_zones
           where campground_id=$1 and is_active order by zone_code limit 200`,
          [campgroundId],
        ),
        client.query(
          `select v.id,s.code,s.title,v.version_number
           from public.campground_rule_sets s
           join lateral (select * from public.campground_rule_versions v
            where v.rule_set_id=s.id order by v.version_number desc limit 1) v on true
           where s.campground_id=$1 order by s.code limit 200`,
          [campgroundId],
        ),
        client.query(
          `select c.*,a.code as accommodation_code,
             f.display_name as facility_name,z.display_name as zone_name,
             v.version_number as rule_version_number
           from public.safety_enforcement_cases c
           join public.reservations r on r.id=c.reservation_id
           join public.accommodations a on a.id=r.accommodation_id
           left join public.operational_assets f on f.id=c.facility_id
           left join public.access_zones z on z.id=c.access_zone_id
           left join public.campground_rule_versions v on v.id=c.rule_version_id
           where c.campground_id=$1 order by
            case c.case_state when 'pending_review' then 0
              when 'active' then 1 else 2 end,c.created_at desc limit 100`,
          [campgroundId],
        ),
      ]);
    const events = cases.rows.length
      ? await client.query(
          `select e.* from public.safety_enforcement_events e
           where e.campground_id=$1 and e.case_id=any($2::uuid[])
           order by e.occurred_at desc`,
          [
            campgroundId,
            cases.rows.map((item) => item.id),
          ],
        )
      : { rows: [] };
    const eventsByCase = new Map();
    for (const event of events.rows) {
      const list = eventsByCase.get(event.case_id) ?? [];
      list.push(event);
      eventsByCase.set(event.case_id, list);
    }
    return {
      campground,
      reservations: reservations.rows,
      facilities: facilities.rows,
      zones: zones.rows,
      rules: rules.rows,
      cases: cases.rows.map((item) => ({
        ...item,
        events: eventsByCase.get(item.id) ?? [],
      })),
    };
  });
}
export async function recordEnforcementCase({
  actorUserId,
  campgroundId,
  ...input
}) {
  const scopeId = validUuid(campgroundId, "Campground");
  const caseInput = normalizeEnforcementCase(input);
  await assertPermission(
    actorUserId,
    scopeId,
    caseInput.kind === "warning"
      ? "safety.warning.issue"
      : "safety.suspension.issue",
  );
  return transaction(actorUserId, async (client) => {
    const campground = await campgroundScope(client, scopeId);
    const reservation = await client.query(
      `select guest_user_id from public.reservations
       where id=$1 and campground_id=$2 and status in ('confirmed','checked_in')`,
      [caseInput.reservationId, scopeId],
    );
    if (!reservation.rowCount || !reservation.rows[0].guest_user_id)
      throw new Error("Select a confirmed or checked-in account-linked stay.");
    const params = [
      caseInput.caseId,
      campground.organization_id,
      scopeId,
      caseInput.reservationId,
      reservation.rows[0].guest_user_id,
      caseInput.ruleVersionId,
      caseInput.kind,
      caseInput.scopeType,
      caseInput.facilityId,
      caseInput.accessZoneId,
      caseInput.feature,
      caseInput.reason,
      caseInput.kind === "warning" ? "warning_recorded" : "pending_review",
      actorUserId,
    ];
    const inserted = await client.query(
      `insert into public.safety_enforcement_cases
       (id,organization_id,campground_id,reservation_id,guest_user_id,
        rule_version_id,case_kind,scope_type,facility_id,access_zone_id,
        feature_code,reason_summary,case_state,created_by_user_id,updated_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       on conflict(id) do nothing returning *`,
      params,
    );
    if (inserted.rows[0]) return inserted.rows[0];
    const previous = await client.query(
      `select * from public.safety_enforcement_cases
       where id=$1 and campground_id=$2`,
      [caseInput.caseId, scopeId],
    );
    const existing = previous.rows[0];
    if (
      !existing ||
      existing.created_by_user_id !== actorUserId ||
      existing.reservation_id !== caseInput.reservationId ||
      existing.rule_version_id !== caseInput.ruleVersionId ||
      existing.case_kind !== caseInput.kind ||
      existing.scope_type !== caseInput.scopeType ||
      existing.facility_id !== caseInput.facilityId ||
      existing.access_zone_id !== caseInput.accessZoneId ||
      existing.feature_code !== caseInput.feature ||
      existing.reason_summary !== caseInput.reason
    )
      throw new Error("Case retry ID was already used for different evidence.");
    return existing;
  });
}
export async function decideEnforcementCase({
  actorUserId,
  campgroundId,
  ...input
}) {
  const scopeId = validUuid(campgroundId, "Campground");
  await assertPermission(actorUserId, scopeId, "safety.suspension.review");
  const decision = normalizeEnforcementDecision(input);
  const target = {
    approve: "active",
    deny: "denied",
    reinstate: "reinstated",
  }[decision.decision];
  return transaction(actorUserId, async (client) => {
    const result = await client.query(
      `update public.safety_enforcement_cases set case_state=$1,
         decision_note=$2,updated_by_user_id=$3,
         updated_at=statement_timestamp(),row_version=row_version+1
       where id=$4 and campground_id=$5 and row_version=$6
         and case_kind='suspension'
       returning *`,
      [
        target,
        decision.note,
        actorUserId,
        decision.caseId,
        scopeId,
        decision.expectedVersion,
      ],
    );
    if (!result.rowCount)
      throw new Error(
        "Case changed or is unavailable. Refresh before deciding.",
      );
    return result.rows[0];
  });
}
export async function getGuestActiveSuspensions({ userId, reservationId }) {
  const reservation = validUuid(reservationId, "Reservation");
  return transaction(userId, async (client) => {
    const result = await client.query(
      `select c.id,c.scope_type,c.feature_code,c.reason_summary,
         f.display_name as facility_name,z.display_name as zone_name,
         c.updated_at
       from public.safety_enforcement_cases c
       left join public.operational_assets f on f.id=c.facility_id
       left join public.access_zones z on z.id=c.access_zone_id
       where c.reservation_id=$1 and c.guest_user_id=$2
        and c.case_kind='suspension' and c.case_state='active'
       order by c.updated_at desc`,
      [reservation, userId],
    );
    return result.rows;
  });
}
