import pg from "pg";
import {
  getCampgroundAuthorization,
  listAssignedCampgrounds,
} from "../authz/postgres.mjs";
import {
  normalizeOversightScope,
  normalizeOversightWindow,
} from "./oversight-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for private owner oversight.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// Case counts are exhaustive within the selected cohort. Only the drilldown
// display is capped. All joins execute as icamp_app under forced pair-level RLS.
const caseStates = `
with scoped_cases as (
 select c.id,c.export_acceptance_id,c.source_campground_id,c.target_campground_id,
  c.issue_kind,c.opened_at,c.action_due_at,
  o.action_kind,o.next_due_at,rv.review_kind as outcome_review_kind,
  (accepted.id is not null) as accepted
 from public.owner_export_exception_cases c
 left join lateral (
  select id,action_kind,next_due_at from public.owner_export_exception_outcomes o
  where o.case_id=c.id order by o.recorded_at desc,o.id desc limit 1
 ) o on true
 left join lateral (
  select review_kind from public.owner_export_exception_reviews rv
  where rv.outcome_id=o.id order by rv.reviewed_at desc,rv.id desc limit 1
 ) rv on true
 left join lateral (
  select id from public.owner_export_exception_reviews accepted
  where accepted.case_id=c.id and accepted.review_kind='accepted' limit 1
 ) accepted on true
 where c.source_campground_id=any($1::uuid[])
  and c.target_campground_id=any($1::uuid[])
  and ($2::uuid is null or c.source_campground_id=$2)
  and ($3::uuid is null or c.target_campground_id=$3)
  and c.opened_at >= $4::timestamptz and c.opened_at <= $5::timestamptz
), case_states as (
 select *,case
  when accepted then 'closed'
  when action_kind='review_ready' and outcome_review_kind='needs_followup' then 'returned'
  when action_kind='review_ready' then 'review_pending'
  when (case when action_kind is null then action_due_at else next_due_at end)<$5::timestamptz then 'overdue'
  when action_kind='escalated' then 'escalated'
  else 'open' end as stage,
  case when action_kind is null then action_due_at else next_due_at end as due_at
 from scoped_cases
)`;

const cohortSummarySql = `${caseStates}
 select count(*)::int as cases_opened,
  count(distinct export_acceptance_id)::int as affected_receipts,
  count(*) filter(where stage='closed')::int as independently_closed,
  count(*) filter(where stage<>'closed')::int as not_closed,
  count(*) filter(where stage='overdue')::int as overdue_actions,
  count(*) filter(where stage='review_pending')::int as awaiting_independent_review,
  count(*) filter(where stage='returned')::int as returned_for_followup,
  count(*) filter(where stage='escalated')::int as escalated,
  (select count(*)::int from (
   select export_acceptance_id from case_states
   group by export_acceptance_id having count(*)>1
  ) reopened) as receipts_reopened,
  (select count(*)::int from (
   select source_campground_id,target_campground_id,issue_kind from case_states
   group by source_campground_id,target_campground_id,issue_kind having count(*)>1
  ) repeated) as repeated_pair_issue_groups
 from case_states`;

const groupedSql = `${caseStates}
 select source_campground_id,target_campground_id,issue_kind,
  count(*)::int as cases_opened,
  count(distinct export_acceptance_id)::int as affected_receipts,
  count(*) filter(where stage='closed')::int as independently_closed,
  count(*) filter(where stage='overdue')::int as overdue_actions
 from case_states group by 1,2,3
 order by cases_opened desc,source_campground_id,target_campground_id,issue_kind
 limit 101`;

const openCasesSql = `${caseStates}
 select id,export_acceptance_id,source_campground_id,target_campground_id,
  issue_kind,opened_at,stage,due_at from case_states
 where stage<>'closed'
 order by (stage='overdue') desc,(stage='returned') desc,opened_at desc,id desc
 limit 51`;

const receiptsSql = `
with scoped_receipts as (
 select e.id from public.permanent_unit_finance_owner_evidence_export_acceptances e
 where e.source_campground_id=any($1::uuid[])
  and e.target_campground_id=any($1::uuid[])
  and ($2::uuid is null or e.source_campground_id=$2)
  and ($3::uuid is null or e.target_campground_id=$3)
  and e.accepted_at >= $4::timestamptz and e.accepted_at <= $5::timestamptz
), receipt_status as (
 select e.id,recon.result as reconciliation_result,
  retention.event_kind,retention.retention_due_at
 from scoped_receipts e
 left join lateral (
  select result from public.permanent_unit_finance_owner_export_reconciliations r
  where r.export_acceptance_id=e.id order by r.reconciled_at desc,r.id desc limit 1
 ) recon on true
 left join lateral (
  select event_kind,retention_due_at from public.permanent_unit_finance_owner_export_retention_events t
  where t.export_acceptance_id=e.id order by t.recorded_at desc,t.id desc limit 1
 ) retention on true
)
select count(*)::int as accepted_receipts,
 count(*) filter(where reconciliation_result is null)::int as missing_reconciliation,
 count(*) filter(where reconciliation_result='mismatch')::int as mismatched,
 count(*) filter(where reconciliation_result='matched' and event_kind is null)::int as missing_retention,
 count(*) filter(where reconciliation_result='matched' and event_kind<>'copy_disposed'
  and retention_due_at <= $5::timestamptz)::int as retention_overdue,
 count(*) filter(where event_kind='copy_disposed')::int as disposal_attested
from receipt_status`;

