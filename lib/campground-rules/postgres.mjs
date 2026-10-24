import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeRuleAcknowledgement,
  normalizeRulePublication,
  normalizeRuleSet,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for campground rules.");
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeCampgroundRulesPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(userId, work) {
  const client = await getPool().connect();
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
async function assertStaffAccess(userId, campgroundId, level = "read") {
  const checks =
    level === "publish"
      ? ["campground.rules.publish"]
      : ["campground.rules.read", "campground.rules.publish"];
  if (
    !(
      await Promise.all(
        checks.map((p) => hasCampgroundPermission(userId, campgroundId, p)),
      )
    ).some(Boolean)
  )
    throw new Error("Not authorized to access campground rule publications.");
}
async function property(client, campgroundId) {
  const result = await client.query(
    "select id,organization_id,name from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0];
}

export async function getRuleSetDashboard(userId, campgroundId) {
  await assertStaffAccess(userId, campgroundId);
  return transaction(userId, async (client) => {
    const campground = await property(client, campgroundId);
    const [sets, facilities, counts] = await Promise.all([
      client.query(
        `select s.*,v.id as current_version_id,v.version_number,v.content,v.acknowledgement_required,
        v.published_at,v.published_by_user_id
        from public.campground_rule_sets s
        left join lateral (select * from public.campground_rule_versions v where v.rule_set_id=s.id
          order by v.version_number desc limit 1) v on true
        where s.campground_id=$1 order by s.rule_category,s.code`,
        [campgroundId],
      ),
      client.query(
        `select id,code,display_name from public.operational_assets
        where campground_id=$1 and asset_class='facility' and lifecycle_state='active'
        order by code limit 300`,
        [campgroundId],
      ),
      client.query(
        `select a.rule_version_id,count(*)::integer as acknowledgement_count
        from public.campground_rule_acknowledgements a where a.campground_id=$1
        group by a.rule_version_id`,
        [campgroundId],
      ),
    ]);
    const byVersion = new Map(
      counts.rows.map((row) => [
        row.rule_version_id,
        Number(row.acknowledgement_count),
      ]),
    );
    return {
      campground,
      facilities: facilities.rows,
      sets: sets.rows.map((row) => ({
        ...row,
        acknowledgement_count: byVersion.get(row.current_version_id) ?? 0,
      })),
    };
  });
}

export async function createCampgroundRuleSet({
  actorUserId,
  campgroundId,
  ...input
}) {
  await assertStaffAccess(actorUserId, campgroundId, "publish");
  const rule = normalizeRuleSet(input);
  return transaction(actorUserId, async (client) => {
    const campground = await property(client, campgroundId);
    const inserted = await client.query(
      `insert into public.campground_rule_sets
      (organization_id,campground_id,code,title,rule_category,facility_id,created_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        campground.organization_id,
        campgroundId,
        rule.code,
        rule.title,
        rule.category,
        rule.facilityId,
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function publishCampgroundRuleVersion({
  actorUserId,
  campgroundId,
  ...input
}) {
  await assertStaffAccess(actorUserId, campgroundId, "publish");
  const publish = normalizeRulePublication(input);
  return transaction(actorUserId, async (client) => {
    const campground = await property(client, campgroundId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      `campground-rule-version:${publish.ruleSetId}`,
    ]);
    const previous = await client.query(
      `select * from public.campground_rule_versions
      where campground_id=$1 and client_publication_id=$2`,
      [campgroundId, publish.clientPublicationId],
    );
    if (previous.rowCount) {
      const row = previous.rows[0];
      if (
        row.rule_set_id !== publish.ruleSetId ||
        row.content !== publish.content ||
        row.acknowledgement_required !== publish.acknowledgementRequired ||
        row.version_number !== publish.expectedVersion + 1
      )
        throw new Error(
          "Publication retry ID already exists with different content.",
        );
      return row;
    }
    const sets = await client.query(
      `select id from public.campground_rule_sets
      where campground_id=$1 and id=$2`,
      [campgroundId, publish.ruleSetId],
    );
    if (!sets.rowCount)
      throw new Error("Rule set is unavailable in this campground.");
    const current = await client.query(
      `select coalesce(max(version_number),0)::integer as latest
      from public.campground_rule_versions where rule_set_id=$1`,
      [publish.ruleSetId],
    );
    const latest = Number(current.rows[0].latest);
    if (latest !== publish.expectedVersion)
      throw new Error(
        "Rules changed since this page was opened. Refresh and review the latest version.",
      );
    const inserted = await client.query(
      `insert into public.campground_rule_versions
      (organization_id,campground_id,rule_set_id,version_number,client_publication_id,
       content,acknowledgement_required,published_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [
        campground.organization_id,
        campgroundId,
        publish.ruleSetId,
        latest + 1,
        publish.clientPublicationId,
        publish.content,
        publish.acknowledgementRequired,
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function getGuestRulePublications({ userId, reservationId }) {
  return transaction(userId, async (client) => {
    const reservation = await client.query(
      `select id,organization_id,campground_id from public.reservations
      where id=$1 and guest_user_id=$2 and status in ('confirmed','checked_in')`,
      [reservationId, userId],
    );
    if (!reservation.rowCount) return [];
    const rows = await client.query(
      `select s.id as rule_set_id,s.code,s.title,s.rule_category,
      s.facility_id,v.id as rule_version_id,v.version_number,v.content,
      v.acknowledgement_required,v.published_at,a.acknowledged_at
      from public.campground_rule_sets s
      join lateral (select * from public.campground_rule_versions v
        where v.rule_set_id=s.id order by v.version_number desc limit 1) v on true
      left join public.campground_rule_acknowledgements a
        on a.rule_version_id=v.id and a.reservation_id=$1
      where s.campground_id=$2 order by s.rule_category,s.code`,
      [reservationId, reservation.rows[0].campground_id],
    );
    return rows.rows;
  });
}

export async function acknowledgeCurrentCampgroundRule({ userId, ...input }) {
  const ack = normalizeRuleAcknowledgement(input);
  return transaction(userId, async (client) => {
    const reservation = await client.query(
      `select organization_id,campground_id from public.reservations
      where id=$1 and guest_user_id=$2 and status in ('confirmed','checked_in')`,
      [ack.reservationId, userId],
    );
    if (!reservation.rowCount)
      throw new Error("A confirmed, guest-owned stay is required.");
    const scope = reservation.rows[0];
    const previous = await client.query(
      `select id from public.campground_rule_acknowledgements
      where rule_version_id=$1 and reservation_id=$2`,
      [ack.ruleVersionId, ack.reservationId],
    );
    if (previous.rowCount) return previous.rows[0];
    const current = await client.query(
      `select v.id,v.acknowledgement_required from public.campground_rule_versions v
      where v.rule_set_id=$1 and v.campground_id=$2 order by v.version_number desc limit 1`,
      [ack.ruleSetId, scope.campground_id],
    );
    if (
      current.rows[0]?.id !== ack.ruleVersionId ||
      !current.rows[0]?.acknowledgement_required
    )
      throw new Error(
        "Rule version changed or does not require acknowledgement. Refresh My Stay.",
      );
    const inserted = await client.query(
      `insert into public.campground_rule_acknowledgements
      (organization_id,campground_id,rule_set_id,rule_version_id,reservation_id,guest_user_id)
      values($1,$2,$3,$4,$5,$6) on conflict(rule_version_id,reservation_id) do nothing returning id`,
      [
        scope.organization_id,
        scope.campground_id,
        ack.ruleSetId,
        ack.ruleVersionId,
        ack.reservationId,
        userId,
      ],
    );
    if (inserted.rowCount) return inserted.rows[0];
    const replay = await client.query(
      `select id from public.campground_rule_acknowledgements
      where rule_version_id=$1 and reservation_id=$2`,
      [ack.ruleVersionId, ack.reservationId],
    );
    if (!replay.rowCount)
      throw new Error("Could not confirm rule acknowledgement.");
    return replay.rows[0];
  });
}
