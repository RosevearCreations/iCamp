import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { getOwnerExportOversightReport } from "./oversight-postgres.mjs";
import {
  normalizeOversightReview,
  normalizeOversightDecision,
} from "./decisions-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL is required for private owner review decisions.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function authorize(actor, source, target) {
  if (source === target)
    throw new Error("Choose two different campground scopes.");
  const grants = await Promise.all(
    [source, target].map((id) => getCampgroundAuthorization(actor, id)),
  );
  if (
    grants.some(
      (g) =>
        !g?.roleCodes?.includes("owner_admin") ||
        !g.permissions?.includes("permanent_unit.transfer"),
    )
  )
    throw new Error(
      "Owner / Administrator finance access on both campgrounds is required.",
    );
}
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("set local statement_timeout = '15000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getOwnerOversightDecisionLedger(actor, source, target) {
  await authorize(actor, source, target);
  const baseline = await getOwnerExportOversightReport(actor, {
    days: 180,
    source,
    target,
  });
  const rows = await transaction(actor, true, async (client) => {
    const [reviews, decisions, cases] = await Promise.all([
      client.query(
        `select id,window_days,issue_kind,review_kind,snapshot_as_of,
        cases_observed,open_cases_observed,repeat_receipts_observed,next_review_at,
        evidence_reference,review_note,reviewed_by_user_id,reviewed_at
        from public.owner_export_oversight_reviews
        where source_campground_id=$1 and target_campground_id=$2
        order by reviewed_at desc,id desc limit 51`,
        [source, target],
      ),
      client.query(
        `select id,review_id,basis_case_id,decision_kind,next_due_at,
        evidence_reference,decision_note,decided_by_user_id,decided_at
        from public.owner_export_oversight_decisions
        where source_campground_id=$1 and target_campground_id=$2
        order by decided_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select id,issue_kind,opened_at from public.owner_export_exception_cases
        where source_campground_id=$1 and target_campground_id=$2
        order by opened_at desc,id desc limit 101`,
        [source, target],
      ),
    ]);
    return {
      reviews: reviews.rows,
      decisions: decisions.rows,
      cases: cases.rows,
    };
  });
  return {
    asOf: baseline.asOf,
    campgrounds: baseline.campgrounds,
    source,
    target,
    reviewsLimited: rows.reviews.length > 50,
    decisionsLimited: rows.decisions.length > 150,
    casesLimited: rows.cases.length > 100,
    reviews: rows.reviews.slice(0, 50).map((r) => ({
      id: r.id,
      windowDays: r.window_days,
      issueKind: r.issue_kind,
      reviewKind: r.review_kind,
      snapshotAsOf: r.snapshot_as_of.toISOString(),
      casesObserved: r.cases_observed,
      openCasesObserved: r.open_cases_observed,
      repeatReceiptsObserved: r.repeat_receipts_observed,
      nextReviewAt: r.next_review_at.toISOString(),
      evidenceReference: r.evidence_reference,
      reviewNote: r.review_note,
      reviewedByUserId: r.reviewed_by_user_id,
      reviewedAt: r.reviewed_at.toISOString(),
    })),
    decisions: rows.decisions.slice(0, 150).map((r) => ({
      id: r.id,
      reviewId: r.review_id,
      basisCaseId: r.basis_case_id,
      decisionKind: r.decision_kind,
      nextDueAt: r.next_due_at?.toISOString() ?? null,
      evidenceReference: r.evidence_reference,
      decisionNote: r.decision_note,
      decidedByUserId: r.decided_by_user_id,
      decidedAt: r.decided_at.toISOString(),
    })),
    cases: rows.cases.slice(0, 100).map((r) => ({
      id: r.id,
      issueKind: r.issue_kind,
      openedAt: r.opened_at.toISOString(),
    })),
  };
}
export async function createOwnerOversightReview({ actorUserId, ...raw }) {
  const r = normalizeOversightReview(raw);
  await authorize(actorUserId, r.sourceCampgroundId, r.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_oversight_reviews
      (id,source_campground_id,target_campground_id,window_days,issue_kind,review_kind,
       next_review_at,evidence_reference,review_note,reviewed_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning id,cases_observed,open_cases_observed,repeat_receipts_observed`,
      [
        r.id,
        r.sourceCampgroundId,
        r.targetCampgroundId,
        r.windowDays,
        r.issueKind,
        r.reviewKind,
        r.nextReviewAt,
        r.evidenceReference,
        r.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function appendOwnerOversightDecision({ actorUserId, ...raw }) {
  const d = normalizeOversightDecision(raw);
  await authorize(actorUserId, d.sourceCampgroundId, d.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_oversight_decisions
      (id,review_id,source_campground_id,target_campground_id,basis_case_id,decision_kind,
       next_due_at,evidence_reference,decision_note,decided_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        d.id,
        d.reviewId,
        d.sourceCampgroundId,
        d.targetCampgroundId,
        d.basisCaseId,
        d.decisionKind,
        d.nextDueAt,
        d.evidenceReference,
        d.decisionNote,
        actorUserId,
      ],
    );
    return result.rows[0].id;
  });
}
