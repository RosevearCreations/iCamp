import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { getOwnerExportRetentionLedger } from "./postgres.mjs";
import {
  normalizeExportExceptionCase,
  normalizeExportExceptionOutcome,
  normalizeExportExceptionReview,
} from "./exceptions-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL is required for private owner exception audit.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function assertOwner(actor, campgroundId) {
  const grant = await getCampgroundAuthorization(actor, campgroundId);
  if (
    !grant?.roleCodes?.includes("owner_admin") ||
    !grant.permissions?.includes("permanent_unit.transfer")
  )
    throw new Error(
      "Active Owner / Administrator finance access is required on both campgrounds.",
    );
}
async function paired(actor, source, target) {
  if (source === target)
    throw new Error(
      "An owner export exception must involve distinct campground scopes.",
    );
  await Promise.all([assertOwner(actor, source), assertOwner(actor, target)]);
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
export async function getOwnerExportExceptionLedger(actor, source, target) {
  const baseline = await getOwnerExportRetentionLedger(actor, source, target);
  if (!baseline.receipts.length)
    return {
      ...baseline,
      cases: [],
      outcomes: [],
      reviews: [],
      casesLimited: false,
      exceptionHistoryLimited: false,
    };
  const ids = baseline.receipts.map((r) => r.id);
  const audit = await transaction(actor, true, async (client) => {
    const cases = await client.query(
      `select id,export_acceptance_id,source_campground_id,target_campground_id,issue_kind,
       basis_reconciliation_id,basis_retention_event_id,action_due_at,evidence_reference,issue_note,
       opened_by_user_id,opened_at from public.owner_export_exception_cases
       where export_acceptance_id=any($1::uuid[]) order by opened_at desc,id desc limit 91`,
      [ids],
    );
    const caseIds = cases.rows.slice(0, 90).map((c) => c.id);
    if (!caseIds.length)
      return {
        cases: [],
        outcomes: [],
        reviews: [],
        casesLimited: false,
        exceptionHistoryLimited: false,
      };
    const [outcomes, reviews] = await Promise.all([
      client.query(
        `select id,case_id,export_acceptance_id,action_kind,next_due_at,
         resolution_reconciliation_id,resolution_retention_event_id,evidence_reference,action_note,
         recorded_by_user_id,recorded_at from public.owner_export_exception_outcomes
         where case_id=any($1::uuid[]) order by recorded_at desc,id desc limit 301`,
        [caseIds],
      ),
      client.query(
        `select id,case_id,outcome_id,export_acceptance_id,review_kind,evidence_reference,
         review_note,reviewed_by_user_id,reviewed_at from public.owner_export_exception_reviews
         where case_id=any($1::uuid[]) order by reviewed_at desc,id desc limit 301`,
        [caseIds],
      ),
    ]);
    return {
      casesLimited: cases.rows.length > 90,
      exceptionHistoryLimited:
        outcomes.rows.length > 300 || reviews.rows.length > 300,
      cases: cases.rows.slice(0, 90).map((r) => ({
        id: r.id,
        exportAcceptanceId: r.export_acceptance_id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        issueKind: r.issue_kind,
        basisReconciliationId: r.basis_reconciliation_id,
        basisRetentionEventId: r.basis_retention_event_id,
        actionDueAt: r.action_due_at.toISOString(),
        evidenceReference: r.evidence_reference,
        issueNote: r.issue_note,
        openedByUserId: r.opened_by_user_id,
        openedAt: r.opened_at.toISOString(),
      })),
      outcomes: outcomes.rows.slice(0, 300).map((r) => ({
        id: r.id,
        caseId: r.case_id,
        exportAcceptanceId: r.export_acceptance_id,
        actionKind: r.action_kind,
        nextDueAt: r.next_due_at?.toISOString() ?? null,
        resolutionReconciliationId: r.resolution_reconciliation_id,
        resolutionRetentionEventId: r.resolution_retention_event_id,
        evidenceReference: r.evidence_reference,
        actionNote: r.action_note,
        recordedByUserId: r.recorded_by_user_id,
        recordedAt: r.recorded_at.toISOString(),
      })),
      reviews: reviews.rows.slice(0, 300).map((r) => ({
        id: r.id,
        caseId: r.case_id,
        outcomeId: r.outcome_id,
        exportAcceptanceId: r.export_acceptance_id,
        reviewKind: r.review_kind,
        evidenceReference: r.evidence_reference,
        reviewNote: r.review_note,
        reviewedByUserId: r.reviewed_by_user_id,
        reviewedAt: r.reviewed_at.toISOString(),
      })),
    };
  });
  return { ...baseline, ...audit };
}
export async function openOwnerExportException({ actorUserId, ...raw }) {
  const item = normalizeExportExceptionCase(raw);
  await paired(actorUserId, item.sourceCampgroundId, item.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_exception_cases
       (id,export_acceptance_id,source_campground_id,target_campground_id,issue_kind,
        action_due_at,evidence_reference,issue_note,opened_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        item.id,
        item.exportAcceptanceId,
        item.sourceCampgroundId,
        item.targetCampgroundId,
        item.issueKind,
        item.actionDueAt,
        item.evidenceReference,
        item.issueNote,
        actorUserId,
      ],
    );
    return result.rows[0].id;
  });
}
export async function recordOwnerExportExceptionOutcome({
  actorUserId,
  ...raw
}) {
  const item = normalizeExportExceptionOutcome(raw);
  await paired(actorUserId, item.sourceCampgroundId, item.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_exception_outcomes
       (id,case_id,export_acceptance_id,source_campground_id,target_campground_id,
        action_kind,next_due_at,evidence_reference,action_note,recorded_by_user_id)
       select $1,c.id,c.export_acceptance_id,c.source_campground_id,c.target_campground_id,
        $4,$5,$6,$7,$8 from public.owner_export_exception_cases c
       where c.id=$2 and c.source_campground_id=$3 and c.target_campground_id=$9 returning id`,
      [
        item.id,
        item.caseId,
        item.sourceCampgroundId,
        item.actionKind,
        item.nextDueAt,
        item.evidenceReference,
        item.actionNote,
        actorUserId,
        item.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Exception follow-up is not available in the selected owner scope.",
      );
    return result.rows[0].id;
  });
}
export async function reviewOwnerExportException({ actorUserId, ...raw }) {
  const item = normalizeExportExceptionReview(raw);
  await paired(actorUserId, item.sourceCampgroundId, item.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_exception_reviews
       (id,case_id,outcome_id,export_acceptance_id,source_campground_id,target_campground_id,
        review_kind,evidence_reference,review_note,reviewed_by_user_id)
       select $1,c.id,$4,c.export_acceptance_id,c.source_campground_id,c.target_campground_id,
        $5,$6,$7,$8 from public.owner_export_exception_cases c
       where c.id=$2 and c.source_campground_id=$3 and c.target_campground_id=$9 returning id`,
      [
        item.id,
        item.caseId,
        item.sourceCampgroundId,
        item.outcomeId,
        item.reviewKind,
        item.evidenceReference,
        item.reviewNote,
        actorUserId,
        item.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Audit closeout is not available in the selected owner scope.",
      );
    return result.rows[0].id;
  });
}
