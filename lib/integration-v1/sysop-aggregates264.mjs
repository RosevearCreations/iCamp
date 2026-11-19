import pg from "pg";

/**
 * Optional aggregate-only metrics for the already-authenticated v1 signed
 * Sysop producer. Never query or return tenant IDs, guest identities,
 * reservations, payments, message content, IP addresses, or raw logs.
 * Unavailable data stays null, never a fabricated zero.
 */
export async function sampleSysopAggregates264(env = process.env) {
  if (
    env.VERCEL_ENV !== "production" ||
    env.ROSEVEAR_SYSOP_TELEMETRY_ENABLE_DB_AGGREGATES !== "true"
  )
    return null;
  let host = "";
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
  const expected = String(env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase();
  if (!host || host !== expected || expected.length < 5) return null;
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2500,
    idleTimeoutMillis: 1500,
  });
  let client = null;
  try {
    client = await pool.connect();
    await client.query(
      "begin transaction isolation level repeatable read read only",
    );
    await client.query("set local statement_timeout='2500ms'");
    const queues = await client.query(
      "select " +
        "count(*) filter (where state='queued')::int as queue_depth, " +
        "count(*) filter (where state='succeeded' and " +
        "completed_at>=statement_timestamp()-interval '60 seconds')::int as jobs_completed, " +
        "count(*) filter (where state='dead_letter' and " +
        "dead_lettered_at>=statement_timestamp()-interval '60 seconds')::int as jobs_failed " +
        "from icamp_private.job_queue",
    );
    const sessions = await client.query(
      "select count(*)::int as active_sessions " +
        "from icamp_private.auth_sessions " +
        "where revoked_at is null and expires_at>statement_timestamp()",
    );
    await client.query("commit");
    const q = queues.rows[0],
      s = sessions.rows[0];
    if (!q || !s) return null;
    const values = [
      q.queue_depth,
      q.jobs_completed,
      q.jobs_failed,
      s.active_sessions,
    ];
    if (
      !values.every(
        (value) =>
          Number.isSafeInteger(value) && value >= 0 && value < 2147483647,
      )
    )
      return null;
    return {
      queueDepth: q.queue_depth,
      jobsCompleted: q.jobs_completed,
      jobsFailed: q.jobs_failed,
      activeSessions: s.active_sessions,
      metricsWindowSeconds: 60,
      hasIndependentOriginalHostBootProof: false,
    };
  } catch {
    if (client) await client.query("rollback").catch(() => undefined);
    return null;
  } finally {
    client?.release();
    await pool.end().catch(() => undefined);
  }
}
