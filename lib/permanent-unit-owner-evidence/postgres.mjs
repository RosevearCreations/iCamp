import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  csvDigest,
  normalizeEvidenceExport,
  normalizeEvidenceSearch,
  renderEvidenceCsv,
} from "./core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL required for owner evidence search and export.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function owner(actor, campgroundId) {
  const authorization = await getCampgroundAuthorization(actor, campgroundId);
  if (
    !authorization?.roleCodes?.includes("owner_admin") ||
    !authorization.permissions?.includes("permanent_unit.transfer")
  )
    throw new Error(
      "Active Owner / Administrator finance permission required on both properties.",
    );
}
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(
      readOnly
        ? "begin isolation level repeatable read read only"
        : "begin isolation level repeatable read",
    );
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
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
const searchSql = `with evidence as (
 select r.id as resolution_id,r.plan_id,r.source_campground_id,r.target_campground_id,
 r.resolved_at,r.resolution_kind,r.evidence_reference as resolution_evidence_reference,
 latest.id as reassessment_id,latest.reviewed_at,latest.review_kind,
 latest.evidence_reference as review_evidence_reference,
 accepted.id as acceptance_id,accepted.accepted_at,
 accepted.evidence_reference as acceptance_evidence_reference,
 case when accepted.id is not null then 'accepted'
      when latest.id is null then 'awaiting_review'
      when latest.review_kind='resolution_supported' then 'supported_pending_acceptance'
      else 'revisit_needed' end as status
 from public.permanent_unit_finance_owner_handoff_resolutions r
 left join lateral (
   select id,reviewed_at,review_kind,evidence_reference
   from public.permanent_unit_finance_owner_resolution_reassessments v
   where v.resolution_id=r.id order by v.reviewed_at desc,v.id desc limit 1
 ) latest on true
 left join public.permanent_unit_finance_owner_resolution_acceptances accepted
   on accepted.resolution_id=r.id
 where r.source_campground_id=any($1::uuid[]) and r.target_campground_id=any($1::uuid[])
 and ($2::uuid is null or r.source_campground_id=$2::uuid)
 and ($3::uuid is null or r.target_campground_id=$3::uuid)
 and ($5::text='' or concat_ws(' ',r.evidence_reference,latest.evidence_reference,accepted.evidence_reference)
    ilike $6::text escape '\\')
 and ($7::date is null or r.resolved_at >= $7::date)
 and ($8::date is null or r.resolved_at < ($8::date + interval '1 day'))
 ) select * from evidence where ($4::text='all' or status=$4::text)
 order by resolved_at desc,resolution_id desc limit $9::integer offset $10::integer`;

function rowsFrom(result) {
  return result.rows.map((r) => ({
    resolutionId: r.resolution_id,
    planId: r.plan_id,
    sourceCampgroundId: r.source_campground_id,
    targetCampgroundId: r.target_campground_id,
    resolvedAt: r.resolved_at.toISOString(),
    resolutionKind: r.resolution_kind,
    resolutionEvidenceReference: r.resolution_evidence_reference,
    reassessmentId: r.reassessment_id,
    reviewedAt: r.reviewed_at?.toISOString() ?? null,
    reviewKind: r.review_kind,
    reviewEvidenceReference: r.review_evidence_reference,
    acceptanceId: r.acceptance_id,
    acceptedAt: r.accepted_at?.toISOString() ?? null,
    acceptanceEvidenceReference: r.acceptance_evidence_reference,
    status: r.status,
  }));
}
function searchArgs(ids, filter, limit, offset) {
  // Escape wildcard metacharacters; user text is a literal search, not a wildcard expression.
  const literal = filter.query
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return [
    ids,
    filter.sourceCampgroundId,
    filter.targetCampgroundId,
    filter.status,
    filter.query,
    `%${literal}%`,
    filter.from,
    filter.to,
    limit,
    offset,
  ];
}
export async function searchOwnerResolutionEvidence(
  actorUserId,
  authorizedIds,
  rawFilter,
) {
  const filter = normalizeEvidenceSearch(rawFilter);
  const ids = [...new Set(authorizedIds)].slice(0, 50);
  if (!ids.length)
    throw new Error("No authorized owner campground scope available.");
  await Promise.all(ids.map((id) => owner(actorUserId, id)));
  if (
    (filter.sourceCampgroundId && !ids.includes(filter.sourceCampgroundId)) ||
    (filter.targetCampgroundId && !ids.includes(filter.targetCampgroundId))
  )
    throw new Error("Selected campground is outside your active owner scope.");
  return transaction(actorUserId, true, async (client) => {
    const records = rowsFrom(
      await client.query(
        searchSql,
        searchArgs(ids, filter, 51, (filter.page - 1) * 50),
      ),
    );
    return {
      filter,
      rows: records.slice(0, 50),
      hasMore: records.length > 50,
      coverageCap: filter.page === 20,
    };
  });
}
export async function exportOwnerResolutionEvidence(actorUserId, rawInput) {
  const filter = normalizeEvidenceExport(rawInput);
  await Promise.all([
    owner(actorUserId, filter.sourceCampgroundId),
    owner(actorUserId, filter.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const rows = rowsFrom(
      await client.query(
        searchSql,
        searchArgs(
          [filter.sourceCampgroundId, filter.targetCampgroundId],
          filter,
          51,
          0,
        ),
      ),
    );
    if (rows.length === 0)
      throw new Error("There are no matching evidence records to export.");
    if (rows.length > 50)
      throw new Error(
        "This export exceeds 50 records. Narrow the date, status or evidence filter.",
      );
    const csv = renderEvidenceCsv(rows);
    const sha256 = csvDigest(csv);
    await client.query(
      `insert into public.permanent_unit_finance_owner_evidence_export_acceptances
        (id,source_campground_id,target_campground_id,search_status,search_query,date_from,date_to,
         export_row_count,export_sha256,evidence_reference,acceptance_note,accepted_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        filter.id,
        filter.sourceCampgroundId,
        filter.targetCampgroundId,
        filter.status,
        filter.query,
        filter.from,
        filter.to,
        rows.length,
        sha256,
        filter.evidenceReference,
        filter.acceptanceNote,
        actorUserId,
      ],
    );
    return { id: filter.id, csv, sha256, count: rows.length };
  });
}
export async function recentOwnerEvidenceExportAcceptances(
  actorUserId,
  sourceId,
  targetId,
) {
  if (!sourceId || !targetId) return [];
  await Promise.all([
    owner(actorUserId, sourceId),
    owner(actorUserId, targetId),
  ]);
  return transaction(actorUserId, true, async (client) => {
    const records = await client.query(
      `select id,export_row_count,export_sha256,evidence_reference,acceptance_note,accepted_at
       from public.permanent_unit_finance_owner_evidence_export_acceptances
       where source_campground_id=$1 and target_campground_id=$2
       order by accepted_at desc,id desc limit 10`,
      [sourceId, targetId],
    );
    return records.rows.map((r) => ({
      id: r.id,
      count: r.export_row_count,
      sha256: r.export_sha256,
      evidenceReference: r.evidence_reference,
      acceptanceNote: r.acceptance_note,
      acceptedAt: r.accepted_at.toISOString(),
    }));
  });
}
