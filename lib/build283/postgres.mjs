import { originalPool270 } from "../build270/postgres.mjs";
import {
  acceptanceSummary281,
  historicalRestoreAck282,
  originalAdmission281,
} from "../build281/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import { verifyAlertDelivery282 } from "../build282/core.mjs";
import { submitProviderAlert282 } from "../build282/transport.mjs";
import { closureEligible283, escalationDecision283 } from "./core.mjs";

async function ready283() {
  const admission = await originalAdmission281();
  if (!admission.adopted || !admission.host?.pinned) return false;
  const q = await originalPool270().query(
    "select (select count(*) from icamp_meta.schema_migrations where version in ('0256','0257'))=2 and to_regclass('icamp_private.monitor_run283') is not null and to_regclass('icamp_private.escalation_attempt283') is not null and to_regclass('icamp_private.escalation_outcome283') is not null and to_regclass('icamp_private.recovery_closure283') is not null as ready",
  );
  return q.rows[0]?.ready === true;
}

async function context283(row) {
  const history = await historicalRestoreAck282(row.ack_id);
  return {
    incident: {
      id: row.id,
      ackDigest: history.digest,
      openedAt: row.opened_at,
    },
    key: history.providerKey,
    reason: row.reason,
  };
}

async function claim283(row, runId) {
  const client = await originalPool270().connect();
  try {
    await client.query("begin");
    const q = await client.query(
      "select id from icamp_private.recovery_incident282 where id=$1 for update skip locked",
      [row.id],
    );
    if (q.rowCount !== 1) return null;
    const status = await client.query(
      "select exists(select 1 from icamp_private.provider_alert_delivery282 where incident_id=$1) as delivered, exists(select 1 from icamp_private.recovery_closure283 where incident_id=$1) as closed, (select count(*)::int from icamp_private.escalation_attempt283 where incident_id=$1) as attempts, (select max(claimed_at) from icamp_private.escalation_attempt283 where incident_id=$1) as last",
      [row.id],
    );
    const s = status.rows[0];
    if (
      escalationDecision283({
        deliveryExists: s.delivered,
        closed: s.closed,
        attempts: s.attempts,
        lastAttemptAt: s.last ? new Date(s.last).getTime() : NaN,
        now: Date.now(),
      }) !== "ELIGIBLE"
    )
      return null;
    const saved = await client.query(
      "insert into icamp_private.escalation_attempt283(incident_id,run_id) values($1,$2) returning id",
      [row.id, runId],
    );
    await client.query("commit");
    return saved.rows[0].id;
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

export async function runMonitor283() {
  if (!(await ready283())) return { status: "ORIGINAL_SCHEMA_HOLD" };
  const pool = originalPool270();
  const summary = await acceptanceSummary281();
  const evidence = summary.monitoring.independentReviewLive
    ? "CURRENT"
    : summary.status === "HOLD_ORIGINAL_PROVIDER_MFA_MONITOR_READBACK"
      ? "READBACK_HOLD"
      : "HOLD";
  const run = await pool.query(
    "insert into icamp_private.monitor_run283(evidence_status) values($1) returning id",
    [evidence],
  );
  if (
    process.env.ICAMP282_ALERT_ENABLED !== "true" ||
    process.env.ICAMP283_AUTO_ESCALATION !== "true"
  )
    return { status: "MONITORED_TRANSPORT_DISABLED" };
  const pending = await pool.query(
    "select i.id,i.ack_id,i.reason,i.opened_at from icamp_private.recovery_incident282 i where not exists(select 1 from icamp_private.provider_alert_delivery282 d where d.incident_id=i.id) and not exists(select 1 from icamp_private.recovery_closure283 c where c.incident_id=i.id) and (select count(*) from icamp_private.escalation_attempt283 a where a.incident_id=i.id)<3 and not exists(select 1 from icamp_private.escalation_attempt283 a where a.incident_id=i.id and a.claimed_at>statement_timestamp()-interval '1 hour') order by i.opened_at limit 3",
  );
  for (const row of pending.rows) {
    let context;
    try {
      context = await context283(row);
    } catch {
      continue;
    }
    if (context.key.providerId !== process.env.ICAMP282_ALERT_PROVIDER_ID)
      continue;
    const attempt = await claim283(row, run.rows[0].id);
    if (!attempt) continue;
    let status = "SUBMISSION_HOLD";
    try {
      await submitProviderAlert282(context);
      status = "SUBMITTED_DELIVERY_UNVERIFIED";
    } catch {}
    await pool.query(
      "insert into icamp_private.escalation_outcome283(attempt_id,status) values($1,$2)",
      [attempt, status],
    );
  }
  return { status: "MONITORED_DELIVERY_REMAINS_INDEPENDENT" };
}

export async function closeRecovery283({ actorId, id }) {
  if (
    !UUID276.test(actorId) ||
    !UUID276.test(id) ||
    !(await ready283()) ||
    !(await getPlatformOverview(actorId, "aal2"))
  )
    throw Error("ORIGINAL_REVIEW_HOLD");
  const pool = originalPool270();
  const q = await pool.query(
    "select i.id,i.ack_id,i.reason,i.opened_at,d.signed_body,d.signature_b64url,d.recorded_at from icamp_private.recovery_incident282 i join icamp_private.provider_alert_delivery282 d on d.incident_id=i.id where i.id=$1",
    [id],
  );
  if (q.rowCount !== 1) throw Error("DELIVERY_HOLD");
  const row = q.rows[0];
  const context = await context283(row);
  verifyAlertDelivery282({
    ...context,
    body: row.signed_body,
    signature: row.signature_b64url,
    now: new Date(row.recorded_at).getTime(),
  });
  const live = await acceptanceSummary281();
  if (!live.monitoring.independentReviewLive || !live.signedAck)
    throw Error("CURRENT_RECOVERY_HOLD");
  const old = await historicalRestoreAck282(row.ack_id);
  const fresh = await historicalRestoreAck282(live.signedAck.id);
  const evidence = await pool.query(
    "select id,recorded_at,signed_body from icamp_private.external_restore_final_ack281 where id=any($1::uuid[])",
    [[old.id, fresh.id]],
  );
  const priorRow = evidence.rows.find((x) => x.id === old.id);
  const freshRow = evidence.rows.find((x) => x.id === fresh.id);
  if (
    !priorRow ||
    !freshRow ||
    !closureEligible283({
      delivery: true,
      current: {
        id: fresh.id,
        verified: true,
        providerId: fresh.providerKey.providerId,
        fingerprint: fresh.providerKey.fingerprint,
        sourceHost: JSON.parse(freshRow.signed_body).sourceHostSha256,
        recordedAt: new Date(freshRow.recorded_at).getTime(),
      },
      previous: {
        id: old.id,
        providerId: old.providerKey.providerId,
        fingerprint: old.providerKey.fingerprint,
        sourceHost: JSON.parse(priorRow.signed_body).sourceHostSha256,
      },
      openedAt: new Date(row.opened_at).getTime(),
    })
  )
    throw Error("RECOVERY_CHAIN_HOLD");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorId,
    ]);
    const saved = await client.query(
      "insert into icamp_private.recovery_closure283(incident_id,recovery_ack_id,reviewed_by) values($1,$2,$3) on conflict do nothing returning incident_id",
      [id, fresh.id, actorId],
    );
    if (saved.rowCount !== 1) throw Error("ALREADY_REVIEWED");
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function summary283() {
  const empty = { ready: false, latest: null, incidents: [] };
  try {
    if (!(await ready283())) return empty;
    const pool = originalPool270();
    const [runs, rows] = await Promise.all([
      pool.query(
        "select sampled_at,evidence_status from icamp_private.monitor_run283 order by sampled_at desc limit 1",
      ),
      pool.query(
        "select i.id,i.reason,exists(select 1 from icamp_private.provider_alert_delivery282 d where d.incident_id=i.id) as receipt_present,exists(select 1 from icamp_private.recovery_closure283 c where c.incident_id=i.id) as closure_recorded,(select count(*)::int from icamp_private.escalation_attempt283 a where a.incident_id=i.id) as attempts from icamp_private.recovery_incident282 i order by i.opened_at desc limit 50",
      ),
    ]);
    return {
      ready: true,
      latest: runs.rows[0] ?? null,
      incidents: rows.rows,
    };
  } catch {
    return empty;
  }
}
