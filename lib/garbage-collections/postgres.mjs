import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeCollectionProof,
  normalizeCollectionRoute,
  normalizeFinanceReview,
} from "./core.mjs";
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is required.");
    pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
async function scopedTransaction(userId, campgroundId, permissionKey, work) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey)))
    throw new Error(`Not authorized for ${permissionKey}.`);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await client.query(
      "select organization_id from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
      [campgroundId],
    );
    if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
    const value = await work(client, result.rows[0].organization_id);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getCollectionOperations(userId, campgroundId) {
  return scopedTransaction(
    userId,
    campgroundId,
    "garbage.read",
    async (client) => {
      const [routes, proofs, pickups] = await Promise.all([
        client.query(
          `select * from public.garbage_collection_routes where campground_id=$1
     order by service_date desc,created_at desc limit 100`,
          [campgroundId],
        ),
        client.query(
          `select e.*,a.code as accommodation_code from public.garbage_collection_proofs e
     join public.garbage_pickup_requests p on p.id=e.pickup_id
     join public.accommodations a on a.id=p.accommodation_id
     where e.campground_id=$1 order by e.recorded_at desc limit 150`,
          [campgroundId],
        ),
        client.query(
          `select p.id,p.stream,p.state,p.service_mode,a.code as accommodation_code
     from public.garbage_pickup_requests p join public.accommodations a on a.id=p.accommodation_id
     where p.campground_id=$1 and p.state in ('scheduled','in_progress','completed')
     order by p.created_at desc limit 200`,
          [campgroundId],
        ),
      ]);
      return {
        routes: routes.rows,
        proofs: proofs.rows,
        pickups: pickups.rows,
      };
    },
  );
}
export async function createCollectionRoute({
  actorUserId,
  campgroundId,
  ...input
}) {
  const route = normalizeCollectionRoute(input);
  return scopedTransaction(
    actorUserId,
    campgroundId,
    "garbage.routes.manage",
    async (client, orgId) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        [`garbage-route:${campgroundId}:${route.clientRouteId}`],
      );
      const prior = await client.query(
        "select * from public.garbage_collection_routes where campground_id=$1 and client_route_id=$2",
        [campgroundId, route.clientRouteId],
      );
      if (prior.rowCount) {
        const row = prior.rows[0];
        if (
          row.name !== route.name ||
          row.stream !== route.stream ||
          new Date(row.service_date).toISOString().slice(0, 10) !==
            route.serviceDate ||
          row.route_note !== route.note
        )
          throw new Error(
            "Route retry ID is already used with different details.",
          );
        return row;
      }
      const created = await client.query(
        `insert into public.garbage_collection_routes
    (organization_id,campground_id,client_route_id,name,stream,service_date,route_note,created_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [
          orgId,
          campgroundId,
          route.clientRouteId,
          route.name,
          route.stream,
          route.serviceDate,
          route.note,
          actorUserId,
        ],
      );
      return created.rows[0];
    },
  );
}
export async function recordCollectionProof({
  actorUserId,
  campgroundId,
  ...input
}) {
  const proof = normalizeCollectionProof(input);
  return scopedTransaction(
    actorUserId,
    campgroundId,
    "garbage.routes.manage",
    async (client, orgId) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        [`garbage-proof:${campgroundId}:${proof.routeId}:${proof.pickupId}`],
      );
      const prior = await client.query(
        "select * from public.garbage_collection_proofs where route_id=$1 and pickup_id=$2",
        [proof.routeId, proof.pickupId],
      );
      if (prior.rowCount) {
        const row = prior.rows[0];
        if (
          row.outcome !== proof.outcome ||
          row.bag_count !== proof.bagCount ||
          row.note !== proof.note ||
          row.evidence_reference !== proof.evidenceReference
        )
          throw new Error(
            "This pickup already has different proof for this route.",
          );
        return row;
      }
      const route = await client.query(
        "select stream from public.garbage_collection_routes where id=$1 and campground_id=$2",
        [proof.routeId, campgroundId],
      );
      const pickup = await client.query(
        "select stream,state from public.garbage_pickup_requests where id=$1 and campground_id=$2",
        [proof.pickupId, campgroundId],
      );
      if (
        route.rowCount !== 1 ||
        pickup.rowCount !== 1 ||
        route.rows[0].stream !== pickup.rows[0].stream
      )
        throw new Error(
          "Route and pickup must exist in the same campground and stream.",
        );
      if (
        pickup.rows[0].state === "cancelled" ||
        (proof.outcome === "collected" &&
          !["in_progress", "completed"].includes(pickup.rows[0].state))
      )
        throw new Error(
          "Collection requires an in-progress or completed, non-cancelled pickup.",
        );
      const recorded = await client.query(
        `insert into public.garbage_collection_proofs
   (organization_id,campground_id,route_id,pickup_id,outcome,bag_count,note,evidence_reference,recorded_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          orgId,
          campgroundId,
          proof.routeId,
          proof.pickupId,
          proof.outcome,
          proof.bagCount,
          proof.note,
          proof.evidenceReference,
          actorUserId,
        ],
      );
      return recorded.rows[0];
    },
  );
}
export async function getGarbageFinanceReview(userId, campgroundId) {
  return scopedTransaction(
    userId,
    campgroundId,
    "garbage.finance.reconcile",
    async (client) => {
      const [tags, reviews] = await Promise.all([
        client.query(
          `select t.id,t.tag_code,t.stream,t.price_cents,t.receipt_reference,t.redeemed_at,
     a.code as accommodation_code from public.garbage_paid_tags t
     join public.accommodations a on a.id=t.accommodation_id
     where t.campground_id=$1 order by t.issued_at desc limit 200`,
          [campgroundId],
        ),
        client.query(
          `select * from public.garbage_tag_finance_reviews where campground_id=$1
     order by reviewed_at desc limit 250`,
          [campgroundId],
        ),
      ]);
      return { tags: tags.rows, reviews: reviews.rows };
    },
  );
}
export async function recordGarbageFinanceReview({
  actorUserId,
  campgroundId,
  ...input
}) {
  const review = normalizeFinanceReview(input);
  return scopedTransaction(
    actorUserId,
    campgroundId,
    "garbage.finance.reconcile",
    async (client, orgId) => {
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1,0))",
        [`garbage-review:${campgroundId}:${review.clientReviewId}`],
      );
      const prior = await client.query(
        "select * from public.garbage_tag_finance_reviews where campground_id=$1 and client_review_id=$2",
        [campgroundId, review.clientReviewId],
      );
      if (prior.rowCount) {
        const row = prior.rows[0];
        if (
          row.tag_id !== review.tagId ||
          row.decision !== review.decision ||
          row.checked_amount_cents !== review.checkedAmountCents ||
          row.note !== review.note
        )
          throw new Error(
            "Review retry ID is already used with different details.",
          );
        return row;
      }
      const tagResult = await client.query(
        "select price_cents,receipt_reference from public.garbage_paid_tags where id=$1 and campground_id=$2",
        [review.tagId, campgroundId],
      );
      if (!tagResult.rowCount)
        throw new Error("Tag does not belong to this campground.");
      const tag = tagResult.rows[0];
      if (
        review.decision === "receipt_matched" &&
        Number(tag.price_cents) !== review.checkedAmountCents
      )
        throw new Error(
          "Verified amount must match the tag's original sale price.",
        );
      const recorded = await client.query(
        `insert into public.garbage_tag_finance_reviews
   (organization_id,campground_id,client_review_id,tag_id,decision,checked_amount_cents,
    receipt_reference_snapshot,note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          orgId,
          campgroundId,
          review.clientReviewId,
          review.tagId,
          review.decision,
          review.checkedAmountCents,
          tag.receipt_reference,
          review.note,
          actorUserId,
        ],
      );
      return recorded.rows[0];
    },
  );
}
