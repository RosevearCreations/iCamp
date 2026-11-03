import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  isPrivacyTerminal,
  normalizePrivacyRequest,
  normalizePrivacyReview,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for privacy requests.");
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeGuestPrivacyPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}
const iso = (value) => (value == null ? null : new Date(value).toISOString());
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

async function assertGuestScope(userId, campgroundId) {
  if (!uuidPattern.test(campgroundId))
    throw new Error("Invalid campground scope.");
  const result = await getPool().query(
    `select c.organization_id,c.id,c.name from public.campgrounds c
     join icamp_private.user_accounts u on u.id=$1 and u.account_type='guest' and u.account_state='active'
     where c.id=$2 and c.lifecycle_state='active' and (
       exists(select 1 from public.reservations r where r.campground_id=c.id and r.guest_user_id=u.id)
       or exists(select 1 from public.guest_profiles g where g.campground_id=c.id and g.user_account_id=u.id))`,
    [userId, campgroundId],
  );
  if (result.rowCount !== 1)
    throw new Error("This campground is not linked to the signed-in guest.");
  return result.rows[0];
}

async function assertManage(userId, campgroundId) {
  if (
    !uuidPattern.test(campgroundId) ||
    !(await hasCampgroundPermission(userId, campgroundId, "guest.manage"))
  )
    throw new Error(
      "Guest privacy review requires campground guest.manage permission.",
    );
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function mapRequest(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    guestUserId: row.guest_user_id,
    requestKind: row.request_kind,
    subjectArea: row.subject_area,
    submittedAt: iso(row.submitted_at),
    status: row.event_kind ?? "submitted",
    outcomeCode: row.outcome_code ?? "pending",
    reviewedAt: iso(row.recorded_at),
    sourceReference: row.source_reference ?? null,
    terminal: isPrivacyTerminal(row.event_kind ?? "submitted"),
  };
}

const requestsQuery = `select r.*,e.event_kind,e.outcome_code,e.source_reference,e.recorded_at
  from icamp_private.guest_privacy_requests r
  left join lateral (select event_kind,outcome_code,source_reference,recorded_at
    from icamp_private.guest_privacy_request_events x where x.request_id=r.id
    order by recorded_at desc,id desc limit 1) e on true`;

