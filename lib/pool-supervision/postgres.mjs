import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  swimUuid,
  normalizePoolPolicy,
  normalizePoolQualification,
  normalizePoolEvent,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for pool supervision.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closePoolSupervisionForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function inTransaction(actor, task) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await task(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
const keys = [
  "pool.supervision.read",
  "pool.supervision.attest",
  "pool.supervision.manage",
];
export async function getPoolPermissions(userId, campgroundId) {
  const values = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { read: values[0], attest: values[1], manage: values[2] };
}
async function requirePermission(actor, campground, key) {
  if (!(await hasCampgroundPermission(actor, campground, key)))
    throw new Error("Not authorized for pool supervision action.");
}
function sameEvidence(record, values) {
  return (
    Boolean(record) &&
    Object.entries(values).every(([key, value]) => {
      const stored =
        record[key] instanceof Date ? record[key].toISOString() : record[key];
      return stored === value;
    })
  );
}
async function scope(client, campgroundId) {
  const { rows } = await client.query(
    "select id,organization_id,name from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (!rows[0]) throw new Error("Campground unavailable.");
  return rows[0];
}
export async function getPoolDashboard(userId, campgroundId) {
  const permissions = await getPoolPermissions(userId, campgroundId);
  if (!Object.values(permissions).some(Boolean))
    throw new Error("Not authorized to view pool supervision.");
  const roster = permissions.manage
    ? await connection().query(
        `select distinct a.user_id,u.email_normalized as email
    from icamp_private.campground_assignments a
    join icamp_private.user_accounts u on u.id=a.user_id
    where a.campground_id=$1 and a.assignment_state='active'
    and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now())
    order by email limit 250`,
        [campgroundId],
      )
    : { rows: [] };
  const activeStays = permissions.attest
    ? await connection().query(
        `select r.id,a.code as accommodation_code,r.status
      from public.reservations r join public.accommodations a
      on a.id=r.accommodation_id and a.campground_id=r.campground_id
      where r.campground_id=$1 and r.status in ('confirmed','checked_in')
      and r.guest_user_id is not null order by r.arrival_date desc limit 250`,
        [campgroundId],
      )
    : { rows: [] };
  return inTransaction(userId, async (client) => {
    const campground = await scope(
      client,
      swimUuid(campgroundId, "Campground"),
    );
    const [facilities, policies, qualifications, events, rules] =
      await Promise.all([
        client.query(
          `select a.id,a.display_name,a.operating_state from public.operational_assets a
       join public.operational_facilities f on f.asset_id=a.id and f.campground_id=a.campground_id
       where a.campground_id=$1 and a.lifecycle_state='active' and f.facility_type='pool' order by a.display_name`,
          [campgroundId],
        ),
        client.query(
          `select p.* from public.pool_swim_policies p where p.campground_id=$1
       order by p.asset_id,p.version_number desc limit 250`,
          [campgroundId],
        ),
        client.query(
          `select q.* from public.pool_staff_qualifications q
       where q.campground_id=$1 order by q.decided_at desc,q.id desc limit 200`,
          [campgroundId],
        ),
        client.query(
          `select e.* from public.pool_swim_events e where e.campground_id=$1
       order by e.occurred_at desc,e.id desc limit 250`,
          [campgroundId],
        ),
        client.query(
          `select v.id,v.version_number,s.title,s.facility_id from public.campground_rule_versions v
       join public.campground_rule_sets s on s.id=v.rule_set_id
       where v.campground_id=$1 and s.rule_category='pool'
       and not exists(select 1 from public.campground_rule_versions newer where newer.rule_set_id=v.rule_set_id and newer.version_number>v.version_number)
       order by s.title`,
          [campgroundId],
        ),
      ]);
    const lookup = new Map(roster.rows.map((s) => [s.user_id, s.email]));
    return {
      campground,
      facilities: facilities.rows,
      policies: policies.rows,
      qualifications: qualifications.rows.map((q) => ({
        ...q,
        staff_email: lookup.get(q.staff_user_id) ?? null,
      })),
      events: events.rows,
      rules: rules.rows,
      staff: roster.rows,
      reservations: activeStays.rows,
      permissions,
    };
  });
}
export async function publishPoolPolicy({ actorUserId, campgroundId, ...raw }) {
  const campground = swimUuid(campgroundId, "Campground");
  const data = normalizePoolPolicy(raw);
  await requirePermission(actorUserId, campground, "pool.supervision.manage");
  return inTransaction(actorUserId, async (client) => {
    const s = await scope(client, campground);
    const existing = await client.query(
      "select * from public.pool_swim_policies where id=$1",
      [data.id],
    );
    if (existing.rows[0]) {
      if (
        !sameEvidence(existing.rows[0], {
          organization_id: s.organization_id,
          campground_id: campground,
          published_by_user_id: actorUserId,
          asset_id: data.assetId,
          rule_version_id: data.ruleVersionId,
          maximum_bathers: data.maximumBathers,
          minimum_unaccompanied_age: data.minimumUnaccompaniedAge,
          minimum_supervisor_age: data.minimumSupervisorAge,
          maximum_children_per_supervisor: data.maximumChildrenPerSupervisor,
          minimum_lifeguards: data.minimumLifeguards,
          safety_instructions: data.safetyInstructions,
        })
      )
        throw new Error(
          "Policy retry ID is already used by different evidence.",
        );
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.pool_swim_policies
     (id,organization_id,campground_id,asset_id,version_number,maximum_bathers,minimum_unaccompanied_age,
      minimum_supervisor_age,maximum_children_per_supervisor,minimum_lifeguards,rule_version_id,safety_instructions,published_by_user_id)
     select $1,$2,$3,$4,coalesce(max(version_number),0)+1,$5,$6,$7,$8,$9,$10,$11,$12 from public.pool_swim_policies where asset_id=$4 returning *`,
      [
        data.id,
        s.organization_id,
        campground,
        data.assetId,
        data.maximumBathers,
        data.minimumUnaccompaniedAge,
        data.minimumSupervisorAge,
        data.maximumChildrenPerSupervisor,
        data.minimumLifeguards,
        data.ruleVersionId,
        data.safetyInstructions,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordPoolQualification({
  actorUserId,
  campgroundId,
  ...raw
}) {
  const campground = swimUuid(campgroundId, "Campground");
  const data = normalizePoolQualification(raw);
  await requirePermission(actorUserId, campground, "pool.supervision.manage");
  return inTransaction(actorUserId, async (client) => {
    const s = await scope(client, campground);
    const { rows } = await client.query(
      `insert into public.pool_staff_qualifications
    (id,organization_id,campground_id,asset_id,staff_user_id,decision,credential_reference,expires_at,decision_note,decided_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do nothing returning *`,
      [
        data.id,
        s.organization_id,
        campground,
        data.assetId,
        data.staffUserId,
        data.decision,
        data.credentialReference,
        data.expiresAt,
        data.decisionNote,
        actorUserId,
      ],
    );
    if (rows[0]) return rows[0];
    const prior = await client.query(
      "select * from public.pool_staff_qualifications where id=$1",
      [data.id],
    );
    if (
      !sameEvidence(prior.rows[0], {
        organization_id: s.organization_id,
        campground_id: campground,
        decided_by_user_id: actorUserId,
        asset_id: data.assetId,
        staff_user_id: data.staffUserId,
        decision: data.decision,
        credential_reference: data.credentialReference,
        expires_at: data.expiresAt,
        decision_note: data.decisionNote,
      })
    )
      throw new Error("Credential retry ID already used differently.");
    return prior.rows[0];
  });
}
export async function recordPoolEvent({ actorUserId, campgroundId, ...raw }) {
  const campground = swimUuid(campgroundId, "Campground");
  const data = normalizePoolEvent(raw);
  await requirePermission(
    actorUserId,
    campground,
    data.kind === "release"
      ? "pool.supervision.manage"
      : "pool.supervision.attest",
  );
  return inTransaction(actorUserId, async (client) => {
    const s = await scope(client, campground);
    const { rows } = await client.query(
      `insert into public.pool_swim_events
    (id,organization_id,campground_id,asset_id,policy_id,kind,reservation_id,
      bather_count,underage_count,supervisor_count,lifeguard_count,admitted,supervision_ages_verified,reason,actor_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    on conflict(id) do nothing returning *`,
      [
        data.id,
        s.organization_id,
        campground,
        data.assetId,
        data.policyId,
        data.kind,
        data.reservationId,
        data.batherCount,
        data.underageCount,
        data.supervisorCount,
        data.lifeguardCount,
        data.admitted,
        data.supervisionAgesVerified,
        data.reason,
        actorUserId,
      ],
    );
    if (rows[0]) return rows[0];
    const prior = await client.query(
      "select * from public.pool_swim_events where id=$1",
      [data.id],
    );
    if (
      !sameEvidence(prior.rows[0], {
        organization_id: s.organization_id,
        campground_id: campground,
        actor_user_id: actorUserId,
        asset_id: data.assetId,
        policy_id: data.policyId,
        kind: data.kind,
        reservation_id: data.reservationId,
        bather_count: data.batherCount,
        underage_count: data.underageCount,
        supervisor_count: data.supervisorCount,
        lifeguard_count: data.lifeguardCount,
        admitted: data.admitted,
        supervision_ages_verified: data.supervisionAgesVerified,
        reason: data.reason,
      })
    )
      throw new Error("Event retry ID already used differently.");
    return prior.rows[0];
  });
}
