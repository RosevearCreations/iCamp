import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import { normalizeOfferTerms, normalizeOfferAuthorization } from "./core.mjs";

let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for private offer review.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeOfferPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(actorUserId, campgroundId, work) {
  const camp = unitId(campgroundId, "Campground");
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      camp,
      "permanent_unit.transfer",
    ))
  )
    throw new Error("Not authorized for private financing terms.");
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const p = await client.query(
      "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1",
      [camp],
    );
    if (!p.rows[0]) throw new Error("Campground unavailable.");
    const result = await work(client, p.rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getOfferDashboard(actorUserId, campgroundId) {
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const [applications, triage, proposals, decisions] = await Promise.all([
      client.query(
        `select a.id,a.sale_case_id,a.requested_amount_cents,c.buyer_display_name
     from public.permanent_unit_financing_applications a
     join public.permanent_unit_sale_cases c on c.id=a.sale_case_id
     where a.campground_id=$1 order by a.opened_at desc,a.id desc limit 100`,
        [camp.id],
      ),
      client.query(
        "select application_id,decision from public.permanent_unit_financing_triage where campground_id=$1",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_financing_term_proposals where campground_id=$1 order by drafted_at desc,id desc limit 250",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_financing_offer_authorizations where campground_id=$1 order by reviewed_at desc,id desc limit 250",
        [camp.id],
      ),
    ]);
    return {
      campground: camp,
      applications: applications.rows,
      triage: triage.rows,
      proposals: proposals.rows,
      decisions: decisions.rows,
    };
  });
}
export async function draftOfferTerms({ actorUserId, campgroundId, ...input }) {
  const v = normalizeOfferTerms(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_financing_term_proposals
   (id,organization_id,campground_id,application_id,principal_cents,annual_rate_bps,term_months,upfront_fee_cents,estimated_monthly_cents,policy_reference,disclosure_reference,note,drafted_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.applicationId,
        v.principalCents,
        v.annualRateBps,
        v.months,
        v.feeCents,
        v.estimatedMonthlyCents,
        v.policyReference,
        v.disclosureReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function reviewOfferTerms({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeOfferAuthorization(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_financing_offer_authorizations
   (id,organization_id,campground_id,proposal_id,decision,external_review_reference,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.proposalId,
        v.decision,
        v.externalReviewReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
