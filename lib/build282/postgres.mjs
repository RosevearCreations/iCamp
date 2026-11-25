import { originalPool270 } from "../build270/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import {
  acceptanceSummary281,
  historicalRestoreAck282,
  originalAdmission281,
} from "../build281/postgres.mjs";
import { recoveryReasons282, verifyAlertDelivery282 } from "./core.mjs";

async function ready282() {
  const admission = await originalAdmission281();
  if (!admission.adopted || !admission.host.pinned) return false;
  const q = await originalPool270().query(
    "select exists(select 1 from icamp_meta.schema_migrations where version='0256') as ready",
  );
  return q.rows[0]?.ready === true;
}

async function actor282(id, fn) {
  if (
    !UUID276.test(id) ||
    !(await ready282()) ||
    !(await getPlatformOverview(id, "aal2"))
  )
    throw Error("ORIGINAL_AAL2_OPERATOR_REQUIRED");
  const client = await originalPool270().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)", [id]);
    await fn(client);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function openRecovery282({ actorId, ackId, reason }) {
  await historicalRestoreAck282(ackId);
  const summary = await acceptanceSummary281();
  if (!recoveryReasons282(summary).includes(reason))
    throw Error("NO_CURRENT_RECOVERY_HOLD");
  await actor282(actorId, async (client) => {
    const q = await client.query(
      "insert into icamp_private.recovery_incident282(ack_id,reason,opened_by) values($1,$2,$3) on conflict do nothing returning id",
      [ackId, reason, actorId],
    );
    if (q.rowCount !== 1) throw Error("INCIDENT_ALREADY_RECORDED");
  });
}

async function incidentContext282(id) {
  if (!UUID276.test(id)) throw Error("INVALID_INCIDENT_ID");
  const q = await originalPool270().query(
    "select id,ack_id,opened_at from icamp_private.recovery_incident282 where id=$1",
    [id],
  );
  if (q.rowCount !== 1) throw Error("ORIGINAL_INCIDENT_MISSING");
  const row = q.rows[0];
  const history = await historicalRestoreAck282(row.ack_id);
  return {
    incident: {
      id: row.id,
      ackDigest: history.digest,
      openedAt: row.opened_at,
    },
    key: history.providerKey,
  };
}

export async function recordDelivery282({ actorId, id, body, signature }) {
  if (!(await ready282())) throw Error("ORIGINAL_SCHEMA_HOLD");
  const context = await incidentContext282(id);
  const receipt = verifyAlertDelivery282({
    ...context,
    body,
    signature,
    now: Date.now(),
  });
  await actor282(actorId, async (client) => {
    const q = await client.query(
      "insert into icamp_private.provider_alert_delivery282(incident_id,provider_id,event_id,signed_body,signature_b64url,reviewed_by) values($1,$2,$3,$4,$5,$6) on conflict do nothing returning id",
      [id, receipt.providerId, receipt.eventId, body, signature, actorId],
    );
    if (q.rowCount !== 1) throw Error("DELIVERY_REPLAY_OR_REVIEW_DENIED");
  });
}

export async function summary282() {
  const empty = { ready: false, reasons: [], history: [], incidents: [] };
  try {
    if (!(await ready282())) return empty;
    const summary = await acceptanceSummary281();
    const pool = originalPool270();
    const [acks, incidents] = await Promise.all([
      pool.query(
        "select id from icamp_private.external_restore_final_ack281 order by recorded_at desc limit 20",
      ),
      pool.query(
        "select i.id,i.reason,i.ack_id,d.signed_body,d.signature_b64url,d.recorded_at from icamp_private.recovery_incident282 i left join icamp_private.provider_alert_delivery282 d on d.incident_id=i.id order by i.opened_at desc limit 50",
      ),
    ]);
    const history = [];
    for (const row of acks.rows) {
      try {
        const item = await historicalRestoreAck282(row.id);
        history.push({ id: item.id, digest: item.digest });
      } catch {}
    }
    const reviewed = [];
    for (const row of incidents.rows) {
      let delivered = false;
      if (row.signed_body) {
        try {
          const context = await incidentContext282(row.id);
          verifyAlertDelivery282({
            ...context,
            body: row.signed_body,
            signature: row.signature_b64url,
            now: Date.parse(row.recorded_at),
          });
          delivered = true;
        } catch {}
      }
      reviewed.push({
        id: row.id,
        reason: row.reason,
        ackId: row.ack_id,
        delivered,
      });
    }
    return {
      ready: true,
      reasons: recoveryReasons282(summary),
      history,
      incidents: reviewed,
    };
  } catch {
    return empty;
  }
}