export async function submitGuestPrivacyRequest({
  userId,
  campgroundId,
  input,
}) {
  const normalized = normalizePrivacyRequest(input);
  const scope = await assertGuestScope(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      `icamp-privacy-intake:${campgroundId}:${userId}:${normalized.requestKind}:${normalized.subjectArea}`,
    ]);
    const recent = await client.query(
      `select 1 from icamp_private.guest_privacy_requests where campground_id=$1
       and guest_user_id=$2 and request_kind=$3 and subject_area=$4
       and submitted_at>statement_timestamp()-interval '24 hours' limit 1`,
      [campgroundId, userId, normalized.requestKind, normalized.subjectArea],
    );
    if (recent.rowCount)
      throw new Error(
        "An identical request was submitted in the last 24 hours. Review its current status.",
      );
    const inserted = await client.query(
      `insert into icamp_private.guest_privacy_requests
        (organization_id,campground_id,guest_user_id,request_kind,subject_area)
       values($1,$2,$3,$4,$5) returning id`,
      [
        scope.organization_id,
        campgroundId,
        userId,
        normalized.requestKind,
        normalized.subjectArea,
      ],
    );
    const requestId = inserted.rows[0].id;
    await client.query(
      `insert into icamp_private.guest_privacy_request_events
        (organization_id,campground_id,request_id,event_kind,actor_user_id)
       values($1,$2,$3,'submitted',$4)`,
      [scope.organization_id, campgroundId, requestId, userId],
    );
    // The private evidence is written under icamp_app RLS; the audit ledger is
    // intentionally owned by the privileged server connection, not icamp_app.
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId: userId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "guest.privacy.request.submitted",
      subjectType: "guest_privacy_request",
      subjectId: requestId,
      metadata: {
        requestKind: normalized.requestKind,
        subjectArea: normalized.subjectArea,
      },
    });
    await client.query("commit");
    return requestId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listOwnGuestPrivacy({ userId, campgroundId }) {
  await assertGuestScope(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const [requests, profileHistory] = await Promise.all([
      client.query(
        `${requestsQuery} where r.campground_id=$1 and r.guest_user_id=$2
        order by r.submitted_at desc,r.id desc limit 101`,
        [campgroundId, userId],
      ),
      client.query(
        `select e.event_kind,e.source_channel,e.metadata,e.occurred_at
         from public.guest_profile_events e join public.guest_profiles g
           on g.id=e.guest_profile_id and g.campground_id=e.campground_id
         where e.campground_id=$1 and g.user_account_id=$2
           and e.event_kind in ('profile_created','privacy_updated')
         order by e.occurred_at desc,e.id desc limit 101`,
        [campgroundId, userId],
      ),
    ]);
    await client.query("commit");
    // Account-linked communication endpoint history, intentionally excluding
    // raw phone/email, evidence reference and any message content.
    const messaging = await getPool().query(
      `select cc.purpose,cc.channel,cc.consent_state,cc.evidence_source,cc.occurred_at
       from icamp_private.communication_consents cc
       join icamp_private.communication_endpoints ce on ce.id=cc.endpoint_id
       where ce.campground_id=$1 and ce.owner_user_id=$2
       order by cc.occurred_at desc,cc.id desc limit 101`,
      [campgroundId, userId],
    );
    const consentHistory = [
      ...profileHistory.rows.slice(0, 100).map((row) => ({
        source: "saved_profile",
        kind: row.event_kind,
        channel: row.source_channel,
        at: iso(row.occurred_at),
        saveStayPreferences: row.metadata?.saveStayPreferences === true,
        allowStaffProfileLookup: row.metadata?.allowStaffProfileLookup === true,
      })),
      ...messaging.rows.slice(0, 100).map((row) => ({
        source: "linked_communication",
        kind: row.purpose,
        channel: row.channel,
        at: iso(row.occurred_at),
        consentState: row.consent_state,
        evidenceSource: row.evidence_source,
      })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return {
      requests: requests.rows.slice(0, 100).map(mapRequest),
      consentHistory,
      truncated:
        requests.rows.length > 100 ||
        profileHistory.rows.length > 100 ||
        messaging.rows.length > 100,
      sourceAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// Read-only guest data subject access export, including completed/cancelled
// bookings deliberately hidden from the day-to-day guest reservation RLS view.
// A server-validated guest+campground scope and explicit user ID predicates
// are mandatory before using the privileged reporting connection.
export async function listOwnPrivacyExportRecords({ userId, campgroundId }) {
  const scope = await assertGuestScope(userId, campgroundId);
  const [stays, receipts] = await Promise.all([
    getPool().query(
      `select r.id,r.status,r.arrival_date,r.departure_date,r.source_channel,
      a.display_name accommodation_name
      from public.reservations r join public.accommodations a on a.id=r.accommodation_id
      where r.guest_user_id=$1 and r.campground_id=$2
      order by r.created_at desc,r.id desc limit 101`,
      [userId, campgroundId],
    ),
    getPool().query(
      `select rr.id,rr.reservation_id,rr.receipt_number,rr.payment_purpose,
      rr.currency_code,rr.amount_cents,rr.issued_at
      from public.reservation_receipts rr
      join public.reservations r on r.id=rr.reservation_id
      where r.guest_user_id=$1 and r.campground_id=$2
      order by rr.issued_at desc,rr.id desc limit 101`,
      [userId, campgroundId],
    ),
  ]);
  return {
    campgroundName: scope.name,
    stays: stays.rows.slice(0, 100).map((r) => ({
      id: r.id,
      status: r.status,
      arrivalDate: String(r.arrival_date).slice(0, 10),
      departureDate: String(r.departure_date).slice(0, 10),
      sourceChannel: r.source_channel,
      accommodationName: r.accommodation_name,
    })),
    receipts: receipts.rows.slice(0, 100).map((r) => ({
      id: r.id,
      reservationId: r.reservation_id,
      receiptNumber: r.receipt_number,
      paymentPurpose: r.payment_purpose,
      currencyCode: r.currency_code,
      amountCents: Number(r.amount_cents),
      issuedAt: iso(r.issued_at),
    })),
    truncated: stays.rows.length > 100 || receipts.rows.length > 100,
  };
}

export async function recordOwnPrivacyExportReceipt({
  userId,
  campgroundId,
  sha256,
  incomplete,
}) {
  const scope = await assertGuestScope(userId, campgroundId);
  if (!/^[a-f0-9]{64}$/u.test(sha256))
    throw new Error("Invalid privacy export digest.");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await appendAuditEvent(client, {
      actorUserId: userId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "guest.privacy.export.download",
      subjectType: "guest_privacy_export",
      subjectId: campgroundId,
      metadata: {
        build: 197,
        sha256,
        incomplete: incomplete === true,
        format: "json",
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listManagedPrivacyRequests({ userId, campgroundId }) {
  await assertManage(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const result = await client.query(
      `${requestsQuery} where r.campground_id=$1
      order by r.submitted_at desc,r.id desc limit 101`,
      [campgroundId],
    );
    await client.query("commit");
    return {
      requests: result.rows.slice(0, 100).map(mapRequest),
      truncated: result.rows.length > 100,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewGuestPrivacyRequest({
  actorUserId,
  campgroundId,
  requestId,
  input,
}) {
  await assertManage(actorUserId, campgroundId);
  if (!uuidPattern.test(requestId))
    throw new Error("Invalid privacy request ID.");
  const normalized = normalizePrivacyReview(input);
  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const req = await client.query(
      `select organization_id,guest_user_id from icamp_private.guest_privacy_requests
       where id=$1 and campground_id=$2`,
      [requestId, campgroundId],
    );
    if (req.rowCount !== 1)
      throw new Error("Privacy request not visible in this campground.");
    const organizationId = req.rows[0].organization_id;
    await client.query(
      `insert into icamp_private.guest_privacy_request_events
       (organization_id,campground_id,request_id,event_kind,outcome_code,source_reference,actor_user_id)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        organizationId,
        campgroundId,
        requestId,
        normalized.eventKind,
        normalized.outcomeCode,
        normalized.sourceReference,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "guest.privacy.request.review",
      permissionKey: "guest.manage",
      riskLevel: "elevated",
      reason: "Authorized campground privacy review milestone.",
      subjectType: "guest_privacy_request",
      subjectId: requestId,
      metadata: {
        eventKind: normalized.eventKind,
        outcomeCode: normalized.outcomeCode,
        sourceReference: normalized.sourceReference,
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
