import { originalPool270 } from "../build270/postgres.mjs";
import {
  historicalRestoreAck282,
  originalAdmission281,
} from "../build281/postgres.mjs";
import { submitProviderAlert282 } from "../build282/transport.mjs";
import { runMonitor283 } from "../build283/postgres.mjs";
import { discoveries284, relayEnvironment284 } from "./core.mjs";

async function ready284() {
  const admission = await originalAdmission281();
  if (!admission.adopted || !admission.host?.pinned) return false;
  const q = await originalPool270().query(
    "select (select count(*) from icamp_meta.schema_migrations where version in ('0256','0257','0258'))=3 and to_regclass('icamp_private.scheduler_sample284') is not null and to_regclass('icamp_private.recovery_discovery284') is not null and to_regclass('icamp_private.relay_attempt284') is not null as ready",
  );
  return q.rows[0]?.ready === true;
}

export async function runScheduler284() {
  if (!(await ready284())) return { status: "ORIGINAL_SCHEMA_HOLD" };
  const pool = originalPool270();
  const client = await pool.connect();
  try {
    const lock = await client.query(
      "select pg_try_advisory_lock(284,1) as acquired",
    );
    if (!lock.rows[0]?.acquired) return { status: "MONITOR_BUSY" };
    return await runMonitor283({
      observe: async ({ pool, summary, runId }) => {
        await pool.query(
          "insert into icamp_private.scheduler_sample284(run_id) values($1)",
          [runId],
        );
        const rows = await pool.query(
          "select id from icamp_private.external_restore_final_ack281 order by recorded_at desc limit 1",
        );
        if (!rows.rowCount) return;
        let ack;
        try {
          ack = await historicalRestoreAck282(rows.rows[0].id);
        } catch {
          return;
        }
        for (const reason of discoveries284(summary, ack.id)) {
          await pool.query(
            "insert into icamp_private.recovery_discovery284(run_id,ack_id,reason) values($1,$2,$3) on conflict(ack_id,reason) do nothing",
            [runId, ack.id, reason],
          );
        }
      },
      submit: async (context, attempt) => {
        const config = relayEnvironment284(process.env, attempt.priorAttempts);
        await pool.query(
          "insert into icamp_private.relay_attempt284(attempt_id,channel) values($1,$2)",
          [attempt.id, config.channel],
        );
        return submitProviderAlert282(context, config.env);
      },
    });
  } finally {
    try {
      await client.query("select pg_advisory_unlock(284,1)");
      client.release();
    } catch {
      client.release(true);
    }
  }
}

export async function summary284() {
  const empty = { ready: false, latest: null, discoveries: [] };
  try {
    if (!(await ready284())) return empty;
    const pool = originalPool270();
    const [latest, discoveries] = await Promise.all([
      pool.query(
        "select s.sampled_at,m.evidence_status,m.delivery_checked,m.delivery_verified from icamp_private.scheduler_sample284 s join icamp_private.monitor_run283 m on m.id=s.run_id order by s.sampled_at desc limit 1",
      ),
      pool.query(
        "select d.id,d.ack_id,d.reason,exists(select 1 from icamp_private.recovery_incident282 i where i.ack_id=d.ack_id and i.reason=d.reason) as opened from icamp_private.recovery_discovery284 d order by d.discovered_at desc limit 50",
      ),
    ]);
    return {
      ready: true,
      latest: latest.rows[0] ?? null,
      discoveries: discoveries.rows,
    };
  } catch {
    return empty;
  }
}
