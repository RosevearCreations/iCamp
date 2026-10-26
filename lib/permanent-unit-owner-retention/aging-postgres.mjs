import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { getOwnerExportOversightReport } from "./oversight-postgres.mjs";
import {
  normalizeAgingFilter,
  normalizeOwnerDecisionReassessment,
} from "./aging-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL is required for private owner reassessment audits.",
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
    throw new Error("Select two different campground scopes.");
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
      "Active Owner / Administrator finance access to both campgrounds is required.",
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
// Only the newest Build 109 decision per review determines current follow-up
// age. A new Build 110 reassessment changes the effective due date, never
// overwrites the original decision. Audit history remains independently visible.
const agingStates = `
with latest_decisions as (
 select distinct on (d.review_id)
  d.id,d.review_id,d.basis_case_id,d.decision_kind,d.decided_by_user_id,
  d.next_due_at as original_due_at,d.decided_at,
  v.issue_kind,v.window_days,v.snapshot_as_of,
  v.reviewed_at,v.reviewed_by_user_id
 from public.owner_export_oversight_decisions d
 join public.owner_export_oversight_reviews v on v.id=d.review_id
 where d.source_campground_id=$1::uuid and d.target_campground_id=$2::uuid
 order by d.review_id,d.decided_at desc,d.id desc
), latest_with_reassessment as (
 select d.*,a.id as reassessment_id,a.assessment_kind,a.reassessed_at,
  a.observed_unclosed_cases,a.new_cases_since_review,
  (case when a.assessment_kind='closure_recommended' then null
   else coalesce(a.next_due_at,d.original_due_at) end) as effective_due_at
 from latest_decisions d
 left join lateral (
  select id,assessment_kind,reassessed_at,observed_unclosed_cases,
   new_cases_since_review,next_due_at
  from public.owner_export_oversight_reassessments a where a.decision_id=d.id
  order by a.reassessed_at desc,a.id desc limit 1
 ) a on true
), classified as (
 select *,case
  when decision_kind='closed_no_action' then 'closed_no_action'
  when assessment_kind='closure_recommended' then 'closure_recommended'
  when effective_due_at is null or effective_due_at<$4::timestamptz then 'overdue'
  when effective_due_at<=$4::timestamptz+interval '7 days' then 'due_week'
  when effective_due_at<=$4::timestamptz+interval '30 days' then 'due_month'
  else 'later' end as stage,
  floor(extract(epoch from ($4::timestamptz-decided_at))/86400)::int as age_days,
  coalesce(greatest(0,ceil(extract(epoch from ($4::timestamptz-effective_due_at))/86400))::int,0) as overdue_days
 from latest_with_reassessment
)`;
const countsSql = `${agingStates}
select count(*)::int as decisions,
 count(*) filter(where stage='overdue')::int as overdue,
 count(*) filter(where stage='due_week')::int as due_week,
 count(*) filter(where stage='due_month')::int as due_month,
 count(*) filter(where stage='later')::int as later,
 count(*) filter(where stage='closure_recommended')::int as closure_recommended,
 count(*) filter(where stage='closed_no_action')::int as closed_no_action,
 count(*) filter(where stage='overdue' and overdue_days>30)::int as overdue_over_30,
 count(*) filter(where reassessment_id is not null)::int as independently_reassessed
from classified`;
const rowsSql = `${agingStates}
select * from classified where ($3::text='all' or stage=$3::text)
order by case stage when 'overdue' then 0 when 'due_week' then 1
 when 'due_month' then 2 when 'later' then 3
 when 'closure_recommended' then 4 else 5 end,
 age_days desc,decided_at desc,id desc limit 101`;

