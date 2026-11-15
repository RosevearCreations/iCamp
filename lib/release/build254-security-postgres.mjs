import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { masterReceiptMessage } from "../booking-charges/fulfillment-build249-core.mjs";
import { readCrossMasterProtectedEvidence } from "../booking-charges/fulfillment-build249-postgres.mjs";
import { inspectBuild253SupervisedReview } from "./build253-provenance-postgres.mjs";
import {
  assessTieredSecurity,
  evaluateThreeMasterFreshness,
  prepareSignedReceiptClaim,
  sha256,
  validateRemediationDecision,
} from "./build254-security-core.mjs";

const REV = /^[a-f0-9]{40}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const sourceRevision = () => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return REV.test(sha) ? sha : null;
};
const protectedJSON = (name) => {
  const raw = process.env[name] ?? "";
  if (!raw || raw.length > 16384) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
};
const protectedArray = (name) => {
  const parsed = protectedJSON(name);
  return Array.isArray(parsed) ? parsed : [];
};
let pool;
function database() {
  if (!process.env.DATABASE_URL) throw new Error("Private database required.");
  if (!pool)
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 4000,
    });
  return pool;
}
async function authorizedOwner(userId, campgroundId) {
  if (!UUID.test(String(userId)) || !UUID.test(String(campgroundId)))
    throw new Error("Authenticated owner and current campground required.");
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (
    !grant?.roleCodes.includes("owner_admin") ||
    !["staff.manage", "reservation.modify"].every((permission) =>
      grant.permissions.includes(permission),
    )
  )
    throw new Error("Current independent Owner/Admin authority required.");
  return grant;
}
async function scoped(userId, sha, work) {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    if (sha)
      await client.query("select set_config('icamp.source_revision',$1,true)", [
        sha,
      ]);
    const data = await work(client);
    await client.query("commit");
    return data;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
const iso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export function protectedThreeMasterFreshness() {
  const now = new Date().toISOString();
  const revision = sourceRevision();
  const signed = readCrossMasterProtectedEvidence({
    sourceRevision: revision,
    asOf: now,
  });
  return evaluateThreeMasterFreshness({
    sourceRevision: revision,
    evidence: signed,
    receipts: protectedArray("ICAMP_MASTER_ACCEPTANCE_READBACK_JSON"),
    asOf: now,
  });
}

/** A real source claim needs cryptographic verification of protected server
 * inputs, fresh current SHA, and the RLS/triggers of original database.
 * No browser-controlled signature, nonce, hostname, or trust pin is accepted. */
async function verifiedReceiptForAdmission(receiptType, masterPlane) {
  const revision = sourceRevision();
  if (!revision) throw new Error("Current deployed SHA missing.");
  const now = new Date().toISOString();
  if (receiptType === "master_source") {
    const horizon = protectedThreeMasterFreshness();
    if (!horizon.allCurrent)
      throw new Error("All three original signed Master sources required.");
    const receipts = protectedArray("ICAMP_MASTER_ACCEPTANCE_READBACK_JSON");
    const pins = protectedArray("ICAMP_MASTER_RECEIPT_PINS_JSON");
    const receipt = receipts.find((r) => r.plane === masterPlane);
    const pin = pins.find((p) => p.plane === masterPlane);
    if (!receipt || !pin)
      throw new Error("Original Master source not enrolled.");
    return prepareSignedReceiptClaim({
      sourceRevision: revision,
      receiptType,
      masterPlane,
      nonce: receipt.nonce,
      receiptDigestSha256: sha256(
        masterReceiptMessage(receipt) + ":" + receipt.signatureBase64,
      ),
      signerFingerprintSha256: pin.independentlyAuthenticatedSpkiFingerprint,
      issuedAt: receipt.issuedAt,
      cryptographicallyVerified: horizon.results.some(
        (r) => r.plane === masterPlane && r.status.startsWith("SIGNED_SOURCE_"),
      ),
      asOf: now,
    });
  }
  if (receiptType !== "database_provenance" || masterPlane !== null)
    throw new Error("Unsupported original source receipt claim.");
  const report = await inspectBuild253SupervisedReview();
  const receipt = protectedJSON("ICAMP_DB_PROVENANCE_RECEIPT_JSON");
  const pin = protectedJSON("ICAMP_DB_PROVENANCE_REVIEWER_PIN_JSON");
  if (
    !report.provenance.signatureVerified ||
    !report.provenance.independentDatabaseProvenance ||
    !report.checksum.sourceChecksumsMatch ||
    !receipt ||
    !pin
  )
    throw new Error(
      "Signed, source-matched production DB provenance required.",
    );
  return prepareSignedReceiptClaim({
    sourceRevision: revision,
    receiptType,
    masterPlane: null,
    nonce: receipt.nonce,
    receiptDigestSha256: sha256(
      receipt.signatureBase64 + ":" + report.provenance.receiptDigestSha256,
    ),
    signerFingerprintSha256: pin.independentlyAuthenticatedSpkiFingerprint,
    issuedAt: receipt.observedAt,
    cryptographicallyVerified: report.provenance.signatureVerified,
    asOf: now,
  });
}
export async function admitProtectedSourceReceipt({
  actorUserId,
  actorSessionId,
  campgroundId,
  receiptType,
  masterPlane = null,
}) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  const claim = await verifiedReceiptForAdmission(receiptType, masterPlane);
  return scoped(actorUserId, claim.sourceRevision, async (client) => {
    const row = await client.query(
      [
        "insert into public.service_fulfillment_source_receipt_claims",
        "(organization_id,campground_id,source_revision,receipt_type,master_plane,",
        "nonce_digest_sha256,receipt_digest_sha256,signer_fingerprint_sha256,",
        "receipt_issued_at,decision,claimed_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        "returning id,claimed_at",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        claim.sourceRevision,
        claim.receiptType,
        claim.masterPlane,
        claim.nonceDigestSha256,
        claim.receiptDigestSha256,
        claim.signerFingerprintSha256,
        claim.issuedAt,
        claim.decision,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "fulfillment.original_signed_receipt_claim",
      permissionKey: "staff.manage",
      riskLevel: "high",
      subjectType: "source_receipt_claim",
      subjectId: row.rows[0].id,
      metadata: { receiptType, masterPlane, acceptance: "HOLD" },
    });
    return {
      id: row.rows[0].id,
      observedAt: iso(row.rows[0].claimed_at),
      status: "SIGNED_SOURCE_CLAIM_RECORDED_HOLD",
      masterConnected: false,
      ownerProductionAcceptance: "HOLD",
    };
  });
}
export async function recordIndependentRemediation({
  actorUserId,
  actorSessionId,
  campgroundId,
  sourceReceiptClaimId,
  decision,
  explanation,
}) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  const revision = sourceRevision();
  if (!revision) throw new Error("Exact deployed revision required.");
  const valid = validateRemediationDecision({
    claimId: sourceReceiptClaimId,
    decision,
    explanation,
  });
  return scoped(actorUserId, revision, async (client) => {
    const row = await client.query(
      [
        "insert into public.service_fulfillment_remediation_decisions",
        "(organization_id,campground_id,source_revision,source_receipt_claim_id,",
        "decision,explanation,reviewed_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7) returning id,reviewed_at",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        revision,
        valid.claimId,
        valid.decision,
        valid.explanation,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "fulfillment.independent_remediation_decision",
      permissionKey: "staff.manage",
      riskLevel: "high",
      subjectType: "independent_remediation",
      subjectId: row.rows[0].id,
      metadata: { decision: valid.decision, acceptance: "HOLD" },
    });
    return {
      id: row.rows[0].id,
      at: iso(row.rows[0].reviewed_at),
      decision: valid.decision,
      masterConnected: false,
      ownerProductionAcceptance: "HOLD",
    };
  });
}
export async function listSourceRemediationEvidence({
  actorUserId,
  campgroundId,
}) {
  const grant = await authorizedOwner(actorUserId, campgroundId);
  return scoped(actorUserId, null, async (client) => {
    const exists = await client.query(
      "select to_regclass('public.service_fulfillment_source_receipt_claims') is not null as ready",
    );
    if (exists.rows[0]?.ready !== true)
      return {
        status: "HOLD_BUILD254_PRODUCTION_MIGRATION_NOT_ADOPTED",
        claims: [],
        decisions: [],
        truncated: false,
      };
    const [claims, decisions] = await Promise.all([
      client.query(
        [
          "select id,source_revision,receipt_type,master_plane,decision,",
          "claimed_by_user_id,claimed_at",
          "from public.service_fulfillment_source_receipt_claims",
          "where organization_id=$1 and campground_id=$2",
          "order by claimed_at desc,id desc limit 51",
        ].join(" "),
        [grant.organizationId, campgroundId],
      ),
      client.query(
        [
          "select id,source_receipt_claim_id,decision,reviewed_by_user_id,reviewed_at",
          "from public.service_fulfillment_remediation_decisions",
          "where organization_id=$1 and campground_id=$2",
          "order by reviewed_at desc,id desc limit 51",
        ].join(" "),
        [grant.organizationId, campgroundId],
      ),
    ]);
    return {
      status: "TENANT_SCOPED_SOURCE_REVIEW_LEDGER_READ",
      claims: claims.rows.slice(0, 50).map((row) => ({
        id: row.id,
        revision: row.source_revision,
        receiptType: row.receipt_type,
        masterPlane: row.master_plane,
        decision: row.decision,
        claimedBy: row.claimed_by_user_id,
        at: iso(row.claimed_at),
      })),
      decisions: decisions.rows.slice(0, 50).map((row) => ({
        id: row.id,
        claimId: row.source_receipt_claim_id,
        decision: row.decision,
        reviewedBy: row.reviewed_by_user_id,
        at: iso(row.reviewed_at),
      })),
      truncated: claims.rows.length > 50 || decisions.rows.length > 50,
    };
  });
}
export async function inspectBuild254Governance() {
  const [previous, freshness] = await Promise.all([
    inspectBuild253SupervisedReview(),
    Promise.resolve(protectedThreeMasterFreshness()),
  ]);
  return {
    sourceRevision: sourceRevision(),
    previous,
    freshness,
    security: assessTieredSecurity({
      sourceChecksumsMatch: previous.checksum.sourceChecksumsMatch,
      independentlySignedDatabase:
        previous.provenance.independentDatabaseProvenance,
      masterFreshness: freshness,
      tenantAuthenticated: false,
      independentDisposition: false,
      runtimeConnected: false,
    }),
    sourceOnly: true,
    receiverConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}
