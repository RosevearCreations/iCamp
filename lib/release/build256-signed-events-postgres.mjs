import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { protectedThreeMasterFreshness } from "./build254-security-postgres.mjs";
import {
  planRevocationHandoffs,
  verifyOriginalSignedEvent,
} from "./build256-signed-events.mjs";

const REV = /^[a-f0-9]{40}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
let pool;
const deployedRevision = () => {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!REV.test(revision)) throw new Error("Exact deployed revision required.");
  return revision;
};
const protectedJSON = (name) => {
  const raw = process.env[name] ?? "";
  if (!raw || raw.length > 32_768) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};
const protectedArray = (name) => {
  const raw = process.env[name] ?? "";
  if (!raw || raw.length > 32_768) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length <= 32 ? parsed : null;
  } catch {
    return null;
  }
};
function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Authenticated private production database required.");
  if (!pool)
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 4000,
    });
  return pool;
}
async function authorizedOwner(actorUserId, campgroundId) {
  if (!UUID.test(String(actorUserId)) || !UUID.test(String(campgroundId)))
    throw new Error("Current owner and campground required.");
  const grant = await getCampgroundAuthorization(actorUserId, campgroundId);
  if (
    !grant?.roleCodes.includes("owner_admin") ||
    !["staff.manage", "reservation.modify"].every((p) =>
      grant.permissions.includes(p),
    )
  )
    throw new Error("Current independent owner grant required.");
  return grant;
}
async function scoped(userId, revision, work) {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    if (revision)
      await client.query("select set_config('icamp.source_revision',$1,true)", [
        revision,
      ]);
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
const privateMastersRequired = () => {
  const masters = protectedThreeMasterFreshness();
  if (!masters.allCurrent)
    throw new Error("Three independently signed Master sources missing.");
  return masters;
};

/** Original protected signer input only; no request form contains a key. */
export async function admitProtectedSignedEvent({
  actorUserId,
  actorSessionId,
  campgroundId,
}) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  const revision = deployedRevision();
  privateMastersRequired();
  const packet = protectedJSON("ICAMP_BUILD256_ORIGINAL_EVENT_JSON");
  const pin = protectedJSON("ICAMP_BUILD256_ORIGINAL_ISSUER_PIN_JSON");
  const revocations = protectedArray("ICAMP_BUILD256_ISSUER_REVOCATIONS_JSON");
  if (!packet || !pin || !revocations)
    throw new Error("Original independently issued signed evidence missing.");
  const verified = verifyOriginalSignedEvent({
    packet,
    pin,
    revocations,
    custodianEnrolled:
      process.env.ICAMP_BUILD256_SOURCE_CUSTODIAN_ENROLLED === "true",
    asOf: new Date().toISOString(),
  });
  if (!verified.verified)
    throw new Error(verified.status);
  if (
    packet.envelope.sourceAppId !== "icamp" &&
    packet.envelope.targetAppId !== "icamp"
  )
    throw new Error("Only original iCamp-bound signed events allowed.");
  if (
    packet.envelope.tenantId !== null &&
    packet.envelope.tenantId !== campgroundId
  )
    throw new Error("Original event belongs to another tenant.");
  return scoped(actorUserId, revision, async (client) => {
    const inserted = await client.query(
      [
        "insert into public.icamp_signed_event_receipts",
        "(organization_id,campground_id,deployed_revision,source_revision,",
        "source_app,target_app,event_type,tenant_id,nonce_digest_sha256,",
        "receipt_digest_sha256,signer_fingerprint_sha256,",
        "revokes_receipt_digest_sha256,issued_at,expires_at,claimed_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        "returning id,claimed_at",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        revision,
        verified.sourceRevision,
        verified.issuerAppId,
        verified.targetAppId,
        verified.eventType,
        verified.tenantId,
        verified.nonceDigestSha256,
        verified.receiptDigestSha256,
        verified.signerFingerprintSha256,
        verified.revokesReceiptDigestSha256,
        verified.issuedAt,
        verified.expiresAt,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "security.original_cross_app_signed_event_claim",
      permissionKey: "staff.manage",
      riskLevel: "high",
      subjectType: "icamp_signed_event_receipts",
      subjectId: inserted.rows[0].id,
      metadata: {
        sourceApp: verified.issuerAppId,
        eventType: verified.eventType,
        state: "HOLD",
      },
    });
    return {
      id: inserted.rows[0].id,
      status: "SOURCE_SIGNED_RECEIPT_STORED_HOLD",
      receiverConnected: false,
      ownerAcceptance: "HOLD",
    };
  });
}

