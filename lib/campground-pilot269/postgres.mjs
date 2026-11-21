import pg from "pg";
import {
  normalizeStage269,
  normalizeSlaReceipt269,
  verifySignedRaw269,
  trafficFreshness269,
  restoreWitnessStatus269,
} from "./core.mjs";
import { inspectOriginalRuntime268 } from "../campground-support268/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DIGEST = /^[a-f0-9]{64}$/u;
let pool;
function db() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw Error("HOLD_NO_ORIGINAL_DATABASE_URL");
  if (!pool)
    pool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10000,
    });
  return pool;
}
export async function originalPilotReady269() {
  const base = await inspectOriginalRuntime268();
  if (!base.runtimeTargetPinMatches || !base.migration0243) return false;
  try {
    const r = await db().query(
      "select to_regclass('icamp_private.traffic_stage269') is not null as traffic," +
        "to_regclass('icamp_private.support_delivery_receipts269') is not null as delivery," +
        "to_regclass('icamp_private.pilot_booking_witness269') is not null as booking," +
        "to_regclass('icamp_private.pilot_restore_witness269') is not null as restore," +
        "exists(select 1 from icamp_meta.schema_migrations where version='0244') as migration",
    );
    return Object.values(r.rows[0] ?? {}).every((x) => x === true);
  } catch {
    return false;
  }
}
export async function acceptTraffic269(body, signature) {
  if (
    !verifySignedRaw269(
      body,
      signature,
      process.env.ICAMP_TELEMETRY269_HMAC_SECRET,
    )
  )
    throw Error("UNVERIFIED_SIGNED_TRAFFIC");
  const sample = normalizeStage269(JSON.parse(body));
  if (!(await originalPilotReady269()))
    throw Error("HOLD_ORIGINAL_DATABASE_MIGRATION");
  const x = await db().query(
    "insert into icamp_private.traffic_stage269 " +
      "(campground_id,source_id,nonce,stage,observed_at,requests,errors,latency_p95_ms) " +
      "values($1,$2,$3,$4,$5,$6,$7,$8) " +
      "on conflict(campground_id,source_id,nonce) do nothing returning id",
    [
      sample.campgroundId,
      sample.sourceId,
      sample.nonce,
      sample.stage,
      sample.observedAt,
      sample.requests,
      sample.errors,
      sample.latencyP95Ms,
    ],
  );
  if (x.rowCount !== 1) throw Error("REPLAYED_TRAFFIC");
  return { accepted: true };
}
export async function acceptSlaDelivery269(body, signature) {
  if (
    !verifySignedRaw269(
      body,
      signature,
      process.env.ICAMP_SLA269_ACK_HMAC_SECRET,
    )
  )
    throw Error("UNVERIFIED_COMMS_SOURCE_SIGNATURE");
  const e = normalizeSlaReceipt269(JSON.parse(body));
  if (
    !process.env.ICAMP_SLA269_ACK_SOURCE_ID ||
    e.sourceId !== process.env.ICAMP_SLA269_ACK_SOURCE_ID
  )
    throw Error("UNENROLLED_COMMS_SOURCE");
  if (!(await originalPilotReady269()))
    throw Error("HOLD_ORIGINAL_DATABASE_MIGRATION");
  const client = await db().connect();
  try {
    await client.query("begin");
    const old = await client.query(
      "select outbox_id,nonce,event_kind from icamp_private.support_delivery_receipts269 " +
        "where source_id=$1 and provider_event_id=$2",
      [e.sourceId, e.providerEventId],
    );
    if (old.rowCount) {
      const same = old.rows[0];
      if (
        same.outbox_id !== e.outboxId ||
        same.nonce !== e.nonce ||
        same.event_kind !== e.eventKind
      )
        throw Error("PROVIDER_EVENT_COLLISION");
      await client.query("commit");
      return { accepted: true, duplicate: true };
    }
    const queue = await client.query(
      "select delivery_state from icamp_private.support_sla_outbox268 " +
        "where id=$1 for update",
      [e.outboxId],
    );
    if (
      queue.rowCount !== 1 ||
      !["queued", "attempted"].includes(queue.rows[0].delivery_state)
    )
      throw Error("Original queued notice required");
    await client.query(
      "insert into icamp_private.support_delivery_receipts269 " +
        "(outbox_id,source_id,provider_event_id,event_kind,nonce,observed_at) " +
        "values($1,$2,$3,$4,$5,$6)",
      [
        e.outboxId,
        e.sourceId,
        e.providerEventId,
        e.eventKind,
        e.nonce,
        e.observedAt,
      ],
    );
    await client.query(
      "update icamp_private.support_sla_outbox268 " +
        "set delivery_state=$1, attempted_at=coalesce(attempted_at,statement_timestamp())," +
        "acknowledged_at=$2,delivery_reference=$3 where id=$4",
      [
        e.eventKind === "delivered" ? "acknowledged" : "blocked",
        e.eventKind === "delivered" ? e.observedAt : null,
        e.providerEventId,
        e.outboxId,
      ],
    );
    await client.query("commit");
    return { accepted: true, duplicate: false };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
export async function listTenantTraffic269() {
  if (!(await originalPilotReady269()))
    return { status: "HOLD_ORIGINAL_0244_OR_HOST_PIN", tenants: [] };
  try {
    const r = await db().query(
      "select e.campground_id,c.name,c.lifecycle_state,e.state as enrollment_state," +
        " max(t.received_at) as latest," +
        " count(t.id) filter(where t.received_at>now()-interval '15 minutes')::integer as samples," +
        " coalesce(sum(t.requests) filter(where t.stage='guest_search' and " +
        "t.received_at>now()-interval '15 minutes'),0)::bigint::text as guest_search," +
        " coalesce(sum(t.requests) filter(where t.stage='guest_checkout' and " +
        "t.received_at>now()-interval '15 minutes'),0)::bigint::text as guest_checkout," +
        " coalesce(sum(t.errors) filter(where t.received_at>now()-interval '15 minutes'),0)::bigint::text as errors," +
        " count(t.id) filter(where t.stage='health_probe' and " +
        "t.received_at>now()-interval '15 minutes')::integer as probes " +
        "from icamp_private.telemetry_enrollment267 e " +
        "join public.campgrounds c on c.id=e.campground_id " +
        "left join icamp_private.traffic_stage269 t on t.campground_id=e.campground_id " +
        "and t.source_id=e.source_id " +
        "group by e.campground_id,c.name,c.lifecycle_state,e.state " +
        "order by c.name limit 100",
    );
    return {
      status: r.rowCount
        ? "ORIGINAL_SIGNED_STAGE_TELEMETRY"
        : "NO_ENROLLED_SOURCES",
      tenants: r.rows.map((x) => ({
        campgroundId: x.campground_id,
        name: x.name,
        campgroundState: x.lifecycle_state,
        enrollmentState: x.enrollment_state,
        freshness: trafficFreshness269({
          campgroundState: x.lifecycle_state,
          enrollmentState: x.enrollment_state,
          lastReceivedAt: x.latest,
        }),
        lastReceivedAt: x.latest?.toISOString() ?? null,
        samples: x.samples,
        guestSearch: x.guest_search,
        guestCheckout: x.guest_checkout,
        errors: x.errors,
        probes: x.probes,
      })),
    };
  } catch {
    return { status: "HOLD_TRAFFIC_QUERY_FAILED", tenants: [] };
  }
}
export async function listPilotCustody269() {
  if (!(await originalPilotReady269()))
    return {
      status: "HOLD_ORIGINAL_0244",
      signedDeliveryReceipts: null,
      pilotBookingWitnesses: null,
      restoreStatus: "HOLD_UNVERIFIED",
    };
  try {
    const [delivery, book, restore] = await Promise.all([
      db().query(
        "select count(*)::integer as n from icamp_private.support_delivery_receipts269 where event_kind='delivered'",
      ),
      db().query(
        "select count(*)::integer as n from icamp_private.pilot_booking_witness269",
      ),
      db().query(
        "select witness_kind,original_backup_digest_sha256,actor_user_id from icamp_private.pilot_restore_witness269",
      ),
    ]);
    return {
      status: "ORIGINAL_PILOT_LEDGER_PRESENT",
      signedDeliveryReceipts: delivery.rows[0].n,
      pilotBookingWitnesses: book.rows[0].n,
      restoreStatus: restoreWitnessStatus269(
        restore.rows.map((r) => ({
          kind: r.witness_kind,
          digest: r.original_backup_digest_sha256,
          actorId: r.actor_user_id,
        })),
      ),
    };
  } catch {
    return {
      status: "HOLD_SOURCE_QUERY_FAILED",
      signedDeliveryReceipts: null,
      pilotBookingWitnesses: null,
      restoreStatus: "HOLD_UNVERIFIED",
    };
  }
}
export async function recordBookingWitness269({
  userId,
  campgroundId,
  recoveryId,
  stage,
  evidenceDigestSha256,
}) {
  if (
    ![userId, campgroundId, recoveryId].every((x) => UUID.test(x)) ||
    ![
      "processor_settlement",
      "site_allocation",
      "confirmation_delivery",
      "guest_ack",
    ].includes(stage) ||
    !DIGEST.test(evidenceDigestSha256) ||
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "campground.operations.manage",
    ))
  )
    throw Error("Authorized tenant and digest required");
  if (!(await originalPilotReady269())) throw Error("HOLD_ORIGINAL_0244");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const x = await client.query(
      "insert into icamp_private.pilot_booking_witness269 " +
        "(recovery_id,campground_id,actor_user_id,stage,evidence_digest_sha256) " +
        "values($1,$2,$3,$4,$5) on conflict do nothing returning id",
      [recoveryId, campgroundId, userId, stage, evidenceDigestSha256],
    );
    await client.query("commit");
    return { stored: x.rowCount === 1, independentlyAccepted: false };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
export async function recordRestoreWitness269({
  actorUserId,
  kind,
  backupDigestSha256,
  evidenceDigestSha256,
}) {
  if (
    !UUID.test(actorUserId) ||
    !["original_backup", "isolated_restore", "independent_review"].includes(
      kind,
    ) ||
    !DIGEST.test(backupDigestSha256) ||
    !DIGEST.test(evidenceDigestSha256)
  )
    throw Error("Valid original receipt digests and reviewer required");
  if (!(await originalPilotReady269())) throw Error("HOLD_ORIGINAL_0244");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const r = await client.query(
      "insert into icamp_private.pilot_restore_witness269 " +
        "(witness_kind,original_backup_digest_sha256,actor_user_id,evidence_digest_sha256) " +
        "values($1,$2,$3,$4) on conflict do nothing returning id",
      [kind, backupDigestSha256, actorUserId, evidenceDigestSha256],
    );
    await client.query("commit");
    return {
      stored: r.rowCount === 1,
      originalRestoreIndependentlyProven: false,
    };
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
