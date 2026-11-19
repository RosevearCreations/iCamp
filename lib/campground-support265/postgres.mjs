import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizedCustody265,
  normalizedGuestAcknowledgment265,
  normalizedSupervision265,
  normalizedSupport265,
  classifyCampgroundSupport265,
} from "./core.mjs";

const { Pool } = pg;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;
function originalPool() {
  if (!pool) {
    const c = process.env.DATABASE_URL?.trim();
    if (!c) throw Error("Original campground PostgreSQL unavailable.");
    pool = new Pool({
      connectionString: c,
      max: 3,
      connectionTimeoutMillis: 4500,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}
export async function closeCampgroundSupportPool265ForTests() {
  if (pool) await pool.end();
  pool = undefined;
}
async function installed265() {
  if (!process.env.DATABASE_URL?.trim()) return false;
  try {
    const r = await originalPool().query(
      "select to_regclass('icamp_private.rental_safety_ack265') is not null as safety," +
        " to_regclass('icamp_private.rental_custody_events265') is not null as custody," +
        " to_regclass('icamp_private.rental_supervision_witness265') is not null as witness," +
        " to_regclass('icamp_private.campground_support265') is not null as support",
    );
    return Object.values(r.rows[0] ?? {}).every((x) => x === true);
  } catch {
    return false;
  }
}
async function requireLocal(
  userId,
  campgroundId,
  permission = "campground.operations.manage",
) {
  if (
    !UUID.test(campgroundId) ||
    !(await hasCampgroundPermission(userId, campgroundId, permission))
  )
    throw Error(
      "Only an active assigned campground operator has this permission.",
    );
}
async function trans(userId, work) {
  const client = await originalPool().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout='8500ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
function ready() {
  return "ORIGINAL_0241_SOURCE_ADOPTION_UNVERIFIED";
}

export async function listLocalSupport265({ userId, campgroundId }) {
  await requireLocal(userId, campgroundId);
  if (!(await installed265()))
    return {
      status: "HOLD_PRODUCTION_MIGRATION_0241",
      cases: [],
      metrics: classifyCampgroundSupport265([]),
    };
  const r = await originalPool().query(
    "select id,category,severity,title,description,status,created_at,reviewed_at,version " +
      "from icamp_private.campground_support265 where campground_id=$1 " +
      "order by created_at desc,id limit 100",
    [campgroundId],
  );
  const rows = r.rows.map((row) => ({
    id: row.id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    reviewedAt:
      row.reviewed_at instanceof Date
        ? row.reviewed_at.toISOString()
        : row.reviewed_at
          ? String(row.reviewed_at)
          : null,
    version: Number(row.version),
  }));
  return {
    status: "ORIGINAL_SCOPED_SUPPORT_CASES_OBSERVED",
    cases: rows,
    metrics: classifyCampgroundSupport265(rows),
  };
}
export async function submitLocalSupport265({
  userId,
  sessionId,
  campgroundId,
  input,
}) {
  await requireLocal(userId, campgroundId);
  if (!(await installed265())) throw Error(ready());
  const data = normalizedSupport265(input);
  return trans(userId, async (client) => {
    const c = await client.query(
      "select organization_id from public.campgrounds where id=$1 and lifecycle_state='active'",
      [campgroundId],
    );
    if (c.rowCount !== 1) throw Error("Active original campground required.");
    const org = c.rows[0].organization_id;
    const r = await client.query(
      "insert into icamp_private.campground_support265 " +
        "(organization_id,campground_id,category,severity,title,description,actor_user_id) " +
        "values($1,$2,$3,$4,$5,$6,$7) returning id",
      [
        org,
        campgroundId,
        data.category,
        data.severity,
        data.title,
        data.description,
        userId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId: sessionId,
      organizationId: org,
      campgroundId,
      actionKey: "campground.support265.create",
      permissionKey: "campground.operations.manage",
      subjectType: "campground.support_case",
      subjectId: r.rows[0].id,
      afterState: {
        category: data.category,
        severity: data.severity,
        status: "open",
        sensitiveTextExcluded: true,
      },
    });
    return r.rows[0].id;
  });
}
export async function transitionLocalSupport265({
  userId,
  sessionId,
  campgroundId,
  caseId,
  version,
  status,
}) {
  await requireLocal(userId, campgroundId);
  if (
    !UUID.test(caseId) ||
    !["triaged", "resolved"].includes(status) ||
    !Number.isInteger(version) ||
    version < 1
  )
    throw Error("Invalid original support case transition.");
  if (!(await installed265())) throw Error(ready());
  return trans(userId, async (client) => {
    const r = await client.query(
      "update icamp_private.campground_support265 set status=$1 " +
        "where id=$2 and campground_id=$3 and version=$4 " +
        "returning id,organization_id,version",
      [status, caseId, campgroundId, version],
    );
    if (r.rowCount !== 1)
      throw Error("Case changed, is closed or belongs to another campground.");
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId: sessionId,
      organizationId: r.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.support265.transition",
      permissionKey: "campground.operations.manage",
      subjectType: "campground.support_case",
      subjectId: caseId,
      afterState: { status, version: r.rows[0].version },
    });
    return caseId;
  });
}
export async function listPlatformSupportAggregates265() {
  // Call ONLY following requireSysop() MFA/owner authorization. Never return
  // descriptions, usernames, campground IDs or customer data.
  if (!(await installed265()))
    return {
      status: "HOLD_ORIGINAL_SUPPORT_SCHEMA_0241",
      total: 0,
      open: 0,
      critical: 0,
      locked: 0,
      performance: 0,
      triaged: 0,
      limited: false,
    };
  const r = await originalPool().query(
    "select count(*)::integer total," +
      " count(*) filter(where status='open')::integer open," +
      " count(*) filter(where status='triaged')::integer triaged," +
      " count(*) filter(where status<>'resolved' and severity='critical')::integer critical," +
      " count(*) filter(where status<>'resolved' and category='software_locked')::integer locked," +
      " count(*) filter(where status<>'resolved' and category='performance')::integer performance " +
      "from icamp_private.campground_support265",
  );
  return {
    status: "ORIGINAL_AGGREGATE_SUPPORT_COUNTS",
    ...r.rows[0],
    limited: false,
  };
}
export async function listOwnSafetyAcknowledgements265({ guestUserId }) {
  if (!UUID.test(guestUserId))
    throw Error("Active original guest ID required.");
  if (!(await installed265()))
    return { status: "HOLD_PRODUCTION_MIGRATION_0241", allocationIds: [] };
  const r = await originalPool().query(
    "select allocation_id from icamp_private.rental_safety_ack265 where guest_user_id=$1 limit 100",
    [guestUserId],
  );
  return {
    status: "ORIGINAL_GUEST_SAFETY_ACKNOWLEDGMENT",
    allocationIds: r.rows.map((x) => x.allocation_id),
  };
}
export async function recordGuestSafetyAcknowledgement265({
  guestUserId,
  sessionId,
  input,
}) {
  if (!UUID.test(guestUserId))
    throw Error("Original authenticated guest required.");
  if (!(await installed265())) throw Error(ready());
  const normalized = normalizedGuestAcknowledgment265(input);
  return trans(guestUserId, async (client) => {
    const r = await client.query(
      "select id,organization_id,campground_id,guest_user_id from icamp_private.rental_allocations264 where id=$1 and guest_user_id=$2 for share",
      [normalized.allocationId, guestUserId],
    );
    if (r.rowCount !== 1)
      throw Error("Guest cannot acknowledge other reservations.");
    const row = r.rows[0];
    const created = await client.query(
      "insert into icamp_private.rental_safety_ack265 " +
        "(allocation_id,organization_id,campground_id,guest_user_id,version_sha256,safety_review_confirmed,terms_review_confirmed) " +
        "values($1,$2,$3,$4,$5,true,true) on conflict(allocation_id) do nothing returning id",
      [
        row.id,
        row.organization_id,
        row.campground_id,
        guestUserId,
        normalized.versionSha256,
      ],
    );
    if (created.rowCount) {
      await appendAuditEvent(client, {
        actorUserId: guestUserId,
        actorSessionId: sessionId,
        organizationId: row.organization_id,
        campgroundId: row.campground_id,
        actionKey: ["rental", "safety265", "acknowledge"].join("."),
        permissionKey: "rental.manage",
        subjectType: "rental.guest_safety_acknowledgement",
        subjectId: created.rows[0].id,
        afterState: {
          versionSha256: normalized.versionSha256,
          waiverCertified: false,
          paymentCaptured: false,
        },
      });
    }
    return { acknowledged: true, newlyRecorded: created.rowCount === 1 };
  });
}
export async function listLocalCustody265({ userId, campgroundId }) {
  await requireLocal(userId, campgroundId, "rental.manage");
  if (!(await installed265()))
    return {
      status: "HOLD_PRODUCTION_MIGRATION_0241",
      events: [],
      witnesses: [],
    };
  const [e, w] = await Promise.all([
    originalPool().query(
      "select e.id,e.allocation_id,e.event_kind,e.evidence_reference,e.condition_note,e.recorded_at " +
        "from icamp_private.rental_custody_events265 e where e.campground_id=$1 " +
        "order by e.recorded_at desc limit 100",
      [campgroundId],
    ),
    originalPool().query(
      "select id,pilot_review_id,site_reference,supervision_reference,safety_restrictions,witnessed_at " +
        "from icamp_private.rental_supervision_witness265 where campground_id=$1 " +
        "order by witnessed_at desc limit 100",
      [campgroundId],
    ),
  ]);
  return {
    status: "ORIGINAL_STAFF_ATTESTATION_NOT_INDEPENDENT_FIELD_CERTIFICATION",
    events: e.rows.map((row) => ({
      ...row,
      allocationId: row.allocation_id,
      eventKind: row.event_kind,
      evidenceReference: row.evidence_reference,
      conditionNote: row.condition_note,
      recordedAt:
        row.recorded_at instanceof Date
          ? row.recorded_at.toISOString()
          : String(row.recorded_at),
    })),
    witnesses: w.rows.map((row) => ({
      id: row.id,
      pilotReviewId: row.pilot_review_id,
      siteReference: row.site_reference,
      supervisionReference: row.supervision_reference,
      safetyRestrictions: row.safety_restrictions,
      witnessedAt:
        row.witnessed_at instanceof Date
          ? row.witnessed_at.toISOString()
          : String(row.witnessed_at),
    })),
  };
}
export async function recordLocalCustody265({
  userId,
  sessionId,
  campgroundId,
  input,
}) {
  await requireLocal(userId, campgroundId, "rental.manage");
  if (!(await installed265())) throw Error(ready());
  const info = normalizedCustody265(input);
  return trans(userId, async (client) => {
    const source = await client.query(
      "select organization_id from icamp_private.rental_allocations264 where id=$1 and campground_id=$2 for update",
      [info.allocationId, campgroundId],
    );
    if (source.rowCount !== 1)
      throw Error("Original asset reservation scope mismatch.");
    const org = source.rows[0].organization_id;
    const created = await client.query(
      "insert into icamp_private.rental_custody_events265 " +
        "(allocation_id,organization_id,campground_id,event_kind,evidence_reference,condition_note,actor_user_id) " +
        "values($1,$2,$3,$4,$5,$6,$7) returning id",
      [
        info.allocationId,
        org,
        campgroundId,
        info.eventKind,
        info.evidenceReference,
        info.conditionNote,
        userId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId: sessionId,
      organizationId: org,
      campgroundId,
      actionKey: ["rental", "custody265", "record"].join("."),
      permissionKey: "rental.manage",
      subjectType: "rental.staff_custody_attestation",
      subjectId: created.rows[0].id,
      afterState: {
        allocationId: info.allocationId,
        eventKind: info.eventKind,
        evidenceReference: info.evidenceReference,
        physicalThirdPartyVerified: false,
        bankPaid: false,
      },
    });
    return created.rows[0].id;
  });
}
export async function recordLocalWitness265({
  userId,
  sessionId,
  campgroundId,
  input,
}) {
  await requireLocal(userId, campgroundId, "rental.manage");
  await requireLocal(userId, campgroundId, "staff.manage");
  if (!(await installed265())) throw Error(ready());
  const d = normalizedSupervision265(input);
  return trans(userId, async (client) => {
    const original = await client.query(
      "select organization_id from icamp_private.rental_pilot_reviews264 where id=$1 and campground_id=$2 for share",
      [d.pilotReviewId, campgroundId],
    );
    if (original.rowCount !== 1)
      throw Error("Original internal pilot review is not in this campground.");
    const org = original.rows[0].organization_id;
    const r = await client.query(
      "insert into icamp_private.rental_supervision_witness265 " +
        "(pilot_review_id,organization_id,campground_id,site_reference,supervision_reference,safety_restrictions,witnessed_by_user_id) " +
        "values($1,$2,$3,$4,$5,$6,$7) returning id",
      [
        d.pilotReviewId,
        org,
        campgroundId,
        d.siteReference,
        d.supervisionReference,
        d.safetyRestrictions,
        userId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId: sessionId,
      organizationId: org,
      campgroundId,
      actionKey: ["rental", "supervision265", "independent_witness"].join("."),
      permissionKey: "staff.manage",
      subjectType: "rental.internal_pilot_witness",
      subjectId: r.rows[0].id,
      afterState: {
        pilotReviewId: d.pilotReviewId,
        supervisionReference: d.supervisionReference,
        livePublicPilotAuthorized: false,
        insuranceVerifiedExternally: false,
      },
    });
    return r.rows[0].id;
  });
}
