import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeFinancingApplication,
  normalizeFinancingEvidence,
  normalizeFinancingTriage,
} from "./core.mjs";

let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeFinancingPoolForTests() {
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
    throw new Error("Not authorized for private financing intake.");
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
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
export async function getFinancingDashboard(actorUserId, campgroundId) {
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const [cases, applications, evidence, triage] = await Promise.all([
      client.query(
        "select id,buyer_display_name,accommodation_id,application_reference from public.permanent_unit_sale_cases where campground_id=$1 order by opened_at desc,id desc limit 100",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_financing_applications where campground_id=$1 order by opened_at desc,id desc limit 100",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_financing_evidence where campground_id=$1 order by recorded_at desc,id desc limit 1000",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_financing_triage where campground_id=$1 order by reviewed_at desc,id desc limit 100",
        [camp.id],
      ),
    ]);
    return {
      campground: camp,
      cases: cases.rows,
      applications: applications.rows,
      evidence: evidence.rows,
      triage: triage.rows,
    };
  });
}
export async function openFinancingApplication({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFinancingApplication(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_financing_applications
      (id,organization_id,campground_id,sale_case_id,requested_amount_cents,applicant_contact_reference,consent_reference,purpose_note,consent_attested,opened_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,true,$9) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.caseId,
        v.requestedAmountCents,
        v.applicantContactReference,
        v.consentReference,
        v.purposeNote,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordFinancingEvidence({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFinancingEvidence(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_financing_evidence
      (id,organization_id,campground_id,application_id,document_type,outcome,source_reference,note,recorded_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.applicationId,
        v.documentType,
        v.outcome,
        v.sourceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function triageFinancingApplication({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFinancingTriage(input);
  return transaction(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_financing_triage
      (id,organization_id,campground_id,application_id,decision,note,reviewed_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.applicationId,
        v.decision,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
