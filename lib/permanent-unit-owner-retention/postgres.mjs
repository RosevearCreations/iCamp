import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeOwnerExportReconciliation,
  normalizeOwnerExportRetention,
} from "./core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for owner export retention.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function owner(actor, campgroundId) {
  const auth = await getCampgroundAuthorization(actor, campgroundId);
  if (
    !auth?.roleCodes?.includes("owner_admin") ||
    !auth.permissions?.includes("permanent_unit.transfer")
  )
    throw new Error(
      "Owner export reconciliation requires active Owner / Administrator finance permission on both properties.",
    );
}
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const value = await work(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getOwnerExportRetentionLedger(
  actorUserId,
  sourceCampgroundId,
  targetCampgroundId,
) {
  if (!sourceCampgroundId || !targetCampgroundId)
    return {
      receipts: [],
      reconciliations: [],
      events: [],
      receiptsLimited: false,
      historyLimited: false,
    };
  await Promise.all([
    owner(actorUserId, sourceCampgroundId),
    owner(actorUserId, targetCampgroundId),
  ]);
  return transaction(actorUserId, true, async (client) => {
    const originals = await client.query(
      `select id,source_campground_id,target_campground_id,export_sha256,export_row_count,
       search_status,search_query,evidence_reference,accepted_by_user_id,accepted_at
       from public.permanent_unit_finance_owner_evidence_export_acceptances
       where source_campground_id=$1 and target_campground_id=$2
       order by accepted_at desc,id desc limit 31`,
      [sourceCampgroundId, targetCampgroundId],
    );
    const receipts = originals.rows.slice(0, 30).map((r) => ({
      id: r.id,
      sourceCampgroundId: r.source_campground_id,
      targetCampgroundId: r.target_campground_id,
      exportSha256: r.export_sha256,
      exportRowCount: r.export_row_count,
      searchStatus: r.search_status,
      searchQuery: r.search_query,
      evidenceReference: r.evidence_reference,
      acceptedByUserId: r.accepted_by_user_id,
      acceptedAt: r.accepted_at.toISOString(),
    }));
    if (!receipts.length)
      return {
        receipts: [],
        reconciliations: [],
        events: [],
        receiptsLimited: false,
        historyLimited: false,
      };
    const ids = receipts.map((r) => r.id);
    const [reconciliations, events] = await Promise.all([
      client.query(
        `select id,export_acceptance_id,observed_sha256,observed_row_count,result,
          evidence_reference,reconciliation_note,reconciled_by_user_id,reconciled_at
         from public.permanent_unit_finance_owner_export_reconciliations
         where export_acceptance_id=any($1::uuid[])
         order by reconciled_at desc,id desc limit 301`,
        [ids],
      ),
      client.query(
        `select id,export_acceptance_id,event_kind,retention_due_at,
          evidence_reference,retention_note,recorded_by_user_id,recorded_at
         from public.permanent_unit_finance_owner_export_retention_events
         where export_acceptance_id=any($1::uuid[])
         order by recorded_at desc,id desc limit 301`,
        [ids],
      ),
    ]);
    return {
      receipts,
      receiptsLimited: originals.rows.length > 30,
      historyLimited:
        reconciliations.rows.length > 300 || events.rows.length > 300,
      reconciliations: reconciliations.rows.slice(0, 300).map((r) => ({
        id: r.id,
        exportAcceptanceId: r.export_acceptance_id,
        observedSha256: r.observed_sha256,
        observedCount: r.observed_row_count,
        result: r.result,
        evidenceReference: r.evidence_reference,
        reconciliationNote: r.reconciliation_note,
        reconciledByUserId: r.reconciled_by_user_id,
        reconciledAt: r.reconciled_at.toISOString(),
      })),
      events: events.rows.slice(0, 300).map((r) => ({
        id: r.id,
        exportAcceptanceId: r.export_acceptance_id,
        eventKind: r.event_kind,
        retentionDueAt: r.retention_due_at?.toISOString() ?? null,
        evidenceReference: r.evidence_reference,
        retentionNote: r.retention_note,
        recordedByUserId: r.recorded_by_user_id,
        recordedAt: r.recorded_at.toISOString(),
      })),
    };
  });
}
export async function reconcileOwnerExport({ actorUserId, ...raw }) {
  const value = normalizeOwnerExportReconciliation(raw);
  await Promise.all([
    owner(actorUserId, value.sourceCampgroundId),
    owner(actorUserId, value.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_export_reconciliations
       (id,export_acceptance_id,source_campground_id,target_campground_id,
        observed_sha256,observed_row_count,result,evidence_reference,reconciliation_note,reconciled_by_user_id)
       select $1,e.id,e.source_campground_id,e.target_campground_id,$4,$5,
        case when e.export_sha256=$4 and e.export_row_count=$5 then 'matched' else 'mismatch' end,
        $6,$7,$8
       from public.permanent_unit_finance_owner_evidence_export_acceptances e
       where e.id=$2 and e.source_campground_id=$3 and e.target_campground_id=$9
       returning id,result`,
      [
        value.id,
        value.exportAcceptanceId,
        value.sourceCampgroundId,
        value.observedSha256,
        value.observedCount,
        value.evidenceReference,
        value.reconciliationNote,
        actorUserId,
        value.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Owner export receipt unavailable in this campground pair.",
      );
    return result.rows[0];
  });
}
export async function recordOwnerExportRetention({ actorUserId, ...raw }) {
  const value = normalizeOwnerExportRetention(raw);
  await Promise.all([
    owner(actorUserId, value.sourceCampgroundId),
    owner(actorUserId, value.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_export_retention_events
       (id,export_acceptance_id,source_campground_id,target_campground_id,event_kind,
        retention_due_at,evidence_reference,retention_note,recorded_by_user_id)
       select $1,e.id,e.source_campground_id,e.target_campground_id,$4,$5,$6,$7,$8
       from public.permanent_unit_finance_owner_evidence_export_acceptances e
       where e.id=$2 and e.source_campground_id=$3 and e.target_campground_id=$9
       returning id`,
      [
        value.id,
        value.exportAcceptanceId,
        value.sourceCampgroundId,
        value.eventKind,
        value.retentionDueAt,
        value.evidenceReference,
        value.retentionNote,
        actorUserId,
        value.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Owner export receipt unavailable in this campground pair.",
      );
    return result.rows[0].id;
  });
}
