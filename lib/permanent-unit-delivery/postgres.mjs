import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeDisclosureVersion,
  normalizeDisclosureReview,
  normalizeDeliveryConsent,
  normalizeDeliverySignoff,
} from "./core.mjs";

let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for offer delivery boundary.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeDeliveryPoolForTests() {
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
    throw new Error("Not authorized for private disclosure coordination.");
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const property = await client.query(
      "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1",
      [camp],
    );
    if (!property.rows[0]) throw new Error("Campground unavailable.");
    const result = await work(client, property.rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getDeliveryDashboard(actorUserId, campgroundId) {
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const [versions, reviews, proposals, authorizations, consents, signoffs] =
      await Promise.all([
        client.query(
          "select * from public.permanent_unit_disclosure_versions where campground_id=$1 order by created_at desc,id desc limit 100",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_disclosure_reviews where campground_id=$1 order by reviewed_at desc,id desc limit 100",
          [camp.id],
        ),
        client.query(
          `select p.id,p.application_id,p.principal_cents,p.drafted_by_user_id,c.buyer_display_name
     from public.permanent_unit_financing_term_proposals p
     join public.permanent_unit_financing_applications a on a.id=p.application_id
     join public.permanent_unit_sale_cases c on c.id=a.sale_case_id
     where p.campground_id=$1 order by p.drafted_at desc,p.id desc limit 100`,
          [camp.id],
        ),
        client.query(
          "select proposal_id,decision,reviewed_by_user_id from public.permanent_unit_financing_offer_authorizations where campground_id=$1",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_offer_delivery_consents where campground_id=$1 order by recorded_at desc,id desc limit 100",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_offer_delivery_signoffs where campground_id=$1 order by reviewed_at desc,id desc limit 100",
          [camp.id],
        ),
      ]);
    return {
      campground: camp,
      versions: versions.rows,
      reviews: reviews.rows,
      proposals: proposals.rows,
      authorizations: authorizations.rows,
      consents: consents.rows,
      signoffs: signoffs.rows,
    };
  });
}
export async function registerDisclosureVersion({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeDisclosureVersion(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_disclosure_versions
   (id,organization_id,campground_id,jurisdiction,version_code,document_reference,content_sha256,legal_review_reference,note,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.jurisdiction,
        v.versionCode,
        v.documentReference,
        v.sha256,
        v.legalReviewReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function reviewDisclosureVersion({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeDisclosureReview(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_disclosure_reviews
   (id,organization_id,campground_id,version_id,outcome,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.versionId,
        v.outcome,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordOfferDeliveryConsent({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeDeliveryConsent(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_offer_delivery_consents
   (id,organization_id,campground_id,proposal_id,version_id,consent_channel,consent_reference,recipient_reference,note,recorded_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.proposalId,
        v.versionId,
        v.channel,
        v.consentReference,
        v.recipientReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function signoffOfferHandoff({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeDeliverySignoff(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_offer_delivery_signoffs
   (id,organization_id,campground_id,consent_id,decision,review_reference,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.decision,
        v.reviewReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
