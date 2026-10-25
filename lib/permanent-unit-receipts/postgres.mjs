import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeManualReceipt,
  normalizeApplicantResponse,
  normalizeExceptionEvent,
} from "./core.mjs";

let pool;
function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL is required for private delivery receipts.",
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
async function scoped(actorUserId, campgroundId, operation) {
  const campId = unitId(campgroundId, "Campground");
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campId,
      "permanent_unit.transfer",
    ))
  )
    throw new Error("Not authorized for private manual delivery evidence.");
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
    const result = await operation(client, rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function getReceiptDashboard(actorUserId, campgroundId) {
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const [consents, signoffs, receipts, responses, exceptions] =
      await Promise.all([
        client.query(
          `select c.id,c.proposal_id,c.version_id,c.consent_channel,c.recipient_reference,p.application_id,s.buyer_display_name,v.version_code,v.content_sha256
        from public.permanent_unit_offer_delivery_consents c
        join public.permanent_unit_financing_term_proposals p on p.id=c.proposal_id
        join public.permanent_unit_financing_applications a on a.id=p.application_id
        join public.permanent_unit_sale_cases s on s.id=a.sale_case_id
        join public.permanent_unit_disclosure_versions v on v.id=c.version_id
        where c.campground_id=$1 order by c.recorded_at desc limit 100`,
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_offer_delivery_signoffs where campground_id=$1",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_manual_delivery_receipts where campground_id=$1 order by recorded_at desc limit 100",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_applicant_acknowledgements where campground_id=$1 order by recorded_at desc limit 100",
          [camp.id],
        ),
        client.query(
          "select * from public.permanent_unit_delivery_exception_events where campground_id=$1 order by recorded_at desc,id desc limit 300",
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
    };
  });
}
export async function recordManualReceipt({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeManualReceipt(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_manual_delivery_receipts
      (id,organization_id,campground_id,consent_id,signoff_id,channel,delivered_at,evidence_reference,recipient_verification_reference,note,recorded_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.signoffId,
        v.channel,
        v.deliveredAt,
        v.evidenceReference,
        v.recipientVerificationReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordApplicantResponse({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeApplicantResponse(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_applicant_acknowledgements
      (id,organization_id,campground_id,receipt_id,response,response_at,evidence_reference,note,recorded_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.receiptId,
        v.response,
        v.responseAt,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordDeliveryException({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeExceptionEvent(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_delivery_exception_events
      (id,organization_id,campground_id,consent_id,event_type,reason_code,evidence_reference,note,recorded_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.consentId,
        v.eventType,
        v.reasonCode,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
