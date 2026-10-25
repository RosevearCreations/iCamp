import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeOwnership,
  normalizeListing,
  normalizeInquiry,
  unitId,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL is required for permanent-unit operations.",
      );
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function closePermanentUnitPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function withScope(userId, campgroundId, work) {
  const camp = unitId(campgroundId, "Campground");
  if (!(await hasCampgroundPermission(userId, camp, "permanent_unit.manage")))
    throw new Error("Not authorized to manage permanent units.");
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
export async function getPermanentUnitMarket(userId, campgroundId) {
  return withScope(userId, campgroundId, async (client, camp) => {
    const [units, ownership, listings, inquiries] = await Promise.all([
      client.query(
        "select a.id,a.code,a.display_name,a.lifecycle_state from public.permanent_units p join public.accommodations a on a.id=p.accommodation_id where p.campground_id=$1 order by a.code limit 350",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_ownership_events where campground_id=$1 order by recorded_at desc,id desc limit 600",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_sale_listings where campground_id=$1 order by created_at desc,id desc limit 350",
        [camp.id],
      ),
      client.query(
        "select * from public.permanent_unit_buyer_inquiries where campground_id=$1 order by received_at desc,id desc limit 500",
        [camp.id],
      ),
    ]);
    return {
      campground: camp,
      units: units.rows,
      ownership: ownership.rows,
      listings: listings.rows,
      inquiries: inquiries.rows,
    };
  });
}
export async function recordPermanentUnitOwner({
  actorUserId,
  campgroundId,
  ...input
}) {
  const value = normalizeOwnership(input);
  return withScope(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_ownership_events
   (id,organization_id,campground_id,accommodation_id,event_kind,owner_display_name,evidence_reference,notes,recorded_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        value.id,
        camp.organization_id,
        camp.id,
        value.accommodationId,
        value.eventKind,
        value.ownerDisplayName,
        value.evidenceReference,
        value.notes,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function draftPermanentUnitListing({
  actorUserId,
  campgroundId,
  ...input
}) {
  const value = normalizeListing(input);
  return withScope(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_sale_listings
   (id,organization_id,campground_id,accommodation_id,ownership_event_id,headline,description,asking_price_cents,created_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        value.id,
        camp.organization_id,
        camp.id,
        value.accommodationId,
        value.ownershipEventId,
        value.headline,
        value.description,
        value.askingPriceCents,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function reviewPermanentUnitListing({
  actorUserId,
  campgroundId,
  listingId,
  decision,
  note,
}) {
  const listing = unitId(listingId, "Listing");
  if (!["approved", "withdrawn"].includes(decision))
    throw new Error("Review must approve or withdraw.");
  const reviewNote = String(note ?? "").trim();
  if (reviewNote.length < 12 || reviewNote.length > 1200)
    throw new Error("Review note must be 12–1200 characters.");
  return withScope(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `update public.permanent_unit_sale_listings
   set listing_status=$1,approval_note=$2,approved_by_user_id=$3,reviewed_at=clock_timestamp()
   where id=$4 and campground_id=$5 and listing_status='draft' and created_by_user_id<>$3
   returning id`,
      [decision, reviewNote, actorUserId, listing, camp.id],
    );
    if (!r.rowCount)
      throw new Error("Draft not found or independent reviewer required.");
    return r.rows[0].id;
  });
}
export async function recordPermanentUnitInquiry({
  actorUserId,
  campgroundId,
  ...input
}) {
  const value = normalizeInquiry(input);
  return withScope(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_buyer_inquiries
   (id,organization_id,campground_id,listing_id,buyer_display_name,contact_reference,inquiry_note,received_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        value.id,
        camp.organization_id,
        camp.id,
        value.listingId,
        value.buyerDisplayName,
        value.contactReference,
        value.inquiryNote,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
