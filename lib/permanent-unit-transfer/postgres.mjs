import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeSaleApplication,
  normalizeSaleEvidence,
  normalizeSaleDecision,
  normalizeSaleHandoff,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for sale transfers.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function closePermanentUnitTransferPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function authorized(userId, camp, key) {
  if (!(await hasCampgroundPermission(userId, camp, key)))
    throw new Error(`Not authorized for ${key}.`);
}
async function transaction(userId, campgroundId, key, work) {
  const camp = unitId(campgroundId, "Campground");
  await authorized(userId, camp, key);
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
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
export async function getSaleTransferDashboard(userId, campgroundId) {
  const camp = unitId(campgroundId, "Campground");
  if (
    !(
      await Promise.all([
        hasCampgroundPermission(userId, camp, "permanent_unit.manage"),
        hasCampgroundPermission(userId, camp, "permanent_unit.transfer"),
      ])
    ).some(Boolean)
  )
    throw new Error("Not authorized to read transfers.");
  return transaction(
    userId,
    camp,
    "permanent_unit.manage",
    async (client, property) => {
      const [cases, evidence, decisions, handoffs] = await Promise.all([
        client.query(
          "select * from public.permanent_unit_sale_cases where campground_id=$1 order by opened_at desc,id desc limit 100",
          [camp],
        ),
        client.query(
          "select * from public.permanent_unit_sale_evidence where campground_id=$1 order by recorded_at desc,id desc limit 1200",
          [camp],
        ),
        client.query(
          "select * from public.permanent_unit_sale_decisions where campground_id=$1 order by reviewed_at desc,id desc limit 150",
          [camp],
        ),
        client.query(
          "select * from public.permanent_unit_sale_handoffs where campground_id=$1 order by recorded_at desc,id desc limit 150",
          [camp],
        ),
      ]);
      return {
        campground: property,
        cases: cases.rows,
        evidence: evidence.rows,
        decisions: decisions.rows,
        handoffs: handoffs.rows,
      };
    },
  );
}
export async function openSaleTransfer({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeSaleApplication(input);
  return transaction(
    actorUserId,
    campgroundId,
    "permanent_unit.manage",
    async (client, camp) => {
      const source = await client.query(
        `select l.accommodation_id,l.ownership_event_id,i.buyer_display_name
   from public.permanent_unit_sale_listings l join public.permanent_unit_buyer_inquiries i on i.listing_id=l.id
   where l.id=$1 and i.id=$2 and l.campground_id=$3`,
        [v.listingId, v.inquiryId, camp.id],
      );
      if (!source.rows[0])
        throw new Error("Listing and buyer inquiry do not match.");
      const s = source.rows[0];
      const r = await client.query(
        `insert into public.permanent_unit_sale_cases
   (id,organization_id,campground_id,accommodation_id,listing_id,inquiry_id,seller_ownership_event_id,buyer_display_name,application_reference,application_note,opened_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          s.accommodation_id,
          v.listingId,
          v.inquiryId,
          s.ownership_event_id,
          s.buyer_display_name,
          v.applicationReference,
          v.applicationNote,
          actorUserId,
        ],
      );
      return r.rows[0].id;
    },
  );
}
export async function recordSaleEvidence({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeSaleEvidence(input);
  return transaction(
    actorUserId,
    campgroundId,
    "permanent_unit.manage",
    async (client, camp) => {
      const r = await client.query(
        `insert into public.permanent_unit_sale_evidence
   (id,organization_id,campground_id,case_id,step_key,outcome,source_reference,note,fee_amount_cents,recorded_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.caseId,
          v.stepKey,
          v.outcome,
          v.sourceReference,
          v.note,
          v.feeAmountCents,
          actorUserId,
        ],
      );
      return r.rows[0].id;
    },
  );
}
export async function reviewSaleTransfer({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeSaleDecision(input);
  return transaction(
    actorUserId,
    campgroundId,
    "permanent_unit.transfer",
    async (client, camp) => {
      const r = await client.query(
        `insert into public.permanent_unit_sale_decisions
   (id,organization_id,campground_id,case_id,decision,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.caseId,
          v.decision,
          v.note,
          actorUserId,
        ],
      );
      return r.rows[0].id;
    },
  );
}
export async function finalizeSaleTransfer({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeSaleHandoff(input);
  // New owner ledger creation and closing receipt must succeed in one transaction.
  await authorized(
    actorUserId,
    unitId(campgroundId, "Campground"),
    "permanent_unit.manage",
  );
  return transaction(
    actorUserId,
    campgroundId,
    "permanent_unit.transfer",
    async (client, camp) => {
      const caseResult = await client.query(
        "select * from public.permanent_unit_sale_cases where id=$1 and campground_id=$2",
        [v.caseId, camp.id],
      );
      const c = caseResult.rows[0];
      if (!c) throw new Error("Sale case unavailable.");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        ["icamp-permanent-unit-transfer:" + c.accommodation_id],
      );
      const decision = await client.query(
        "select * from public.permanent_unit_sale_decisions where case_id=$1",
        [c.id],
      );
      if (decision.rows[0]?.decision !== "approved")
        throw new Error("Independent approval is required.");
      if (
        actorUserId === c.opened_by_user_id ||
        actorUserId === decision.rows[0].reviewed_by_user_id
      )
        throw new Error("Closing operator must be independent.");
      if (camp.lifecycle_state !== "active")
        throw new Error("Inactive campground cannot close a sale.");
      const current = await client.query(
        "select id from public.permanent_unit_ownership_events where accommodation_id=$1 order by recorded_at desc,id desc limit 1 for update",
        [c.accommodation_id],
      );
      if (current.rows[0]?.id !== c.seller_ownership_event_id)
        throw new Error("Owner changed since the application.");
      if (
        (
          await client.query(
            "select id from public.permanent_unit_sale_handoffs where case_id=$1",
            [c.id],
          )
        ).rowCount
      )
        throw new Error("Sale already closed.");
      await client.query(
        `insert into public.permanent_unit_ownership_events
    (id,organization_id,campground_id,accommodation_id,event_kind,owner_display_name,evidence_reference,notes,recorded_by_user_id)
    values($1,$2,$3,$4,'owner_recorded',$5,$6,$7,$8)`,
        [
          v.newOwnershipEventId,
          camp.organization_id,
          camp.id,
          c.accommodation_id,
          c.buyer_display_name,
          v.closingReference,
          `Build 092 approved sale case ${c.id}; documented unit ownership handoff only.`,
          actorUserId,
        ],
      );
      const result = await client.query(
        `insert into public.permanent_unit_sale_handoffs
    (id,organization_id,campground_id,case_id,new_ownership_event_id,agreement_reference,closing_reference,note,recorded_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [
          v.id,
          camp.organization_id,
          camp.id,
          v.caseId,
          v.newOwnershipEventId,
          v.agreementReference,
          v.closingReference,
          v.note,
          actorUserId,
        ],
      );
      return result.rows[0].id;
    },
  );
}
