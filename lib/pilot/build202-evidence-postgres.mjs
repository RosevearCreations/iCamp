import pg from "pg";
import { randomUUID } from "node:crypto";
import {
  hasCampgroundPermission,
  listAssignedCampgrounds,
} from "../authz/postgres.mjs";
import {
  build202EvidenceReadback,
  validateBuild202Evidence,
} from "./build202-evidence.mjs";

let pool;
function database() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("PILOT202_DATABASE_UNAVAILABLE");
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
    const value = await work(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
export async function build202AuthorizedCampgrounds(actor) {
  const assigned = await listAssignedCampgrounds(actor);
  const checks = await Promise.all(
    assigned.slice(0, 60).map(async (item) => ({
      ...item,
      canReview: await hasCampgroundPermission(
        actor,
        item.campgroundId,
        "pilot.evidence.review",
      ),
      canIntake: await hasCampgroundPermission(
        actor,
        item.campgroundId,
        "pilot.evidence.intake",
      ),
    })),
  );
  return checks.filter((item) => item.canReview);
}
export async function listBuild202Evidence(actor, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      actor,
      campgroundId,
      "pilot.evidence.review",
    ))
  )
    throw new Error("PILOT202_REVIEW_PERMISSION_DENIED");
  const result = await transaction(actor, true, (client) =>
    client.query(
      `select id,source_class,evidence_ref,claimed_sha256,device_profile,created_at
       from icamp_private.pilot202_evidence_intake
       where campground_id=$1 order by created_at desc,id desc limit 100`,
      [campgroundId],
    ),
  );
  return build202EvidenceReadback(result.rows);
}
export async function submitBuild202Evidence(actor, raw) {
  const value = validateBuild202Evidence(raw);
  if (
    !(await hasCampgroundPermission(
      actor,
      value.campgroundId,
      "pilot.evidence.intake",
    ))
  )
    throw new Error("PILOT202_INTAKE_PERMISSION_DENIED");
  const result = await transaction(actor, false, (client) =>
    client.query(
      `insert into icamp_private.pilot202_evidence_intake
       (id,organization_id,campground_id,actor_user_id,source_class,evidence_ref,claimed_sha256,device_profile)
       select $1,c.organization_id,c.id,$2,$3,$4,$5,$6 from public.campgrounds c where c.id=$7
       returning id,created_at`,
      [
        randomUUID(),
        actor,
        value.sourceClass,
        value.evidenceRef,
        value.claimedSha256,
        value.deviceProfile,
        value.campgroundId,
      ],
    ),
  );
  if (result.rowCount !== 1) throw new Error("PILOT202_CAMPGROUND_NOT_FOUND");
  return {
    id: result.rows[0].id,
    submittedAt: result.rows[0].created_at.toISOString(),
    disposition: "SUBMITTED_UNVERIFIED",
    connection_state: "DISCONNECTED / HOLD",
  };
}
