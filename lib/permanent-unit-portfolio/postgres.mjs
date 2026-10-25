import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import { normalizeRecurrenceReview } from "./core.mjs";
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for private finance portfolio.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function scoped(actor, campground, work) {
  const campId = unitId(campground, "Campground");
  if (
    !(await hasCampgroundPermission(actor, campId, "permanent_unit.transfer"))
  )
    throw new Error("Not authorized for restricted finance portfolio.");
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const c = await client.query(
      "select id,organization_id,name,clock_timestamp() as server_now from public.campgrounds where id=$1",
      [campId],
    );
    if (!c.rows[0]) throw new Error("Campground unavailable.");
    const result = await work(client, c.rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getFinancePortfolio(actorUserId, campgroundId) {
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    // One bounded display window, while SQL aggregates evaluate each displayed consent's full retained history.
    const consents = await client.query(
      `select c.id,c.recorded_at,s.buyer_display_name,v.version_code
   from public.permanent_unit_offer_delivery_consents c
   join public.permanent_unit_financing_term_proposals p on p.id=c.proposal_id
   join public.permanent_unit_financing_applications a on a.id=p.application_id
   join public.permanent_unit_sale_cases s on s.id=a.sale_case_id
   join public.permanent_unit_disclosure_versions v on v.id=c.version_id
   where c.campground_id=$1 order by c.recorded_at desc,c.id desc limit 501`,
      [camp.id],
    );
    const visible = consents.rows.slice(0, 500),
      ids = visible.map((x) => x.id);
    if (!ids.length)
      return { campground: camp, rows: [], displayLimited: false };
    const [events, reasons, escalations, tasks, reviews] = await Promise.all([
      client.query(
        `select distinct on(consent_id) consent_id,id as latest_exception_event_id,event_type as latest_event_type
    from public.permanent_unit_delivery_exception_events where campground_id=$1 and consent_id=any($2::uuid[])
    order by consent_id,recorded_at desc,id desc`,
        [camp.id, ids],
      ),
      client.query(
        `select consent_id,reason_code,count(*) filter(where event_type='hold')::integer as hold_count
    from public.permanent_unit_delivery_exception_events where campground_id=$1 and consent_id=any($2::uuid[])
    group by consent_id,reason_code having count(*) filter(where event_type='hold')>=2`,
        [camp.id, ids],
      ),
      client.query(
        `select r.consent_id,count(e.id)::integer as escalation_count
    from public.permanent_unit_finance_owner_escalations e join public.permanent_unit_finance_exception_reviews r on r.id=e.exception_review_id
    where e.campground_id=$1 and r.consent_id=any($2::uuid[]) group by r.consent_id`,
        [camp.id, ids],
      ),
      client.query(
        `select r.consent_id,
     count(t.id) filter(where cl.id is null)::integer as open_tasks,
     count(t.id) filter(where cl.id is null and t.due_at<clock_timestamp())::integer as overdue_tasks,
     count(t.id) filter(where cl.id is not null)::integer as closed_tasks
    from public.permanent_unit_finance_followup_tasks t
    join public.permanent_unit_finance_owner_escalations e on e.id=t.escalation_id
    join public.permanent_unit_finance_exception_reviews r on r.id=e.exception_review_id
    left join public.permanent_unit_finance_escalation_closures cl on cl.task_id=t.id
    where t.campground_id=$1 and r.consent_id=any($2::uuid[])
    group by r.consent_id`,
        [camp.id, ids],
      ),
      client.query(
        `select distinct on(consent_id,reason_code) consent_id,reason_code,next_review_at,review_disposition,reviewed_at as latest_reviewed_at
    from public.permanent_unit_finance_recurrence_reviews where campground_id=$1 and consent_id=any($2::uuid[])
    order by consent_id,reason_code,reviewed_at desc,id desc`,
        [camp.id, ids],
      ),
    ]);
    const rows = visible.map((c) => {
      const event = events.rows.find((e) => e.consent_id === c.id),
        escalation = escalations.rows.find((e) => e.consent_id === c.id),
        task = tasks.rows.find((e) => e.consent_id === c.id);
      return {
        ...c,
        latest_exception_event_id: event?.latest_exception_event_id ?? null,
        latest_event_type: event?.latest_event_type ?? null,
        escalation_count: escalation?.escalation_count ?? 0,
        open_tasks: task?.open_tasks ?? 0,
        overdue_tasks: task?.overdue_tasks ?? 0,
        closed_tasks: task?.closed_tasks ?? 0,
        reasons: reasons.rows
          .filter((r) => r.consent_id === c.id)
          .map((r) => ({
            ...r,
            ...(reviews.rows.find(
              (v) => v.consent_id === c.id && v.reason_code === r.reason_code,
            ) ?? {
              next_review_at: null,
              review_disposition: null,
              latest_reviewed_at: null,
            }),
          })),
      };
    });
    return {
      campground: camp,
      rows,
      displayLimited: consents.rows.length > 500,
    };
  });
}
export async function recordRecurrenceReview({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeRecurrenceReview(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_recurrence_reviews
   (id,organization_id,campground_id,consent_id,latest_exception_event_id,reason_code,observed_reason_hold_count,observed_escalation_count,review_disposition,next_review_at,evidence_reference,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.latestExceptionEventId,
        v.reasonCode,
        v.observedReasonHoldCount,
        v.observedEscalationCount,
        v.reviewDisposition,
        v.nextReviewAt,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
