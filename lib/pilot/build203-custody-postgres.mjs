import pg from "pg";
import { randomUUID } from "node:crypto";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "../authz/postgres.mjs";
import { build202EvidenceReadback } from "./build202-evidence.mjs";
import {
  build203ReviewReadback,
  validateBuild203Custody,
  validateBuild203OwnerIntent,
} from "./build203-custody.mjs";

let pool;
function database() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("PILOT203_DATABASE_UNAVAILABLE");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local statement_timeout = '5000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function build203AuthorizedCampgrounds(actor) {
  const assigned = await listAssignedCampgrounds(actor);
  const checked = await Promise.all(
    assigned.slice(0, 60).map(async (campground) => ({
      ...campground,
      canReview: await hasCampgroundPermission(
        actor,
        campground.campgroundId,
        "pilot.custody.reconcile",
      ),
      canAuthorize: await hasCampgroundPermission(
        actor,
        campground.campgroundId,
        "pilot.test.authorize",
      ),
    })),
  );
  return checked.filter((item) => item.canReview);
}
export async function listBuild203Review(actor, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      actor,
      campgroundId,
      "pilot.custody.reconcile",
    ))
  )
    throw new Error("PILOT203_REVIEW_DENIED");
  const result = await transaction(actor, true, async (client) => {
    const evidence = await client.query(
      `select id,source_class,evidence_ref,claimed_sha256,device_profile,created_at
       from icamp_private.pilot202_evidence_intake
       where campground_id=$1 order by created_at desc,id desc limit 100`,
      [campgroundId],
    );
    const reviews = await client.query(
      `select r.id,r.evidence_id,r.issuer_receipt_ref,r.issuer_claimed_sha256,
          r.created_at,e.claimed_sha256 as source_claimed_sha256
       from icamp_private.pilot203_custody_reviews r
       join icamp_private.pilot202_evidence_intake e on e.id=r.evidence_id
       where r.campground_id=$1 order by r.created_at desc,r.id desc limit 100`,
      [campgroundId],
    );
    const owner = await client.query(
      `select id,custody_review_id,decision,expires_at,created_at
       from icamp_private.pilot203_owner_test_actions
       where campground_id=$1 order by created_at desc,id desc limit 100`,
      [campgroundId],
    );
    return {
      evidence: evidence.rows,
      reviews: reviews.rows,
      owner: owner.rows,
    };
  });
  return build203ReviewReadback(
    build202EvidenceReadback(result.evidence).rows,
    result.reviews,
    result.owner,
  );
}
export async function recordBuild203Custody(actor, raw) {
  const value = validateBuild203Custody(raw);
  if (
    !(await hasCampgroundPermission(
      actor,
      value.campgroundId,
      "pilot.custody.reconcile",
    ))
  )
    throw new Error("PILOT203_REVIEW_DENIED");
  const result = await transaction(actor, false, (client) =>
    client.query(
      `insert into icamp_private.pilot203_custody_reviews
     (id,organization_id,campground_id,evidence_id,actor_user_id,issuer_receipt_ref,issuer_claimed_sha256)
     select $1,e.organization_id,e.campground_id,e.id,$2,$3,$4
     from icamp_private.pilot202_evidence_intake e
     where e.id=$5 and e.campground_id=$6 and e.actor_user_id<>$2
     returning id,created_at`,
      [
        randomUUID(),
        actor,
        value.issuerReceiptRef,
        value.issuerClaimedSha256,
        value.evidenceId,
        value.campgroundId,
      ],
    ),
  );
  if (result.rowCount !== 1)
    throw new Error("PILOT203_SOURCE_SCOPE_OR_INDEPENDENCE_MISSING");
  return {
    id: result.rows[0].id,
    submittedAt: result.rows[0].created_at.toISOString(),
    disposition: "TWO_SOURCE_CLAIMS_UNVERIFIED",
    connection_state: "DISCONNECTED / HOLD",
  };
}
export async function recordBuild203OwnerIntent(actor, raw) {
  const value = validateBuild203OwnerIntent(raw);
  if (
    !(await hasCampgroundPermission(
      actor,
      value.campgroundId,
      "pilot.test.authorize",
    ))
  )
    throw new Error("PILOT203_OWNER_PERMISSION_DENIED");
  const result = await transaction(actor, false, (client) =>
    client.query(
      `insert into icamp_private.pilot203_owner_test_actions
     (id,organization_id,campground_id,custody_review_id,actor_user_id,
      request_id,decision,expires_at,scope_acknowledged)
     select $1,r.organization_id,r.campground_id,r.id,$2,$3,$4,$5,$6
     from icamp_private.pilot203_custody_reviews r
     where r.id=$7 and r.campground_id=$8 returning id,created_at`,
      [
        randomUUID(),
        actor,
        value.requestId,
        value.decision,
        value.expiresAt,
        value.scopeAcknowledged,
        value.custodyReviewId,
        value.campgroundId,
      ],
    ),
  );
  if (result.rowCount !== 1) throw new Error("PILOT203_REVIEW_SCOPE_MISSING");
  return {
    id: result.rows[0].id,
    submittedAt: result.rows[0].created_at.toISOString(),
    disposition: "LOCAL_OWNER_INTENT_ONLY",
    connection_state: "DISCONNECTED / HOLD",
  };
}
