import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { assessDeviceVerifierPin } from "../booking-charges/fulfillment-dossier-readback-core.mjs";

const REV = /^[a-f0-9]{40}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
export const BUILD251_TABLES = Object.freeze([
  "service_fulfillment_device_signature_verifications",
  "service_fulfillment_original_device_witness_admissions",
  "service_fulfillment_owner_ceremony_reviews",
]);
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function classifyProductionDatabase({
  sourceRevision,
  databaseConfigured,
  expectedHost,
  runtimeHost,
  querySucceeded,
  tables,
}) {
  const checklist = BUILD251_TABLES.map((name) => {
    const entry = Array.isArray(tables)
      ? tables.find((table) => table?.name === name)
      : null;
    return {
      name,
      present: entry?.present === true,
      rowLevelSecurity: entry?.rowLevelSecurity === true,
      forceRowLevelSecurity: entry?.forceRowLevelSecurity === true,
      ownerOnlyPolicies: Number.isInteger(entry?.policyCount)
        ? entry.policyCount >= 2
        : false,
      appendOnly: entry?.appendOnly === true,
      hasGuardTrigger: entry?.hasGuardTrigger === true,
    };
  });
  const ready = checklist.every(
    (t) =>
      t.present &&
      t.rowLevelSecurity &&
      t.forceRowLevelSecurity &&
      t.ownerOnlyPolicies &&
      t.appendOnly &&
      t.hasGuardTrigger,
  );
  const targetPinned =
    typeof expectedHost === "string" &&
    expectedHost.length > 4 &&
    expectedHost === runtimeHost;
  let status = "HOLD_PRODUCTION_DATABASE_UNAVAILABLE";
  if (!databaseConfigured) status = "HOLD_RUNTIME_DATABASE_NOT_CONFIGURED";
  else if (!expectedHost)
    status = "HOLD_INDEPENDENT_DATABASE_TARGET_NOT_PINNED";
  else if (!targetPinned) status = "HOLD_DATABASE_TARGET_PIN_MISMATCH";
  else if (!querySucceeded) status = "HOLD_DATABASE_READBACK_FAILED";
  else if (!ready) status = "HOLD_REQUIRED_MIGRATIONS_NOT_VERIFIED";
  else if (!REV.test(String(sourceRevision ?? "")))
    status = "HOLD_EXACT_DEPLOYMENT_SHA_UNAVAILABLE";
  else status = "RUNTIME_SCHEMA_VERIFIED_AGAINST_CONFIGURED_PIN";
  return {
    status,
    runtimeTargetPinMatches: targetPinned,
    sourceRevision: REV.test(String(sourceRevision ?? ""))
      ? sourceRevision
      : null,
    checklist,
    schemaVerified: status === "RUNTIME_SCHEMA_VERIFIED_AGAINST_CONFIGURED_PIN",
    independentlyApprovedProductionDatabase: false,
    masterConnected: false,
  };
}

export function custodyAttestationMessage(receipt) {
  return JSON.stringify([
    "icamp.original-source-signer-custody.v1",
    receipt.sourceId,
    receipt.sourceRevision,
    receipt.originalSignerFingerprintSha256,
    receipt.reviewerKeyId,
    receipt.observedAt,
    receipt.nonce,
    receipt.decision,
  ]);
}

