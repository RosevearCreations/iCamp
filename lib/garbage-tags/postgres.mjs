import { randomBytes } from "node:crypto";
import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { normalizeTagCode, normalizeTagSale } from "./core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}
async function transaction(userId, campgroundId, permissionKey, work) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey)))
    throw new Error(`Not authorized for ${permissionKey}.`);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const campground = await client.query(
      "select organization_id from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Campground is unavailable.");
    const result = await work(client, campground.rows[0].organization_id);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
export async function listGarbageTags(userId, campgroundId) {
  return transaction(userId, campgroundId, "garbage.read", async (client) => {
    const [tags, sites, pickups] = await Promise.all([
      client.query(
        `select t.*,a.code as accommodation_code from public.garbage_paid_tags t
        join public.accommodations a on a.id=t.accommodation_id
        where t.campground_id=$1 order by t.issued_at desc limit 100`,
        [campgroundId],
      ),
      client.query(
        `select id,code from public.accommodations
        where campground_id=$1 and lifecycle_state<>'archived' order by code limit 500`,
        [campgroundId],
      ),
      client.query(
        `select p.id,p.stream,p.accommodation_id,p.reservation_id,p.state,
        a.code as accommodation_code from public.garbage_pickup_requests p
        join public.accommodations a on a.id=p.accommodation_id
        where p.campground_id=$1 and p.service_mode='paid_on_demand'
        and p.state not in ('completed','cancelled') order by p.created_at desc limit 100`,
        [campgroundId],
      ),
    ]);
    return { tags: tags.rows, sites: sites.rows, pickups: pickups.rows };
  });
}
export async function issueGarbageTag({
  actorUserId,
  campgroundId,
  accommodationId,
  reservationId,
  ...saleInput
}) {
  const sale = normalizeTagSale(saleInput);
  return transaction(
    actorUserId,
    campgroundId,
    "garbage.tags.sell",
    async (client, organizationId) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        [`tag-sale:${campgroundId}:${sale.saleId}`],
      );
      const prior = await client.query(
        "select * from public.garbage_paid_tags where campground_id=$1 and sale_id=$2",
        [campgroundId, sale.saleId],
      );
      if (prior.rowCount) {
        const tag = prior.rows[0];
        if (
          tag.stream !== sale.stream ||
          Number(tag.price_cents) !== sale.priceCents ||
          tag.receipt_reference !== sale.receipt ||
          tag.accommodation_id !== accommodationId ||
          tag.reservation_id !== (reservationId || null)
        )
          throw new Error("Sale retry ID already belongs to another sale.");
        return tag;
      }
      const site = await client.query(
        "select id from public.accommodations where campground_id=$1 and id=$2 and lifecycle_state<>'archived'",
        [campgroundId, accommodationId],
      );
      if (!site.rowCount) throw new Error("Select an active campground site.");
      if (reservationId) {
        const stay = await client.query(
          "select id from public.reservations where campground_id=$1 and accommodation_id=$2 and id=$3 and status='checked_in'",
          [campgroundId, accommodationId, reservationId],
        );
        if (!stay.rowCount)
          throw new Error("Reservation must be checked in at this site.");
      }
      const code = `GT-${randomBytes(12).toString("hex").toUpperCase()}`;
      const result = await client.query(
        `insert into public.garbage_paid_tags
      (organization_id,campground_id,sale_id,tag_code,stream,price_cents,receipt_reference,
       accommodation_id,reservation_id,issued_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          organizationId,
          campgroundId,
          sale.saleId,
          code,
          sale.stream,
          sale.priceCents,
          sale.receipt,
          accommodationId,
          reservationId || null,
          actorUserId,
        ],
      );
      return result.rows[0];
    },
  );
}
export async function redeemGarbageTag({
  actorUserId,
  campgroundId,
  tagCode,
  pickupId,
}) {
  const code = normalizeTagCode(tagCode);
  return transaction(
    actorUserId,
    campgroundId,
    "garbage.tags.redeem",
    async (client) => {
      const tagResult = await client.query(
        "select * from public.garbage_paid_tags where campground_id=$1 and tag_code=$2 for update",
        [campgroundId, code],
      );
      if (!tagResult.rowCount)
        throw new Error("Tag does not belong to this campground.");
      const tag = tagResult.rows[0];
      if (tag.redeemed_at) {
        if (tag.redeemed_pickup_id === pickupId) return tag;
        throw new Error("Tag was already redeemed for another pickup.");
      }
      const pickup = await client.query(
        `select id,stream,accommodation_id,reservation_id,state,service_mode
      from public.garbage_pickup_requests where id=$1 and campground_id=$2 for update`,
        [pickupId, campgroundId],
      );
      if (!pickup.rowCount)
        throw new Error("Pickup does not belong to this campground.");
      const p = pickup.rows[0];
      if (
        p.service_mode !== "paid_on_demand" ||
        p.stream !== tag.stream ||
        p.accommodation_id !== tag.accommodation_id ||
        p.reservation_id !== tag.reservation_id ||
        ["completed", "cancelled"].includes(p.state)
      )
        throw new Error(
          "Tag and open paid pickup must match stream, site and reservation.",
        );
      const updated = await client.query(
        `update public.garbage_paid_tags set
      redeemed_pickup_id=$1,redeemed_by_user_id=$2,redeemed_at=now() where id=$3 returning *`,
        [pickupId, actorUserId, tag.id],
      );
      return updated.rows[0];
    },
  );
}
