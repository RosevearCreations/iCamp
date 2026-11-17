import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { validatedApproval260 } from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL required to record owner close approval.");
    pool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function closeOwnerFinance260PoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function recordOwnerFinanceApproval260({
  actorUserId,
  campgroundId,
  report,
  source,
  reason,
  decision,
}) {
  const approved = validatedApproval260(decision, reason, report);
  const grant = await getCampgroundAuthorization(actorUserId, campgroundId);
  if (
    !grant ||
    !grant.permissions.includes("finance.manage") ||
    !grant.permissions.includes("staff.manage") ||
    !grant.permissions.some((key) =>
      ["reservation.read", "reservation.modify"].includes(key),
    )
  )
    throw new Error(
      "Current campground finance, staff and reservation privileges are required.",
    );
  if (
    source.campgroundId !== campgroundId ||
    grant.organizationId !== source.organizationId ||
    !report.settlement ||
    !report.settlementDigest
  )
    throw new Error(
      "Original campground, owner scope or settlement proof changed.",
    );
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("set local statement_timeout = '10000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const inserted = await client.query(
      "insert into public.icamp_finance_close260 " +
        "(organization_id,campground_id,local_day,source_digest_sha256," +
        "settlement_digest_sha256,tax_digest_sha256,accounting_digest_sha256," +
        "package_digest_sha256,signer_key_id,statement_id,reason,approved_by_user_id) " +
        "values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",
      [
        source.organizationId,
        campgroundId,
        source.localDate,
        report.sourceDigest,
        report.settlementDigest,
        report.taxDigest,
        report.accountingDigest,
        approved.closePackageDigest,
        report.settlement.signerKeyId,
        report.settlement.statementId,
        approved.note,
        actorUserId,
      ],
    );
    if (inserted.rowCount !== 1)
      throw new Error("Owner close review was not recorded.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: source.organizationId,
      campgroundId,
      actionKey: "finance.close260.owner_review",
      permissionKey: "finance.manage",
      riskLevel: "high",
      reason: approved.note,
      subjectType: "finance.close_review",
      subjectId: inserted.rows[0].id,
      afterState: {
        disposition: "owner_approved_evidence_packet_nonposting",
        localDay: source.localDate,
        packageDigest: approved.closePackageDigest,
        monetaryEffect: false,
      },
      metadata: {
        build: 260,
        independentlySignedProviderPacket: true,
        bankClearingConfirmed: false,
        hstCertified: false,
        postedAccountingClose: false,
      },
    });
    await client.query("commit");
    return {
      id: inserted.rows[0].id,
      disposition: "owner_approved_evidence_packet_nonposting",
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
