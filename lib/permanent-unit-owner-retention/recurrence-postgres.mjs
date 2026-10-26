import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeRecurrenceReview,
  normalizeRecurrenceDecision,
  normalizeIndependentReassessment,
  classifyRecurrenceFollowUp,
} from "./recurrence-core.mjs";
let pool;
function db() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required for recurrence audits.");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  }));
}
async function authorize(actor, source, target) {
  const grants = await Promise.all(
    [source, target].map((id) => getCampgroundAuthorization(actor, id)),
  );
  if (
    source === target ||
    grants.some(
      (g) =>
        !g?.roleCodes?.includes("owner_admin") ||
        !g.permissions?.includes("permanent_unit.transfer"),
    )
  )
    throw new Error(
      "Owner / Administrator finance permission to both campgrounds is required.",
    );
}
async function transact(actor, readOnly, work) {
  const client = await db().connect();
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
export async function getRecurrenceLedger(actor, source, target) {
  await authorize(actor, source, target);
  return transact(actor, true, async (client) => {
    const [acceptances, reviews, decisions, reassessments] = await Promise.all([
      client.query(
        `select a.id,a.accepted_at from public.owner_export_outcome_acceptances a where a.source_campground_id=$1 and a.target_campground_id=$2 and a.acceptance_kind='accepted' order by a.accepted_at desc,a.id desc limit 101`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_hold_recurrence_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_hold_recurrence_decisions where source_campground_id=$1 and target_campground_id=$2 order by decided_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_recurrence_reassessments where source_campground_id=$1 and target_campground_id=$2 order by assessed_at desc,id desc limit 151`,
        [source, target],
      ),
    ]);
    const reassessmentByDecision = new Map(
      reassessments.rows.map((r) => [r.recurrence_decision_id, r.id]),
    );
    return {
      acceptances: acceptances.rows.slice(0, 100),
      reviews: reviews.rows.slice(0, 150),
      decisions: decisions.rows.slice(0, 150).map((d) => ({
        ...d,
        reassessment_id: reassessmentByDecision.get(d.id) ?? null,
        followup_status: classifyRecurrenceFollowUp({
          ...d,
          reassessment_id: reassessmentByDecision.get(d.id) ?? null,
        }),
      })),
      reassessments: reassessments.rows.slice(0, 150),
      limited:
        acceptances.rows.length > 100 ||
        reviews.rows.length > 150 ||
        decisions.rows.length > 150 ||
        reassessments.rows.length > 150,
    };
  });
}
export async function recordIndependentRecurrenceReassessment({
  actorUserId,
  ...raw
}) {
  const v = normalizeIndependentReassessment(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_recurrence_reassessments(id,recurrence_decision_id,source_campground_id,target_campground_id,assessment_kind,evidence_reference,assessment_note,assessed_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        v.recurrenceDecisionId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.assessmentKind,
        v.evidenceReference,
        v.assessmentNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordOwnerRecurrenceReview({ actorUserId, ...raw }) {
  const v = normalizeRecurrenceReview(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_hold_recurrence_reviews(id,acceptance_id,source_campground_id,target_campground_id,evidence_reference,review_note,reviewed_by_user_id)values($1,$2,$3,$4,$5,$6,$7)returning id,observed_plan_count,observed_continued_holds,observed_overdue_plans`,
      [
        v.id,
        v.acceptanceId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.evidenceReference,
        v.reviewNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordIndependentRecurrenceDecision({
  actorUserId,
  ...raw
}) {
  const v = normalizeRecurrenceDecision(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transact(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_hold_recurrence_decisions(id,recurrence_review_id,source_campground_id,target_campground_id,decision_kind,next_due_at,evidence_reference,decision_note,decided_by_user_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9)returning id`,
      [
        v.id,
        v.recurrenceReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.decisionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.decisionNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
