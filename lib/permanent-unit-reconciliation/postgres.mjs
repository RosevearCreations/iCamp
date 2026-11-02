import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeEvidenceReconciliation,
  normalizeClosureReview,
} from "./core.mjs";
let pool;
function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL required for finance evidence reconciliation.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
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
    throw new Error("Not authorized to reconcile finance delivery evidence.");
  const client = await db().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const { rows } = await client.query(
      "select id,organization_id,name from public.campgrounds where id=$1",
      [campId],
    );
    if (!rows[0]) throw new Error("Campground unavailable.");
    const result = await work(client, rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getReconciliationDashboard(actorUserId, campgroundId) {
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const [
      consents,
      signoffs,
      receipts,
      responses,
      exceptions,
      reconciliations,
      reviews,
    ] = await Promise.all([
      client.query(
        `select c.id,c.version_id,c.proposal_id,c.consent_channel,c.recipient_reference,v.version_code,v.content_sha256,s.buyer_display_name
    from public.permanent_unit_offer_delivery_consents c
    join public.permanent_unit_disclosure_versions v on v.id=c.version_id
    join public.permanent_unit_financing_term_proposals p on p.id=c.proposal_id
    join public.permanent_unit_financing_applications a on a.id=p.application_id
    join public.permanent_unit_sale_cases s on s.id=a.sale_case_id
    where c.campground_id=$1 order by c.recorded_at desc limit 100`,
        [camp.id],
      ),
      client.query(
        "select id,consent_id,decision,reviewed_by_user_id from public.permanent_unit_offer_delivery_signoffs where campground_id=$1",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_manual_delivery_receipts where campground_id=$1 order by recorded_at desc limit 150",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_applicant_acknowledgements where campground_id=$1 order by recorded_at desc limit 150",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_delivery_exception_events where campground_id=$1 order by recorded_at desc,id desc limit 500",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_finance_delivery_reconciliations where campground_id=$1 order by prepared_at desc,id desc limit 200",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_finance_delivery_closure_reviews where campground_id=$1 order by reviewed_at desc limit 200",
        [camp.id],
      ),
    ]);
    return {
      campground: camp,
      consents: consents.rows,
      signoffs: signoffs.rows,
      receipts: receipts.rows,
      responses: responses.rows,
      exceptions: exceptions.rows,
      reconciliations: reconciliations.rows,
      reviews: reviews.rows,
    };
  });
}
export async function prepareEvidenceReconciliation({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeEvidenceReconciliation(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_delivery_reconciliations
   (id,organization_id,campground_id,consent_id,receipt_id,acknowledgement_id,disclosure_version_id,disclosure_sha256,last_exception_event_id,completeness,reconciliation_reference,note,prepared_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.receiptId,
        v.acknowledgementId,
        v.disclosureVersionId,
        v.disclosureSha256,
        v.lastExceptionEventId,
        v.completeness,
        v.reconciliationReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function reviewEvidenceClosure({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeClosureReview(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_delivery_closure_reviews
   (id,organization_id,campground_id,reconciliation_id,decision,review_reference,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.reconciliationId,
        v.decision,
        v.reviewReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
