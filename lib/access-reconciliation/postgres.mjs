import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import {
  getCampgroundAuthorization,
  hasCampgroundPermission,
} from "../authz/postgres.mjs";
import {
  evaluateCredentialAdmission,
  normalizeReconciliationReview,
  reconciliationId,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for access reconciliation.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeAccessReconciliationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function beginRls(client, actorUserId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [
    actorUserId,
  ]);
}

async function assertRead(actorUserId, campgroundId) {
  const auth = await getCampgroundAuthorization(actorUserId, campgroundId);
  if (
    !auth ||
    !auth.permissions.some((p) =>
      ["access.credential.issue", "access.credential.revoke"].includes(p),
    )
  ) {
    throw new Error("Credential reconciliation permission is required.");
  }
}

function mapRow(row, now) {
  const item = {
    id: row.id,
    credentialNumber: row.credential_number,
    credentialType: row.credential_type,
    subjectKind: row.subject_kind,
    subjectLabel: row.subject_label,
    displayHint: row.display_hint,
    status: row.status,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    sourceKind: row.source_kind ?? "unlinked",
    sourceNumber: row.source_number,
    sourceStatus: row.source_status ?? "not_applicable",
    sourceValidFrom: row.source_valid_from,
    sourceValidUntil: row.source_valid_until,
    assignmentStatus: row.assignment_status,
    duplicateCount: Number(row.duplicate_count ?? 0),
    rowVersion: Number(row.row_version),
    totalCount: Number(row.total_count ?? 0),
  };
  return { ...item, verdict: evaluateCredentialAdmission(item, now) };
}

const LIST_SQL = `select c.id,c.credential_number,c.credential_type,c.subject_kind,
 c.subject_label,c.display_hint,c.status,c.valid_from,c.valid_until,c.row_version,
 s.source_kind,s.source_number,s.source_status,s.source_valid_from,s.source_valid_until,
 s.assignment_status,
 count(*) filter(where c.status='active' and c.valid_from <= statement_timestamp()
   and (c.valid_until is null or c.valid_until>statement_timestamp()))
   over(partition by c.subject_kind,c.subject_reference_id) duplicate_count,
 count(*) over() total_count
 from public.access_credentials c
 left join icamp_private.access_reconciliation_sources($1::uuid) s on s.credential_id=c.id
 where c.campground_id=$1
 order by case c.status when 'active' then 0 else 1 end,
 c.valid_until asc nulls last,c.created_at desc,c.id
 limit 150`;

export async function listAccessReconciliation({
  actorUserId,
  campgroundId,
  now = new Date(),
}) {
  await assertRead(actorUserId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const credentials = await client.query(LIST_SQL, [campgroundId]);
    const reviews = await client.query(
      `select credential_id,disposition,reason,credential_status_snapshot,
         source_status_snapshot,observed_verdict,observed_at
        from icamp_private.access_reconciliation_reviews where campground_id=$1
        order by observed_at desc limit 40`,
      [campgroundId],
    );
    await client.query("commit");
    const items = credentials.rows.map((row) => mapRow(row, now));
    return {
      items,
      total: items[0]?.totalCount ?? 0,
      scannedAt: new Date(now).toISOString(),
      needsAttention: items.filter((item) => !item.verdict.allowed).length,
      reviews: reviews.rows.map((row) => ({
        credentialId: row.credential_id,
        disposition: row.disposition,
        reason: row.reason,
        status: row.credential_status_snapshot,
        sourceStatus: row.source_status_snapshot,
        verdict: row.observed_verdict,
        observedAt: new Date(row.observed_at).toISOString(),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAccessReconciliationReview({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  credentialId,
  input,
}) {
  const id = reconciliationId(credentialId);
  const review = normalizeReconciliationReview(input);
  await assertRead(actorUserId, campgroundId);
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campgroundId,
      "access.reconciliation.review",
    ))
  ) {
    throw new Error(
      "Independent access reconciliation review permission is required.",
    );
  }
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const current = await client.query(
      `select * from public.access_credentials where campground_id=$1 and id=$2 for update`,
      [campgroundId, id],
    );
    const credential = current.rows[0];
    if (!credential)
      throw new Error("Credential unavailable in the authorized campground.");
    if (Number(credential.row_version) !== review.rowVersion) {
      throw new Error(
        "Credential changed. Refresh before recording the review.",
      );
    }
    const context = await client.query(
      `select * from icamp_private.access_reconciliation_sources($1::uuid)
       where credential_id=$2`,
      [campgroundId, id],
    );
    const source = context.rows[0];
    const duplicates = await client.query(
      `select count(*)::integer as count from public.access_credentials
       where campground_id=$1 and subject_kind=$2 and subject_reference_id=$3
         and status='active' and valid_from<=statement_timestamp()
         and (valid_until is null or valid_until>statement_timestamp())`,
      [campgroundId, credential.subject_kind, credential.subject_reference_id],
    );
    const verdict = evaluateCredentialAdmission({
      status: credential.status,
      validFrom: credential.valid_from,
      validUntil: credential.valid_until,
      sourceKind: source?.source_kind ?? "unlinked",
      sourceStatus: source?.source_status,
      sourceValidFrom: source?.source_valid_from,
      sourceValidUntil: source?.source_valid_until,
      assignmentStatus: source?.assignment_status,
      duplicateCount: Number(duplicates.rows[0]?.count ?? 0),
    });
    await client.query(
      `insert into icamp_private.access_reconciliation_reviews
       (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,
        credential_status_snapshot,source_status_snapshot,observed_verdict,credential_version_snapshot)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        credential.organization_id,
        campgroundId,
        id,
        actorUserId,
        review.disposition,
        review.reason,
        credential.status,
        source?.source_status ?? "not_applicable",
        verdict.reason,
        credential.row_version,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: credential.organization_id,
      campgroundId,
      actionKey: "access.reconciliation.review",
      permissionKey: "access.reconciliation.review",
      riskLevel: "elevated",
      reason: review.reason,
      subjectType: "access_credential",
      subjectId: id,
      metadata: {
        disposition: review.disposition,
        verdict: verdict.reason,
        physicalGateExecution: "HELD",
      },
    });
    await client.query("commit");
    return { verdict, disposition: review.disposition };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
