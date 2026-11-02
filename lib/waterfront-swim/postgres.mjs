import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  waterfrontUuid,
  normalizeWaterfrontZone,
  normalizeWaterfrontTraining,
  normalizeWaterfrontEvent,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for waterfront safety.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeWaterfrontPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(actor, work) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
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
const permissionKeys = [
  "waterfront.swim.read",
  "waterfront.swim.monitor",
  "waterfront.swim.manage",
];
export async function getWaterfrontPermissions(userId, campgroundId) {
  const flags = await Promise.all(
    permissionKeys.map((key) =>
      hasCampgroundPermission(userId, campgroundId, key),
    ),
  );
  return { read: flags[0], monitor: flags[1], manage: flags[2] };
}
async function assertPermission(actor, campground, key) {
  if (!(await hasCampgroundPermission(actor, campground, key)))
    throw new Error("Not authorized for waterfront safety operation.");
}
async function scope(client, campgroundId) {
  const { rows } = await client.query(
    "select id,organization_id,name,timezone from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (!rows[0]) throw new Error("Campground unavailable.");
  return rows[0];
}
function sameEvidence(record, expected) {
  return (
    Boolean(record) &&
    Object.entries(expected).every(([key, value]) => {
      const actual =
        record[key] instanceof Date ? record[key].toISOString() : record[key];
      if (Array.isArray(value))
        return JSON.stringify(actual) === JSON.stringify(value);
      return actual === value;
    })
  );
}
export async function getWaterfrontDashboard(userId, campgroundId) {
  const permissions = await getWaterfrontPermissions(userId, campgroundId);
  if (!Object.values(permissions).some(Boolean))
    throw new Error("Not authorized to view waterfront safety.");
  const roster = permissions.manage
    ? await connection().query(
        `select distinct a.user_id,u.email_normalized as email
    from icamp_private.campground_assignments a join icamp_private.user_accounts u on u.id=a.user_id
    where a.campground_id=$1 and a.assignment_state='active' and a.starts_at<=now()
    and (a.ends_at is null or a.ends_at>now()) order by email limit 250`,
        [campgroundId],
      )
    : { rows: [] };
  const activeStays = permissions.monitor
    ? await connection().query(
        `select r.id,a.code as accommodation_code,r.status
    from public.reservations r join public.accommodations a on a.id=r.accommodation_id and a.campground_id=r.campground_id
    where r.campground_id=$1 and r.status in ('confirmed','checked_in') and r.guest_user_id is not null
    order by r.arrival_date desc limit 250`,
        [campgroundId],
      )
    : { rows: [] };
  return transaction(userId, async (client) => {
    const campground = await scope(
      client,
      waterfrontUuid(campgroundId, "Campground"),
    );
    const [facilities, zones, training, events, rules] = await Promise.all([
      client.query(
        `select a.id,a.display_name,a.operating_state from public.operational_assets a
        join public.operational_facilities f on f.asset_id=a.id and f.campground_id=a.campground_id
        where a.campground_id=$1 and a.lifecycle_state='active' and f.facility_type='beach'
        order by a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select z.* from public.waterfront_swim_zone_versions z where z.campground_id=$1
        order by z.asset_id,z.zone_code,z.version_number desc limit 350`,
        [campgroundId],
      ),
      client.query(
        `select t.* from public.waterfront_staff_training_events t where t.campground_id=$1
        order by t.decided_at desc,t.id desc limit 180`,
        [campgroundId],
      ),
      client.query(
        `select e.* from public.waterfront_swim_events e where e.campground_id=$1
        order by e.occurred_at desc,e.id desc limit 250`,
        [campgroundId],
      ),
      client.query(
        `select v.id,v.version_number,s.title,s.facility_id from public.campground_rule_versions v
        join public.campground_rule_sets s on s.id=v.rule_set_id
        where v.campground_id=$1 and s.rule_category='waterfront' and not exists
          (select 1 from public.campground_rule_versions newer where newer.rule_set_id=v.rule_set_id
           and newer.version_number>v.version_number)
        order by s.title`,
        [campgroundId],
      ),
    ]);
    const staffLookup = new Map(
      roster.rows.map((item) => [item.user_id, item.email]),
    );
    return {
      campground,
      facilities: facilities.rows,
      zones: zones.rows,
      training: training.rows.map((item) => ({
        ...item,
        staff_email: staffLookup.get(item.staff_user_id) ?? null,
      })),
      events: events.rows,
      rules: rules.rows,
      staff: roster.rows,
      reservations: activeStays.rows,
      permissions,
    };
  });
}
export async function publishWaterfrontZone({
  actorUserId,
  campgroundId,
  ...raw
}) {
  const camp = waterfrontUuid(campgroundId, "Campground");
  const policy = normalizeWaterfrontZone(raw);
  await assertPermission(actorUserId, camp, "waterfront.swim.manage");
  return transaction(actorUserId, async (client) => {
    const s = await scope(client, camp);
    const previous = await client.query(
      "select * from public.waterfront_swim_zone_versions where id=$1",
      [policy.id],
    );
    if (previous.rows[0]) {
      if (
        !sameEvidence(previous.rows[0], {
          organization_id: s.organization_id,
          campground_id: camp,
          asset_id: policy.assetId,
          zone_code: policy.zoneCode,
          zone_name: policy.zoneName,
          boundary_description: policy.boundaryDescription,
          operating_days: policy.operatingDays,
          opens_at: policy.openTime + ":00",
          closes_at: policy.closeTime + ":00",
          maximum_swimmers: policy.maximumSwimmers,
          minimum_unaccompanied_age: policy.minimumUnaccompaniedAge,
          minimum_supervisor_age: policy.minimumSupervisorAge,
          maximum_children_per_supervisor: policy.maximumChildrenPerSupervisor,
          rule_version_id: policy.ruleVersionId,
          hazard_instructions: policy.hazardInstructions,
          published_by_user_id: actorUserId,
        })
      )
        throw new Error("Zone retry ID already used for different evidence.");
      return previous.rows[0];
    }
    const { rows } = await client.query(
      `insert into public.waterfront_swim_zone_versions
      (id,organization_id,campground_id,asset_id,zone_code,zone_name,version_number,boundary_description,operating_days,
       opens_at,closes_at,maximum_swimmers,minimum_unaccompanied_age,minimum_supervisor_age,
       maximum_children_per_supervisor,rule_version_id,hazard_instructions,published_by_user_id)
      select $1,$2,$3,$4,$5,$6,coalesce(max(version_number),0)+1,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
      from public.waterfront_swim_zone_versions where asset_id=$4 and zone_code=$5 returning *`,
      [
        policy.id,
        s.organization_id,
        camp,
        policy.assetId,
        policy.zoneCode,
        policy.zoneName,
        policy.boundaryDescription,
        policy.operatingDays,
        policy.openTime,
        policy.closeTime,
        policy.maximumSwimmers,
        policy.minimumUnaccompaniedAge,
        policy.minimumSupervisorAge,
        policy.maximumChildrenPerSupervisor,
        policy.ruleVersionId,
        policy.hazardInstructions,
        actorUserId,
      ],
    );
    return rows[0];
  });
}
export async function recordWaterfrontTraining({
  actorUserId,
  campgroundId,
  ...raw
}) {
  const camp = waterfrontUuid(campgroundId, "Campground");
  const evidence = normalizeWaterfrontTraining(raw);
  await assertPermission(actorUserId, camp, "waterfront.swim.manage");
  return transaction(actorUserId, async (client) => {
    const s = await scope(client, camp);
    const { rows } = await client.query(
      `insert into public.waterfront_staff_training_events
     (id,organization_id,campground_id,asset_id,staff_user_id,decision,training_reference,expires_at,note,decided_by_user_id)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do nothing returning *`,
      [
        evidence.id,
        s.organization_id,
        camp,
        evidence.assetId,
        evidence.staffUserId,
        evidence.decision,
        evidence.trainingReference,
        evidence.expiresAt,
        evidence.note,
        actorUserId,
      ],
    );
    if (rows[0]) return rows[0];
    const previous = await client.query(
      "select * from public.waterfront_staff_training_events where id=$1",
      [evidence.id],
    );
    if (
      !sameEvidence(previous.rows[0], {
        organization_id: s.organization_id,
        campground_id: camp,
        asset_id: evidence.assetId,
        staff_user_id: evidence.staffUserId,
        decision: evidence.decision,
        training_reference: evidence.trainingReference,
        expires_at: evidence.expiresAt,
        note: evidence.note,
        decided_by_user_id: actorUserId,
      })
    )
      throw new Error("Training retry ID was already used differently.");
    return previous.rows[0];
  });
}
export async function recordWaterfrontEvent({
  actorUserId,
  campgroundId,
  ...raw
}) {
  const camp = waterfrontUuid(campgroundId, "Campground");
  const evidence = normalizeWaterfrontEvent(raw);
  await assertPermission(
    actorUserId,
    camp,
    evidence.kind === "reopen"
      ? "waterfront.swim.manage"
      : "waterfront.swim.monitor",
  );
  return transaction(actorUserId, async (client) => {
    const s = await scope(client, camp);
    const { rows } = await client.query(
      `insert into public.waterfront_swim_events
     (id,organization_id,campground_id,asset_id,zone_code,zone_version_id,kind,reservation_id,
      swimmer_count,underage_count,supervisor_count,admitted,ages_verified,hazard_type,hazard_level,
      evidence_reference,note,actor_user_id)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     on conflict(id) do nothing returning *`,
      [
        evidence.id,
        s.organization_id,
        camp,
        evidence.assetId,
        evidence.zoneCode,
        evidence.zoneVersionId,
        evidence.kind,
        evidence.reservationId,
        evidence.swimmerCount,
        evidence.underageCount,
        evidence.supervisorCount,
        evidence.admitted,
        evidence.agesVerified,
        evidence.hazardType,
        evidence.hazardLevel,
        evidence.evidenceReference,
        evidence.note,
        actorUserId,
      ],
    );
    if (rows[0]) return rows[0];
    const previous = await client.query(
      "select * from public.waterfront_swim_events where id=$1",
      [evidence.id],
    );
    if (
      !sameEvidence(previous.rows[0], {
        organization_id: s.organization_id,
        campground_id: camp,
        asset_id: evidence.assetId,
        zone_code: evidence.zoneCode,
        zone_version_id: evidence.zoneVersionId,
        kind: evidence.kind,
        reservation_id: evidence.reservationId,
        swimmer_count: evidence.swimmerCount,
        underage_count: evidence.underageCount,
        supervisor_count: evidence.supervisorCount,
        admitted: evidence.admitted,
        ages_verified: evidence.agesVerified,
        hazard_type: evidence.hazardType,
        hazard_level: evidence.hazardLevel,
        evidence_reference: evidence.evidenceReference,
        note: evidence.note,
        actor_user_id: actorUserId,
      })
    )
      throw new Error(
        "Waterfront event retry ID was already used differently.",
      );
    return previous.rows[0];
  });
}