// Weekly activity includes events on earlier cases, unlike the new-case cohort.
const weeklySql = `
with events as (
 select c.opened_at as recorded_at,1 as opened,0 as closed,0 as returned,0 as escalated
 from public.owner_export_exception_cases c
 where c.source_campground_id=any($1::uuid[]) and c.target_campground_id=any($1::uuid[])
  and ($2::uuid is null or c.source_campground_id=$2)
  and ($3::uuid is null or c.target_campground_id=$3)
  and c.opened_at >= $4::timestamptz and c.opened_at <= $5::timestamptz
 union all
 select r.reviewed_at,0,(r.review_kind='accepted')::int,(r.review_kind='needs_followup')::int,0
 from public.owner_export_exception_reviews r
 where r.source_campground_id=any($1::uuid[]) and r.target_campground_id=any($1::uuid[])
  and ($2::uuid is null or r.source_campground_id=$2)
  and ($3::uuid is null or r.target_campground_id=$3)
  and r.reviewed_at >= $4::timestamptz and r.reviewed_at <= $5::timestamptz
 union all
 select o.recorded_at,0,0,0,(o.action_kind='escalated')::int
 from public.owner_export_exception_outcomes o
 where o.source_campground_id=any($1::uuid[]) and o.target_campground_id=any($1::uuid[])
  and ($2::uuid is null or o.source_campground_id=$2)
  and ($3::uuid is null or o.target_campground_id=$3)
  and o.recorded_at >= $4::timestamptz and o.recorded_at <= $5::timestamptz
)
select to_char(date_trunc('week',recorded_at at time zone 'UTC'),'YYYY-MM-DD') as week,
 sum(opened)::int as cases_opened,sum(closed)::int as accepted,
 sum(returned)::int as returned,sum(escalated)::int as escalated
from events group by 1 order by 1`;

export async function getOwnerExportOversightReport(
  actorUserId,
  { days: rawDays = 90, source: rawSource, target: rawTarget } = {},
) {
  const days = normalizeOversightWindow(rawDays);
  const assignments = (await listAssignedCampgrounds(actorUserId)).filter((a) =>
    a.roleCodes.includes("owner_admin"),
  );
  const scoped = await Promise.all(
    assignments.map(async (assignment) => {
      const grant = await getCampgroundAuthorization(
        actorUserId,
        assignment.campgroundId,
      );
      return grant?.organizationId === assignment.organizationId &&
        grant.roleCodes.includes("owner_admin") &&
        grant.permissions.includes("permanent_unit.transfer")
        ? assignment
        : null;
    }),
  );
  const owners = scoped.filter(Boolean);
  if (!owners.length)
    throw new Error(
      "Active campground Owner / Administrator finance access is required.",
    );
  const selected = owners.slice(0, 50);
  const ids = selected.map((a) => a.campgroundId);
  const { source, target } = normalizeOversightScope(rawSource, rawTarget, ids);
  const client = await database().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("set local statement_timeout = '15000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const timestamp = await client.query("select clock_timestamp() as as_of");
    const asOf = timestamp.rows[0].as_of.toISOString();
    const start = new Date(
      new Date(asOf).getTime() - days * 86400000,
    ).toISOString();
    const parameters = [ids, source, target, start, asOf];
    const summary = (await client.query(cohortSummarySql, parameters)).rows[0];
    const receipts = (await client.query(receiptsSql, parameters)).rows[0];
    const groups = (await client.query(groupedSql, parameters)).rows;
    const cases = (await client.query(openCasesSql, parameters)).rows;
    const weeks = (await client.query(weeklySql, parameters)).rows;
    await client.query("commit");
    return {
      asOf,
      start,
      days,
      selectedSource: source,
      selectedTarget: target,
      campgrounds: selected.map((a) => ({
        id: a.campgroundId,
        name: a.campgroundName,
      })),
      campgroundsLimited: owners.length > 50,
      summary: {
        casesOpened: summary.cases_opened,
        affectedReceipts: summary.affected_receipts,
        independentlyClosed: summary.independently_closed,
        notClosed: summary.not_closed,
        overdueActions: summary.overdue_actions,
        awaitingReview: summary.awaiting_independent_review,
        returnedForFollowup: summary.returned_for_followup,
        escalated: summary.escalated,
        receiptsReopened: summary.receipts_reopened,
        repeatedPairIssueGroups: summary.repeated_pair_issue_groups,
      },
      receipts: {
        accepted: receipts.accepted_receipts,
        missingReconciliation: receipts.missing_reconciliation,
        mismatched: receipts.mismatched,
        missingRetention: receipts.missing_retention,
        overdueRetention: receipts.retention_overdue,
        disposalAttested: receipts.disposal_attested,
      },
      groupsLimited: groups.length > 100,
      groups: groups.slice(0, 100).map((r) => ({
        source: r.source_campground_id,
        target: r.target_campground_id,
        issueKind: r.issue_kind,
        casesOpened: r.cases_opened,
        affectedReceipts: r.affected_receipts,
        independentlyClosed: r.independently_closed,
        overdueActions: r.overdue_actions,
      })),
      casesLimited: cases.length > 50,
      cases: cases.slice(0, 50).map((r) => ({
        id: r.id,
        exportAcceptanceId: r.export_acceptance_id,
        source: r.source_campground_id,
        target: r.target_campground_id,
        issueKind: r.issue_kind,
        openedAt: r.opened_at.toISOString(),
        stage: r.stage,
        dueAt: r.due_at?.toISOString() ?? null,
      })),
      weeks: weeks.map((r) => ({
        week: r.week,
        casesOpened: r.cases_opened,
        accepted: r.accepted,
        returned: r.returned,
        escalated: r.escalated,
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
