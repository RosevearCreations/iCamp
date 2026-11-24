import { SOURCES275, verifySigned275 } from "../build275/diagnostics.mjs";
import { SHA276, UUID276 } from "../build276/core.mjs";
import { verifyFieldResponse277 } from "../build277/core.mjs";

export const RESTORE_SCOPES279 = Object.freeze([
  "tenant-isolation",
  "reservation-integrity",
  "payment-ledger",
  "service-health",
]);

export function validateCorrelation279(input) {
  if (
    !UUID276.test(input?.fieldReviewId ?? "") ||
    !UUID276.test(input?.providerReceiptId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_ORIGINAL_PROVIDER_RECEIPT_CORRELATION");
  return input;
}
export function validateRecoveryAudit279(input) {
  if (
    !UUID276.test(input?.mfaReadbackId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_ORIGINAL_OWNER_ACCESS_AUDIT");
  return input;
}
export function validateRestoreFinalization279(input) {
  if (
    !UUID276.test(input?.serviceReadbackId ?? "") ||
    ![
      "backupDigest",
      "tenantDigest",
      "reservationDigest",
      "paymentDigest",
      "healthDigest",
      "comparisonDigest",
    ].every((k) => SHA276.test(input?.[k] ?? ""))
  )
    throw Error("INVALID_ISOLATED_RESTORE_FINALIZATION");
  return input;
}

export function verifyOriginalCorrelation279(row, pins, now = Date.now()) {
  const fieldAccepted = Date.parse(row?.field_accepted_at ?? "");
  const providerReceived = Date.parse(row?.provider_received_at ?? "");
  const fieldReviewed = Date.parse(row?.field_reviewed_at ?? "");
  const correlated = Date.parse(row?.correlated_at ?? "");
  if (
    !Number.isFinite(fieldAccepted) ||
    !Number.isFinite(providerReceived) ||
    !Number.isFinite(fieldReviewed) ||
    fieldAccepted > now + 30000 ||
    providerReceived > now + 30000 ||
    fieldAccepted < now - 300000 ||
    providerReceived < now - 300000 ||
    fieldReviewed < fieldAccepted ||
    fieldReviewed > now + 30000 ||
    (Number.isFinite(correlated) &&
      (correlated < fieldReviewed || correlated > now + 30000))
  )
    throw Error("STALE_UNVERIFIED_FIELD_PROVIDER_PAIR");
  const c = verifyFieldResponse277({
    body: row.field_body,
    signature: row.field_signature,
    pins,
    issued: {
      source: row.source_id,
      keyId: row.key_id,
      commitSha: row.commit_sha,
      challengeId: row.challenge_id,
      requestNonce: row.request_nonce,
      issuedAt: Date.parse(row.issued_at),
      expiresAt: Date.parse(row.expires_at),
    },
    now: fieldAccepted,
  });
  const h = verifySigned275({
    body: row.provider_body,
    signature: row.provider_signature,
    pins,
    now: providerReceived,
  });
  if (
    c.source !== h.source ||
    c.source !== row.source_id ||
    c.keyId !== h.keyId ||
    c.keyId !== row.key_id ||
    c.commitSha !== h.commitSha ||
    c.commitSha !== row.commit_sha ||
    c.digest !== row.field_sha256 ||
    h.digest !== row.provider_sha256 ||
    c.nonce === h.nonce ||
    c.challengeId === h.challengeId ||
    Math.abs(Date.parse(h.observedAt) - Date.parse(c.observedAt)) > 300000
  )
    throw Error("UNMATCHED_OR_TAMPERED_SIGNED_PROVIDER_RECEIPT");
  return {
    source: c.source,
    keyId: c.keyId,
    commitSha: c.commitSha,
    fieldDigest: c.digest,
    providerDigest: h.digest,
  };
}

export function summarizeCorrelation279(rows, pins, now = Date.now()) {
  const sources = SOURCES275.map((source) => {
    const record = rows.find((r) => r.source_id === source);
    let status = "HOLD";
    if (record?.correlated_at) {
      try {
        if (verifyOriginalCorrelation279(record, pins, now).source === source)
          status =
            "TWO_ORIGINAL_SIGNATURES_CORRELATED_EXTERNAL_PROVIDER_CUSTODY_PENDING";
      } catch {}
    }
    return {
      source,
      status,
      fieldReviewId: record?.field_review_id ?? null,
      signedReceiptId: record?.signed_receipt_id ?? null,
      correlated: Boolean(record?.correlated_at),
    };
  });
  const verifiedCount = sources.filter((x) => x.status !== "HOLD").length;
  return {
    sources,
    verifiedCount,
    status:
      verifiedCount === 7
        ? "SEVEN_ORIGINAL_RECEIPTS_CORRELATED_EXTERNAL_PROVIDER_ATTESTATION_PENDING"
        : "HOLD_SEVEN_ORIGINAL_CORRELATED_PROVIDER_RECEIPTS",
  };
}
export function summarizeRecoveryAudit279(owner, session, readback) {
  const current = Boolean(
    owner?.status ===
      "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION" &&
    session?.user?.username?.toLowerCase() === "rosevear" &&
    session?.assuranceLevel === "aal2" &&
    session?.sessionId === readback?.sessionId &&
    session?.user?.id === readback?.ownerId,
  );
  return {
    status: current
      ? "ORIGINAL_RECOVERY_ACCESS_AUDIT_RECORDED_CURRENT_MFA_SESSION"
      : "HOLD_ORIGINAL_RECOVERY_ACCESS_AUDIT",
  };
}
export function summarizeIsolatedFinalization279(rows) {
  const completed = rows.filter((x) => x.finalized === true);
  return {
    finalizedCount: completed.length,
    productionRestored: false,
    providerCertified: false,
    status:
      completed.length > 0
        ? "ISOLATED_FOUR_SCOPE_EVIDENCE_REVIEWED_EXTERNAL_PROVIDER_CLOSURE_PENDING"
        : "HOLD_ISOLATED_RESTORE_EVIDENCE_FINALIZATION",
  };
}
export function classifyClosure279({ admission, peers, owner, restore }) {
  const linked = Boolean(
    admission?.adopted &&
    admission?.host?.pinned &&
    peers?.verifiedCount === 7 &&
    owner?.status ===
      "ORIGINAL_RECOVERY_ACCESS_AUDIT_RECORDED_CURRENT_MFA_SESSION" &&
    restore?.finalizedCount > 0,
  );
  return {
    status: linked
      ? "ALL_LINKED_EVIDENCE_PRESENT_PROVIDER_FINAL_ACCEPTANCE_PENDING"
      : "HOLD_ORIGINAL_PROVIDER_RECOVERY_FINAL_ACCEPTANCE",
    productionRestored: false,
    providerCertified: false,
  };
}
