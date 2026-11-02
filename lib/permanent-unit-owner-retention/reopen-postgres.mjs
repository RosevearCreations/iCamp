import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { normalizeAcceptanceExceptionReview } from "./reopen-core.mjs";
let pool;
function database() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required for owner exception monitoring.");
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
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
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
export async function getAcceptanceExceptionReviewReport(
  actor,
  source,
  target,
) {
  await authorize(actor, source, target);
  return transaction(actor, true, async (client) => {
    const [candidates, reviews] = await Promise.all([
      client.query(
        `select a.id,a.accepted_at,a.accepted_by_user_id,o.outcome_kind,r.review_id,
    (select count(*)::int from public.owner_export_exception_cases c
     where c.source_campground_id=a.source_campground_id and c.target_campground_id=a.target_campground_id
       and c.opened_at>a.accepted_at
       and (v.issue_kind='all' or c.issue_kind=v.issue_kind)) as new_case_count
    from public.owner_export_outcome_acceptances a
    join public.owner_export_reassessment_outcomes o on o.id=a.outcome_id
    join public.owner_export_oversight_reassessments r on r.id=o.reassessment_id
    join public.owner_export_oversight_reviews v on v.id=r.review_id
    where a.source_campground_id=$1 and a.target_campground_id=$2 and a.acceptance_kind='accepted'
    order by a.accepted_at desc,a.id desc limit 101`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_acceptance_exception_reviews
    where source_campground_id=$1 and target_campground_id=$2
    order by reviewed_at desc,id desc limit 151`,
        [source, target],
      ),
    ]);
    return {
      candidates: candidates.rows.slice(0, 100),
      reviews: reviews.rows.slice(0, 150),
      limited: candidates.rows.length > 100 || reviews.rows.length > 150,
    };
  });
}
export async function recordAcceptanceExceptionReview({ actorUserId, ...raw }) {
  const value = normalizeAcceptanceExceptionReview(raw);
  await authorize(
    actorUserId,
    value.sourceCampgroundId,
    value.targetCampgroundId,
  );
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.owner_export_acceptance_exception_reviews
   (id,acceptance_id,source_campground_id,target_campground_id,review_kind,evidence_reference,review_note,reviewed_by_user_id)
   values($1,$2,$3,$4,$5,$6,$7,$8) returning id,observed_unclosed_cases,cases_since_acceptance`,
      [
        value.id,
        value.acceptanceId,
        value.sourceCampgroundId,
        value.targetCampgroundId,
        value.reviewKind,
        value.evidenceReference,
        value.reviewNote,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