export function inspectOriginalSignerEnrollment({
  sourceRevision,
  originalPin,
  originalCustodianEnrolled,
  reviewerPin,
  reviewerReceipt,
  asOf,
}) {
  const fail = (status, originalPinConfigured = false) => ({
    status,
    originalPinConfigured,
    independentReviewerAttested: false,
    operationalSourceHealthy: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  });
  const result = assessDeviceVerifierPin({
    custodianEnrolled: originalCustodianEnrolled,
    trust: originalPin,
  });
  if (!result.configured) return fail(result.status);
  if (
    !REV.test(String(sourceRevision ?? "")) ||
    !reviewerReceipt ||
    !reviewerPin ||
    reviewerReceipt.sourceId !== "icamp" ||
    reviewerReceipt.sourceRevision !== sourceRevision ||
    reviewerReceipt.originalSignerFingerprintSha256 !==
      originalPin.independentlyAuthenticatedSpkiFingerprint ||
    reviewerReceipt.decision !== "ORIGINAL_SOURCE_KEY_CUSTODY_OBSERVED" ||
    reviewerReceipt.reviewerKeyId !== reviewerPin.keyId ||
    reviewerReceipt.reviewerKeyId === originalPin.keyId
  )
    return fail("HOLD_INDEPENDENT_REVIEWER_CUSTODY_EVIDENCE_MISSING", true);
  const reviewed = assessDeviceVerifierPin({
    custodianEnrolled: true,
    trust: reviewerPin,
  });
  if (!reviewed.configured)
    return fail("HOLD_INVALID_INDEPENDENT_REVIEWER_PIN", true);
  if (
    reviewerPin.independentlyAuthenticatedSpkiFingerprint ===
    originalPin.independentlyAuthenticatedSpkiFingerprint
  )
    return fail("HOLD_REVIEWER_MUST_BE_DISTINCT", true);
  const observed = Date.parse(reviewerReceipt.observedAt);
  const now = Date.parse(asOf);
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(now) ||
    observed > now + 60_000 ||
    now - observed > 24 * 60 * 60 * 1000 ||
    !/^[A-Za-z0-9_-]{22,96}$/u.test(String(reviewerReceipt.nonce ?? ""))
  )
    return fail("HOLD_STALE_OR_INVALID_CUSTODY_OBSERVATION", true);
  try {
    const signatureB64 = String(reviewerReceipt.signatureBase64 ?? "");
    if (!B64.test(signatureB64) || signatureB64.length > 1024)
      return fail("HOLD_INVALID_REVIEWER_SIGNATURE", true);
    const signature = Buffer.from(signatureB64, "base64");
    if (
      signature.length !== 64 ||
      signature.toString("base64") !== signatureB64
    )
      return fail("HOLD_INVALID_REVIEWER_SIGNATURE", true);
    const publicKey = createPublicKey({
      key: Buffer.from(reviewerPin.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });
    if (
      !verifySignature(
        null,
        Buffer.from(custodyAttestationMessage(reviewerReceipt), "utf8"),
        publicKey,
        signature,
      )
    )
      return fail("HOLD_REVIEWER_SIGNATURE_MISMATCH", true);
    return {
      status: "ORIGINAL_SIGNER_CUSTODY_WITNESSED_SOURCE_ONLY",
      originalPinConfigured: true,
      independentReviewerAttested: true,
      receiptDigestSha256: sha256(custodyAttestationMessage(reviewerReceipt)),
      operationalSourceHealthy: false,
      masterConnected: false,
      ownerProductionAcceptance: "HOLD",
    };
  } catch {
    return fail("HOLD_INVALID_REVIEWER_SIGNATURE", true);
  }
}

const FORM_FACTORS = ["desktop", "tablet", "mobile"];
const VISUALS = ["standard", "orbit"];
const REQUIRED_CHECKS = [
  "heroVisible",
  "navigationUsable",
  "textReadable",
  "noHorizontalOverflow",
];

export function assessCrossDeviceThemeAcceptance({
  records,
  sourceRevision,
  asOf,
}) {
  const deny = (status, completed = []) => ({
    status,
    completed,
    manualChecksComplete: false,
    independentAcceptance: false,
    authorizationGranted: false,
  });
  if (!REV.test(String(sourceRevision ?? "")))
    return deny("HOLD_SOURCE_REVISION_UNAVAILABLE");
  if (!Array.isArray(records) || records.length > 12)
    return deny("HOLD_INVALID_DEVICE_REPORTS");
  const now = Date.parse(asOf);
  if (!Number.isFinite(now)) return deny("HOLD_INVALID_REVIEW_TIME");
  const pairs = new Map();
  const formFactorIds = new Map();
  for (const r of records) {
    if (
      !r ||
      r.schema !== "icamp.theme.manual-acceptance.v1" ||
      !FORM_FACTORS.includes(r.formFactor) ||
      !VISUALS.includes(r.visual) ||
      r.sourceRevision !== sourceRevision ||
      !/^[a-f0-9-]{36}$/iu.test(String(r.deviceId ?? "")) ||
      !Number.isFinite(Date.parse(r.recordedAt)) ||
      Date.parse(r.recordedAt) > now + 60_000 ||
      now - Date.parse(r.recordedAt) > 7 * 24 * 60 * 60 * 1000 ||
      !REQUIRED_CHECKS.every((key) => r.checks?.[key] === true)
    )
      return deny("HOLD_UNVERIFIED_DEVICE_CHECKLIST");
    if (
      formFactorIds.has(r.formFactor) &&
      formFactorIds.get(r.formFactor) !== r.deviceId
    )
      return deny("HOLD_MULTIPLE_DEVICES_FOR_SAME_FORM_FACTOR");
    formFactorIds.set(r.formFactor, r.deviceId);
    const key = r.formFactor + ":" + r.visual;
    if (pairs.has(key)) return deny("HOLD_DUPLICATE_THEME_REPORT");
    pairs.set(key, true);
  }
  const completed = FORM_FACTORS.flatMap((formFactor) =>
    VISUALS.filter((visual) => pairs.has(formFactor + ":" + visual)).map(
      (visual) => formFactor + ":" + visual,
    ),
  );
  if (completed.length !== 6)
    return deny("HOLD_MISSING_CROSS_DEVICE_THEME_REVIEWS", completed);
  if (new Set(formFactorIds.values()).size !== 3)
    return deny("HOLD_DISTINCT_DEVICE_EVIDENCE_REQUIRED", completed);
  return {
    status: "MANUAL_CROSS_DEVICE_CHECKLIST_COMPLETE_UNVERIFIED",
    completed,
    manualChecksComplete: true,
    independentAcceptance: false,
    authorizationGranted: false,
  };
}