/** Two-person review of a separately admitted signed revocation original. */
export async function recordIndependentSignedRevocation({
  actorUserId,
  actorSessionId,
  campgroundId,
  revokedReceiptId,
  signedRevocationReceiptId,
  reasonCode,
}) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  const revision = deployedRevision();
  privateMastersRequired();
  if (
    !UUID.test(String(revokedReceiptId)) ||
    !UUID.test(String(signedRevocationReceiptId)) ||
    ![
      "issuer_key_compromised",
      "receipt_replaced",
      "consent_revoked",
      "source_revoked",
      "security_exception",
    ].includes(reasonCode)
  )
    throw new Error("Original source and valid revocation reason required.");
  return scoped(actorUserId, revision, async (client) => {
    const [source, revoker] = await Promise.all([
      client.query(
        "select * from public.icamp_signed_event_receipts where id=$1 and organization_id=$2 and campground_id=$3",
        [revokedReceiptId, grant.organizationId, campgroundId],
      ),
      client.query(
        "select * from public.icamp_signed_event_receipts where id=$1 and organization_id=$2 and campground_id=$3",
        [signedRevocationReceiptId, grant.organizationId, campgroundId],
      ),
    ]);
    const original = source.rows[0];
    const signed = revoker.rows[0];
    if (
      !original ||
      !signed ||
      original.source_app !== signed.source_app ||
      signed.event_type !== "security_exception.v1" ||
      signed.revokes_receipt_digest_sha256 !== original.receipt_digest_sha256 ||
      signed.claimed_by_user_id === actorUserId
    )
      throw new Error("Different independent original source reviewer required.");
    const plan = planRevocationHandoffs({
      sourceAppId: signed.source_app,
      verifiedRevocation: {
        verified: true,
        issuerAppId: signed.source_app,
        eventType: signed.event_type,
        revokesReceiptDigestSha256: signed.revokes_receipt_digest_sha256,
      },
    });
    if (plan.status !== "SOURCE_VERIFIED_UNDELIVERED_HOLD")
      throw new Error("No authorized source revocation handoff.");
    const row = await client.query(
      [
        "insert into public.icamp_signed_event_revocations",
        "(organization_id,campground_id,deployed_revision,revoked_receipt_id,",
        "signed_revocation_receipt_id,reason_code,reviewed_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7) returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        revision,
        original.id,
        signed.id,
        reasonCode,
        actorUserId,
      ],
    );
    for (const targetApp of plan.targets) {
      await client.query(
        [
          "insert into public.icamp_signed_event_outbox",
          "(organization_id,campground_id,deployed_revision,revocation_id,",
          "target_app,queued_by_user_id) values ($1,$2,$3,$4,$5,$6)",
        ].join(" "),
        [
          grant.organizationId,
          campgroundId,
          revision,
          row.rows[0].id,
          targetApp,
          actorUserId,
        ],
      );
    }
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "security.independent_signed_revocation_hold_queue",
      permissionKey: "staff.manage",
      riskLevel: "high",
      subjectType: "icamp_signed_event_revocations",
      subjectId: row.rows[0].id,
      metadata: {
        reasonCode,
        targetCount: plan.targets.length,
        delivered: false,
        ownerAcceptance: "HOLD",
      },
    });
    return {
      id: row.rows[0].id,
      status: "REVOCATION_RECORDED_DELIVERY_HOLD",
      outboxCount: plan.targets.length,
      receiverConnected: false,
      ownerAcceptance: "HOLD",
    };
  });
}

export async function listSignedEventCustody({ actorUserId, campgroundId }) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  return scoped(actorUserId, null, async (client) => {
    const table = await client.query(
      "select to_regclass('public.icamp_signed_event_receipts') is not null as ready",
    );
    if (table.rows[0]?.ready !== true)
      return {
        status: "HOLD_BUILD256_DATABASE_MIGRATION_NOT_ADOPTED",
        receipts: [],
        revocations: [],
        outbox: [],
      };
    const [receipts, revocations, outbox] = await Promise.all([
      client.query(
        [
          "select id,source_app,event_type,issued_at,expires_at,claimed_at,",
          "receipt_digest_sha256,revokes_receipt_digest_sha256",
          "from public.icamp_signed_event_receipts",
          "where organization_id=$1 and campground_id=$2",
          "order by claimed_at desc,id desc limit 50",
        ].join(" "),
        [grant.organizationId, campgroundId],
      ),
      client.query(
        [
          "select id,revoked_receipt_id,signed_revocation_receipt_id,reason_code,reviewed_at",
          "from public.icamp_signed_event_revocations",
          "where organization_id=$1 and campground_id=$2",
          "order by reviewed_at desc,id desc limit 50",
        ].join(" "),
        [grant.organizationId, campgroundId],
      ),
      client.query(
        [
          "select id,revocation_id,target_app,decision,queued_at",
          "from public.icamp_signed_event_outbox",
          "where organization_id=$1 and campground_id=$2",
          "order by queued_at desc,id desc limit 50",
        ].join(" "),
        [grant.organizationId, campgroundId],
      ),
    ]);
    return {
      status: "TENANT_SCOPED_ORIGINAL_EVENT_HOLD_LEDGER",
      receipts: receipts.rows.map((r) => ({
        id: r.id,
        sourceApp: r.source_app,
        eventType: r.event_type,
        at: r.claimed_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        digest: r.receipt_digest_sha256,
        revokesDigest: r.revokes_receipt_digest_sha256,
      })),
      revocations: revocations.rows.map((r) => ({
        id: r.id,
        receiptId: r.revoked_receipt_id,
        signedRevocationId: r.signed_revocation_receipt_id,
        reasonCode: r.reason_code,
        at: r.reviewed_at.toISOString(),
      })),
      outbox: outbox.rows.map((r) => ({
        id: r.id,
        revocationId: r.revocation_id,
        targetApp: r.target_app,
        status: r.decision,
        at: r.queued_at.toISOString(),
      })),
    };
  });
}
