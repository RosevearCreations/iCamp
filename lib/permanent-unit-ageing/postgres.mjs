import pg from "pg";
import {
  getCampgroundAuthorization,
  hasCampgroundPermission,
} from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeExceptionReview,
  normalizeOwnerEscalation,
  normalizeOwnerResponse,
} from "./core.mjs";
let pool;
function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for finance exception ageing.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
async function requireOwner(userId, campgroundId) {
  const auth = await getCampgroundAuthorization(
    unitId(userId, "Owner"),
    unitId(campgroundId, "Campground"),
  );
  if (!auth?.roleCodes?.includes("owner_admin"))
    throw new Error(
      "Escalation owner must hold an active campground Owner / Administrator assignment.",
    );
}
async function scoped(actorUserId, campgroundId, work) {
  const campId = unitId(campgroundId, "Campground");
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campId,
      "permanent_unit.transfer",
    ))
  )
    throw new Error("Not authorized for private finance exceptions.");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const r = await client.query(
      "select id,organization_id,name,clock_timestamp() as server_now from public.campgrounds where id=$1",
      [campId],
    );
    if (!r.rows[0]) throw new Error("Campground unavailable.");
    const result = await work(client, r.rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getAgeingDashboard(actorUserId, campgroundId) {
  const campId = unitId(campgroundId, "Campground");
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campId,
      "permanent_unit.transfer",
    ))
  )
    throw new Error("Not authorized for private finance exceptions.");
  const [data, owners] = await Promise.all([
    scoped(actorUserId, campId, async (client, camp) => {
      const [consents, recons, exceptions, reviews, escalations, responses] =
        await Promise.all([
          client.query(
            `select c.id,c.version_id,c.recorded_at,c.consent_channel,s.buyer_display_name,v.version_code
      from public.permanent_unit_offer_delivery_consents c
      join public.permanent_unit_financing_term_proposals p on p.id=c.proposal_id
      join public.permanent_unit_financing_applications a on a.id=p.application_id
      join public.permanent_unit_sale_cases s on s.id=a.sale_case_id
      join public.permanent_unit_disclosure_versions v on v.id=c.version_id
      where c.campground_id=$1 order by c.recorded_at desc limit 100`,
            [camp.id],
          ),
          client.query(
            "select * from public.permanent_unit_finance_delivery_reconciliations where campground_id=$1 order by prepared_at desc,id desc limit 200",
            [camp.id],
          ),
          client.query(
            "select * from public.permanent_unit_delivery_exception_events where campground_id=$1 order by recorded_at desc,id desc limit 500",
            [camp.id],
          ),
          client.query(
            "select * from public.permanent_unit_finance_exception_reviews where campground_id=$1 order by reviewed_at desc,id desc limit 300",
            [camp.id],
          ),
          client.query(
            "select * from public.permanent_unit_finance_owner_escalations where campground_id=$1 order by escalated_at desc,id desc limit 200",
            [camp.id],
          ),
          client.query(
            "select * from public.permanent_unit_finance_owner_responses where campground_id=$1 order by responded_at desc limit 200",
            [camp.id],
          ),
        ]);
      return {
        campground: camp,
        serverNow: camp.server_now,
        consents: consents.rows,
        reconciliations: recons.rows,
        exceptions: exceptions.rows,
        reviews: reviews.rows,
        escalations: escalations.rows,
        responses: responses.rows,
      };
    }),
    db().query(
      `select distinct u.id,u.email_normalized from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
    join icamp_private.roles r on r.id=ar.role_id
    join icamp_private.user_accounts u on u.id=a.user_id
    where a.campground_id=$1 and a.assignment_state='active' and a.starts_at<=statement_timestamp()
    and (a.ends_at is null or a.ends_at>statement_timestamp())
    and r.role_code='owner_admin' and r.lifecycle_state='active' and u.account_type='staff' and u.account_state='active'
    order by u.email_normalized`,
      [campId],
    ),
  ]);
  return { ...data, owners: owners.rows };
}
export async function recordExceptionReview({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeExceptionReview(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_exception_reviews
    (id,organization_id,campground_id,consent_id,reconciliation_id,exception_event_id,observation_state,observed_since,review_decision,evidence_reference,next_review_at,note,reviewed_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),$8,$9,$10,$11,$12) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.reconciliationId,
        v.exceptionEventId,
        v.observationState,
        v.reviewDecision,
        v.evidenceReference,
        v.nextReviewAt,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordOwnerEscalation({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeOwnerEscalation(input);
  await requireOwner(v.targetOwnerUserId, campgroundId);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_owner_escalations
    (id,organization_id,campground_id,exception_review_id,target_owner_user_id,priority,escalation_reference,requested_action,due_at,escalated_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.exceptionReviewId,
        v.targetOwnerUserId,
        v.priority,
        v.escalationReference,
        v.requestedAction,
        v.dueAt,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordOwnerResponse({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeOwnerResponse(input);
  await requireOwner(actorUserId, campgroundId);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_owner_responses
    (id,organization_id,campground_id,escalation_id,response,evidence_reference,note,responded_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.escalationId,
        v.response,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
