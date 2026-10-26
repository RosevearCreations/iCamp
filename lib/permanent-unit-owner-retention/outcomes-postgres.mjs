import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeOwnerReassessmentOutcome,
  normalizeOwnerOutcomeAcceptance,
} from "./outcomes-core.mjs";

let pool;
function db() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required for owner audit outcomes.");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  }));
}
async function authorize(actor, source, target) {
  const grants = await Promise.all(
    [source, target].map((id) => getCampgroundAuthorization(actor, id)),
  );
  if (
    source === target ||
    grants.some(
      (g) =>
        !g?.roleCodes?.includes("owner_admin") ||
        !g.permissions?.includes("permanent_unit.transfer"),
    )
  )
    throw new Error(
      "Active Owner / Administrator finance access to both campgrounds is required.",
    );
}
async function transact(actor, readOnly, work) {
  const client = await db().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("set local statement_timeout = '15000ms'");
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
export async function getOwnerReassessmentOutcomes(actor, source, target) {
  await authorize(actor, source, target);
  return transact(actor, true, async (client) => {
    const [reassessments, outcomes, acceptances] = await Promise.all([
      client.query(
        `select a.id,a.decision_id,a.assessment_kind,a.reassessed_at from public.owner_export_oversight_reassessments a
       where a.source_campground_id=$1 and a.target_campground_id=$2 order by a.reassessed_at desc,a.id desc limit 101`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reassessment_outcomes where source_campground_id=$1 and target_campground_id=$2 order by recorded_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_outcome_acceptances where source_campground_id=$1 and target_campground_id=$2 order by accepted_at desc,id desc limit 151`,
        [source, target],
      ),
    ]);
    return {
      reassessments: reassessments.rows.slice(0, 100),
      outcomes: outcomes.rows.slice(0, 150),
      acceptances: acceptances.rows.slice(0, 150),
      limited:
        reassessments.rows.length > 100 ||
        outcomes.rows.length > 150 ||
        acceptances.rows.length > 150,
    };
  });
}
export async function recordOwnerReassessmentOutcome({ actorUserId, ...raw }) {
  const value = normalizeOwnerReassessmentOutcome(raw);
  await authorize(
    actorUserId,
    value.sourceCampgroundId,
    value.targetCampgroundId,
  );
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_reassessment_outcomes
     (id,reassessment_id,source_campground_id,target_campground_id,outcome_kind,evidence_reference,outcome_note,recorded_by_user_id)
     values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        value.id,
        value.reassessmentId,
        value.sourceCampgroundId,
        value.targetCampgroundId,
        value.outcomeKind,
        value.evidenceReference,
        value.outcomeNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
export async function recordIndependentOwnerOutcomeAcceptance({
  actorUserId,
  ...raw
}) {
  const value = normalizeOwnerOutcomeAcceptance(raw);
  await authorize(
    actorUserId,
    value.sourceCampgroundId,
    value.targetCampgroundId,
  );
  return transact(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_outcome_acceptances
     (id,outcome_id,source_campground_id,target_campground_id,acceptance_kind,audit_note,accepted_by_user_id)
     values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        value.id,
        value.outcomeId,
        value.sourceCampgroundId,
        value.targetCampgroundId,
        value.acceptanceKind,
        value.auditNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
