import pg from "pg";
import { createHmac, timingSafeEqual } from "node:crypto";

const { Pool } = pg;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;
function db() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Error("ORIGINAL_DATABASE_UNAVAILABLE");
  if (!pool) pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 4500 });
  return pool;
}
export async function originalSchema267() {
  try {
    const r = await db().query(
      "select to_regclass('icamp_private.support_ownership267') is not null as ownership, " +
        "to_regclass('icamp_private.telemetry_enrollment267') is not null as enrollment, " +
        "to_regclass('icamp_private.telemetry_samples267') is not null as samples, " +
        "exists(select 1 from icamp_meta.schema_migrations where version='0241') as predecessor, " +
        "exists(select 1 from icamp_meta.schema_migrations where version='0242') as current",
    );
    return Object.values(r.rows[0] ?? {}).every((x) => x === true);
  } catch {
    return false;
  }
}
export async function listSupportOwnership267() {
  if (!(await originalSchema267())) return { status: "HOLD_ORIGINAL_0242", cases: [], coverageCapped: false };
  const r = await db().query(
    "select c.id,c.category,c.severity,c.status,c.created_at," +
      " o.assigned_user_id,o.escalation_level,o.version " +
      "from icamp_private.campground_support265 c " +
      "left join icamp_private.support_ownership267 o on o.case_id=c.id " +
      "where c.status<>'resolved' order by c.created_at desc limit 101",
  );
  return {
    status: "ORIGINAL_SUPPORT_OWNERSHIP_OBSERVED",
    coverageCapped: r.rows.length > 100,
    cases: r.rows.slice(0, 100).map((x) => ({
      id: x.id,
      category: x.category,
      severity: x.severity,
      status: x.status,
      createdAt: x.created_at.toISOString(),
      assignedUserId: x.assigned_user_id,
      escalationLevel: x.escalation_level ?? 0,
      version: x.version ?? 0,
    })),
  };
}
export async function assignSupport267({ actorUserId, caseId, assigneeId, version, escalate }) {
  if (![actorUserId, caseId, assigneeId].every((id) => UUID.test(id)))
    throw Error("Original UUID identifiers required");
  if (!Number.isInteger(version) || version < 0 || version > 100000 || typeof escalate !== "boolean")
    throw Error("Invalid optimistic version or escalation");
  if (!(await originalSchema267())) throw Error("HOLD_ORIGINAL_0242");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout='8000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actorUserId]);
    const caseRow = await client.query(
      "select id,status from icamp_private.campground_support265 where id=$1 for update",
      [caseId],
    );
    if (caseRow.rowCount !== 1 || caseRow.rows[0].status === "resolved")
      throw Error("Original unresolved case required");
    const current = await client.query(
      "select version,escalation_level from icamp_private.support_ownership267 where case_id=$1 for update",
      [caseId],
    );
    const previous = current.rows[0];
    if ((previous?.version ?? 0) !== version || (escalate && !previous))
      throw Error("Ownership changed or escalation must follow assignment");
    const level = (previous?.escalation_level ?? 0) + (escalate ? 1 : 0);
    if (level > 3) throw Error("Maximum escalation reached");
    const action = escalate ? "escalated" : previous ? "reassigned" : "assigned";
    const updated = await client.query(
      "insert into icamp_private.support_ownership267 " +
        "(case_id,assigned_user_id,assigned_by_user_id,escalation_level) " +
        "values($1,$2,$3,0) " +
        "on conflict(case_id) do update set assigned_user_id=$2,assigned_by_user_id=$3," +
        "assigned_at=statement_timestamp(),escalation_level=$4," +
        "version=icamp_private.support_ownership267.version+1 returning version",
      [caseId, assigneeId, actorUserId, level],
    );
    await client.query(
      "insert into icamp_private.support_events267 " +
        "(case_id,actor_user_id,assigned_user_id,action,escalation_level) values($1,$2,$3,$4,$5)",
      [caseId, actorUserId, assigneeId, action, level],
    );
    await client.query("commit");
    return { version: updated.rows[0].version, escalationLevel: level, action };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export function verifyTelemetrySignature267(body, signature, key) {
  if (!key || key.length < 32 || typeof body !== "string") return false;
  if (!/^[a-f0-9]{64}$/u.test(signature ?? "")) return false;
  const expected = createHmac("sha256", key).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function normalizeTelemetry267(x, now = Date.now()) {
  if (!UUID.test(x?.campgroundId) || !/^[a-z0-9_-]{8,64}$/u.test(x?.sourceId ?? "") ||
      !/^[a-zA-Z0-9_-]{16,96}$/u.test(x?.nonce ?? "")) throw Error("Invalid telemetry source scope");
  const when = new Date(x?.observedAt);
  if (Number.isNaN(when.valueOf()) || Math.abs(now - when.valueOf()) > 60000)
    throw Error("Telemetry freshness outside signed window");
  const values = [x.requests, x.errors, x.latencyP95Ms];
  if (!values.every((v) => Number.isSafeInteger(v) && v >= 0) ||
      x.requests > 10000000 || x.errors > x.requests || x.latencyP95Ms > 600000)
    throw Error("Invalid original telemetry counters");
  return { campgroundId: x.campgroundId, sourceId: x.sourceId, nonce: x.nonce,
    observedAt: when.toISOString(), requests: x.requests, errors: x.errors,
    latencyP95Ms: x.latencyP95Ms };
}
export async function receiveTelemetry267(body, signature) {
  const secret = process.env.ICAMP_TELEMETRY267_HMAC_SECRET;
  if (!verifyTelemetrySignature267(body, signature, secret)) throw Error("UNAUTHENTICATED_TELEMETRY");
  if (!(await originalSchema267())) throw Error("HOLD_ORIGINAL_0242");
  const sample = normalizeTelemetry267(JSON.parse(body));
  const result = await db().query(
    "insert into icamp_private.telemetry_samples267 " +
      "(campground_id,source_id,nonce,observed_at,requests,errors,latency_p95_ms) " +
      "values($1,$2,$3,$4,$5,$6,$7) on conflict(campground_id,source_id,nonce) do nothing returning id",
    [sample.campgroundId,sample.sourceId,sample.nonce,sample.observedAt,
      sample.requests,sample.errors,sample.latencyP95Ms],
  );
  if (result.rowCount !== 1) throw Error("REPLAYED_TELEMETRY");
  return { accepted: true };
}
export async function listTelemetryAggregate267() {
  if (!(await originalSchema267())) return { status: "HOLD_ORIGINAL_0242", metrics: null };
  const r = await db().query(
    "select count(*)::integer samples,coalesce(sum(requests),0)::bigint::text requests," +
      "coalesce(sum(errors),0)::bigint::text errors," +
      "max(received_at) latest_received_at " +
      "from icamp_private.telemetry_samples267 where received_at > now()-interval '1 hour'",
  );
  const x = r.rows[0];
  return { status: x.samples ? "ORIGINAL_SIGNED_TELEMETRY_OBSERVED" : "NO_ORIGINAL_SAMPLES",
    metrics: x.samples ? { samples: x.samples, requests: x.requests, errors: x.errors,
      lastReceivedAt: x.latest_received_at.toISOString() } : null };
}

export async function setTelemetryEnrollment267({ userId, campgroundId, sourceId, enabled }) {
  if (!UUID.test(userId) || !UUID.test(campgroundId) ||
      !/^[a-z0-9_-]{8,64}$/u.test(sourceId ?? "") || typeof enabled !== "boolean")
    throw Error("Invalid tenant enrollment request");
  const { hasCampgroundPermission } = await import("../authz/postgres.mjs");
  if (!(await hasCampgroundPermission(userId, campgroundId, "campground.operations.manage")))
    throw Error("Only authorized campground management may enroll telemetry");
  if (!(await originalSchema267())) throw Error("HOLD_ORIGINAL_0242");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const exists = await client.query(
      "select id from public.campgrounds where id=$1 and lifecycle_state='active' for share",
      [campgroundId],
    );
    if (exists.rowCount !== 1) throw Error("Active source campground required");
    const r = await client.query(
      "insert into icamp_private.telemetry_enrollment267 " +
        "(campground_id,approved_by_user_id,state,source_id) values($1,$2,$3,$4) " +
        "on conflict(campground_id) do update set approved_by_user_id=$2," +
        "approved_at=statement_timestamp(),state=$3,source_id=$4," +
        "version=icamp_private.telemetry_enrollment267.version+1 returning version",
      [campgroundId,userId,enabled ? "active" : "revoked",sourceId],
    );
    await client.query("commit");
    return { state: enabled ? "active" : "revoked", version: r.rows[0].version };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function readTelemetryEnrollment267({ userId, campgroundId }) {
  const { hasCampgroundPermission } = await import("../authz/postgres.mjs");
  if (!UUID.test(userId) || !UUID.test(campgroundId) ||
      !(await hasCampgroundPermission(userId,campgroundId,"campground.operations.manage")))
    throw Error("Campground authorization required");
  if (!(await originalSchema267())) return {status:"HOLD_ORIGINAL_0242",enrollment:null};
  const r = await db().query(
    "select source_id,state,approved_at,version from icamp_private.telemetry_enrollment267 where campground_id=$1",
    [campgroundId],
  );
  return {status:"ORIGINAL_ENROLLMENT_OBSERVED",
    enrollment:r.rows[0] ? {
      sourceId:r.rows[0].source_id,state:r.rows[0].state,version:r.rows[0].version,
      approvedAt:r.rows[0].approved_at.toISOString(),
    }:null};
}