export async function getOwnerDecisionAgingReport(
  actor,
  source,
  target,
  { filter: rawFilter } = {},
) {
  await authorize(actor, source, target);
  // Reuse Build 108's owner-authorization scope for names and coverage disclosure.
  const baseline = await getOwnerExportOversightReport(actor, {
    days: 180,
    source,
    target,
  });
  const filter = normalizeAgingFilter(rawFilter);
  const results = await transaction(actor, true, async (client) => {
    const clock = await client.query("select clock_timestamp() as as_of");
    const asOf = clock.rows[0].as_of.toISOString();
    const params = [source, target, filter, asOf];
    const counts = (await client.query(countsSql, params)).rows[0];
    const rows = (await client.query(rowsSql, params)).rows;
    const audit = (
      await client.query(
        `select id,decision_id,review_id,assessment_kind,basis_case_id,
      next_due_at,observed_unclosed_cases,new_cases_since_review,evidence_reference,
      reassessment_note,reassessed_by_user_id,reassessed_at
      from public.owner_export_oversight_reassessments
      where source_campground_id=$1 and target_campground_id=$2
      order by reassessed_at desc,id desc limit 151`,
        [source, target],
      )
    ).rows;
    const cases = (
      await client.query(
        `select id,issue_kind,opened_at from public.owner_export_exception_cases
      where source_campground_id=$1 and target_campground_id=$2
      order by opened_at desc,id desc limit 101`,
        [source, target],
      )
    ).rows;
    return { asOf, counts, rows, audit, cases };
  });
  return {
    source,
    target,
    filter,
    asOf: results.asOf,
    campgrounds: baseline.campgrounds,
    campgroundsLimited: baseline.campgroundsLimited,
    itemsLimited: results.rows.length > 100,
    historyLimited: results.audit.length > 150,
    casesLimited: results.cases.length > 100,
    summary: {
      decisions: results.counts.decisions,
      overdue: results.counts.overdue,
      dueWeek: results.counts.due_week,
      dueMonth: results.counts.due_month,
      later: results.counts.later,
      closureRecommended: results.counts.closure_recommended,
      closedNoAction: results.counts.closed_no_action,
      overdueOver30: results.counts.overdue_over_30,
      independentlyReassessed: results.counts.independently_reassessed,
    },
    items: results.rows.slice(0, 100).map((r) => ({
      id: r.id,
      reviewId: r.review_id,
      issueKind: r.issue_kind,
      decisionKind: r.decision_kind,
      originalDueAt: r.original_due_at?.toISOString() ?? null,
      effectiveDueAt: r.effective_due_at?.toISOString() ?? null,
      decidedAt: r.decided_at.toISOString(),
      decidedByUserId: r.decided_by_user_id,
      reassessmentId: r.reassessment_id,
      assessmentKind: r.assessment_kind,
      stage: r.stage,
      ageDays: r.age_days,
      overdueDays: r.overdue_days,
      latestReassessedAt: r.reassessed_at?.toISOString() ?? null,
      observedUnclosedCases: r.observed_unclosed_cases,
      newCasesSinceReview: r.new_cases_since_review,
    })),
    reassessments: results.audit.slice(0, 150).map((r) => ({
      id: r.id,
      decisionId: r.decision_id,
      reviewId: r.review_id,
      assessmentKind: r.assessment_kind,
      basisCaseId: r.basis_case_id,
      nextDueAt: r.next_due_at?.toISOString() ?? null,
      observedUnclosedCases: r.observed_unclosed_cases,
      newCasesSinceReview: r.new_cases_since_review,
      evidenceReference: r.evidence_reference,
      reassessmentNote: r.reassessment_note,
      reassessedByUserId: r.reassessed_by_user_id,
      reassessedAt: r.reassessed_at.toISOString(),
    })),
    cases: results.cases.slice(0, 100).map((r) => ({
      id: r.id,
      issueKind: r.issue_kind,
      openedAt: r.opened_at.toISOString(),
    })),
  };
}
export async function recordIndependentOwnerDecisionReassessment({
  actorUserId,
  ...raw
}) {
  const value = normalizeOwnerDecisionReassessment(raw);
  await authorize(
    actorUserId,
    value.sourceCampgroundId,
    value.targetCampgroundId,
  );
  return transaction(actorUserId, false, async (client) => {
    const row = await client.query(
      `insert into public.owner_export_oversight_reassessments
      (id,decision_id,review_id,source_campground_id,target_campground_id,
       assessment_kind,basis_case_id,next_due_at,evidence_reference,reassessment_note,reassessed_by_user_id)
      select $1,d.id,d.review_id,$3,$4,$5,$6,$7,$8,$9,$10
      from public.owner_export_oversight_decisions d
      where d.id=$2 and d.source_campground_id=$3 and d.target_campground_id=$4
      returning id,observed_unclosed_cases,new_cases_since_review`,
      [
        value.id,
        value.decisionId,
        value.sourceCampgroundId,
        value.targetCampgroundId,
        value.assessmentKind,
        value.basisCaseId,
        value.nextDueAt,
        value.evidenceReference,
        value.reassessmentNote,
        actorUserId,
      ],
    );
    if (!row.rows.length)
      throw new Error(
        "Selected owner decision is unavailable in this campground pair.",
      );
    return row.rows[0];
  });
}
