import pg from "pg";
import {
  getCampgroundAuthorization,
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "../authz/postgres.mjs";
import { authorizedOwnerCampgrounds, normalizeWindow } from "./core.mjs";
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for private owner report.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function reportCampground(actor, assignment, days, generatedAt) {
  // Recheck ownership for *each* campground, never trust caller-provided IDs or organization labels.
  const auth = await getCampgroundAuthorization(actor, assignment.campgroundId);
  if (
    !auth?.roleCodes?.includes("owner_admin") ||
    !auth.permissions?.includes("permanent_unit.transfer") ||
    auth.organizationId !== assignment.organizationId
  )
    throw new Error(
      "Active Owner / Administrator permission required for each campground.",
    );
  const client = await database().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const camp = await client.query(
      "select id,organization_id,name from public.campgrounds where id=$1 and organization_id=$2",
      [assignment.campgroundId, assignment.organizationId],
    );
    if (!camp.rows[0])
      throw new Error("Campground unavailable in owner scope.");
    const scope = assignment.campgroundId;
    const snapshot = await client.query(
      `select
        (select count(*)::integer from (
          select distinct on(consent_id) consent_id,event_type
          from public.permanent_unit_delivery_exception_events
          where campground_id=$1 order by consent_id,recorded_at desc,id desc
        ) e where event_type='hold') as current_holds,
        (select count(*)::integer from public.permanent_unit_finance_followup_tasks t
         left join public.permanent_unit_finance_escalation_closures cl on cl.task_id=t.id
         where t.campground_id=$1 and cl.id is null) as open_tasks,
        (select count(*)::integer from public.permanent_unit_finance_followup_tasks t
         left join public.permanent_unit_finance_escalation_closures cl on cl.task_id=t.id
         where t.campground_id=$1 and cl.id is null and t.due_at<$3::timestamptz) as overdue_tasks,
        (select count(distinct consent_id)::integer from (
          select consent_id,reason_code from public.permanent_unit_delivery_exception_events
          where campground_id=$1 and event_type='hold'
          group by consent_id,reason_code having count(*)>=2
        ) repeated) as recurrent_consents,
        (select count(*)::integer from public.permanent_unit_offer_delivery_consents
         where campground_id=$1 and recorded_at >= $3::timestamptz-($2::int*interval '1 day')) as new_consents,
        (select count(*)::integer from public.permanent_unit_delivery_exception_events
         where campground_id=$1 and event_type='hold' and recorded_at >= $3::timestamptz-($2::int*interval '1 day')) as new_holds,
        (select count(*)::integer from public.permanent_unit_delivery_exception_events
         where campground_id=$1 and event_type='clear' and recorded_at >= $3::timestamptz-($2::int*interval '1 day')) as cleared_holds,
        (select count(*)::integer from public.permanent_unit_finance_followup_tasks
         where campground_id=$1 and recorded_at >= $3::timestamptz-($2::int*interval '1 day')) as created_tasks,
        (select count(*)::integer from public.permanent_unit_finance_escalation_closures
         where campground_id=$1 and closed_at >= $3::timestamptz-($2::int*interval '1 day')) as closed_tasks,
        (select count(*)::integer from public.permanent_unit_finance_recurrence_reviews
         where campground_id=$1 and reviewed_at >= $3::timestamptz-($2::int*interval '1 day')) as recurrence_reviews`,
      [scope, days, generatedAt],
    );
    const trends = await client.query(
      `with calendar as (
        select generate_series(date_trunc('week',$2::timestamptz)-interval '11 weeks',
         date_trunc('week',$2::timestamptz),interval '1 week')::date as week
       ), consent_events as (
        select date_trunc('week',recorded_at)::date as week,count(*)::integer as n
        from public.permanent_unit_offer_delivery_consents
        where campground_id=$1 and recorded_at>=date_trunc('week',$2::timestamptz)-interval '11 weeks'
        group by 1
       ), exceptions as (
        select date_trunc('week',recorded_at)::date as week,
         count(*) filter(where event_type='hold')::integer as holds,
         count(*) filter(where event_type='clear')::integer as clears
        from public.permanent_unit_delivery_exception_events
        where campground_id=$1 and recorded_at>=date_trunc('week',$2::timestamptz)-interval '11 weeks'
        group by 1
       ), tasks as (
        select date_trunc('week',recorded_at)::date as week,count(*)::integer as n
        from public.permanent_unit_finance_followup_tasks
        where campground_id=$1 and recorded_at>=date_trunc('week',$2::timestamptz)-interval '11 weeks'
        group by 1
       ), closures as (
        select date_trunc('week',closed_at)::date as week,count(*)::integer as n
        from public.permanent_unit_finance_escalation_closures
        where campground_id=$1 and closed_at>=date_trunc('week',$2::timestamptz)-interval '11 weeks'
        group by 1
       )
       select calendar.week::text as week,coalesce(consent_events.n,0) as consents,
        coalesce(exceptions.holds,0) as holds,coalesce(exceptions.clears,0) as clears,
        coalesce(tasks.n,0) as created_tasks,coalesce(closures.n,0) as closed_tasks
       from calendar left join consent_events using(week) left join exceptions using(week)
        left join tasks using(week) left join closures using(week)
       order by calendar.week`,
      [scope, generatedAt],
    );
    await client.query("commit");
    const s = snapshot.rows[0];
    return {
      campgroundId: camp.rows[0].id,
      organizationId: camp.rows[0].organization_id,
      name: camp.rows[0].name,
      currentHolds: s.current_holds,
      openTasks: s.open_tasks,
      overdueTasks: s.overdue_tasks,
      recurrentConsents: s.recurrent_consents,
      newConsents: s.new_consents,
      newHolds: s.new_holds,
      clearedHolds: s.cleared_holds,
      createdTasks: s.created_tasks,
      closedTasks: s.closed_tasks,
      recurrenceReviews: s.recurrence_reviews,
      weeks: trends.rows.map((w) => ({
        week: w.week,
        consents: w.consents,
        holds: w.holds,
        clears: w.clears,
        createdTasks: w.created_tasks,
        closedTasks: w.closed_tasks,
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getOwnerFinanceReport(actorUserId, rawWindow) {
  const days = normalizeWindow(rawWindow);
  const assignments = await listAssignedCampgrounds(actorUserId);
  const withPermission = await Promise.all(
    assignments.map(async (a) => ({
      ...a,
      allowed: await hasCampgroundPermission(
        actorUserId,
        a.campgroundId,
        "permanent_unit.transfer",
      ),
    })),
  );
  const ownerAssignments = authorizedOwnerCampgrounds(withPermission);
  if (!ownerAssignments.length)
    throw new Error(
      "No active campground Owner / Administrator finance reporting assignment.",
    );
  const selected = ownerAssignments.slice(0, 50);
  // Common database timestamp keeps all campuses' snapshots on the same clock.
  const clock = await database().query(
    "select clock_timestamp() as generated_at",
  );
  const generatedAt = clock.rows[0].generated_at.toISOString();
  const campgrounds = await Promise.all(
    selected.map((a) => reportCampground(actorUserId, a, days, generatedAt)),
  );
  return {
    generatedAt,
    days,
    campgrounds,
    limited: ownerAssignments.length > 50,
  };
}
