import { randomUUID } from "node:crypto";
import pg from "pg";

let pool;
function db() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error(
      "Integration v1 requires the iCamp server database connection.",
    );
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
  }));
}

export async function recordReadinessHandshake({
  issuer,
  keyId,
  nonce,
  tenantId,
  timestamp,
  path,
  allowed,
}) {
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("set local statement_timeout = '5000ms'");
    const inserted = await client.query(
      `insert into icamp_private.integration_handshake_receipts
       (id,issuer,target_system,key_id,nonce,campground_id,request_path,request_timestamp,outcome,reason_code)
       values($1,$2,'icamp',$3,$4,$5,$6,$7,$8,$9)
       on conflict(issuer,key_id,nonce) do nothing`,
      [
        randomUUID(),
        issuer,
        keyId,
        nonce,
        tenantId,
        path,
        timestamp,
        allowed ? "accepted" : "rejected",
        allowed ? "readiness_accepted" : "tenant_hold",
      ],
    );
    await client.query("commit");
    return inserted.rowCount === 1;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
