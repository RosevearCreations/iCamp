import { createHash } from "node:crypto";
import { SOURCES275, verifySigned275 } from "../build275/diagnostics.mjs";
import { SHA276, UUID276 } from "../build276/core.mjs";

export const SIGNED_SOURCES277 = SOURCES275;
export const RECEIPT_ID277 = /^[A-Za-z0-9_-]{16,96}$/u;

export function originalHostPin277(databaseUrl, expectedHost) {
  let host;
  try {
    const parsed = new URL(databaseUrl ?? "");
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw Error("DB_PROTOCOL");
    host = parsed.hostname.toLowerCase();
  } catch {
    return { configured: false, pinned: false, status: "HOLD_ORIGINAL_DATABASE_URL" };
  }
  const expected = String(expectedHost ?? "").trim().toLowerCase();
  if (!expected || !/^[a-z0-9.-]{6,255}$/u.test(expected) ||
      expected.startsWith(".") || expected.endsWith("."))
    return { configured: false, pinned: false, status: "HOLD_OWNER_DATABASE_HOST_PIN" };
  return { configured: true, pinned: host === expected,
    status: host === expected
      ? "HOST_MATCHES_OWNER_EXPECTED_PIN_SCHEMA_STILL_REQUIRES_VERIFICATION"
      : "HOLD_PIN_MISMATCH"};
}

export function validateOwnerPin277(input) {
  if (!UUID276.test(input?.proposalId ?? "") ||
      !SHA276.test(input?.evidenceDigest ?? "") ||
      !UUID276.test(input?.ownerSessionId ?? "") ||
      !UUID276.test(input?.ownerUserId ?? "") ||
      input?.ownerUsername?.toLowerCase() !== "rosevear" ||
      input?.assuranceLevel !== "aal2")
    throw Error("ORIGINAL_ROSEVEAR_AAL2_PIN_ADOPTION_REQUIRED");
  return input;
}

export function verifyFieldResponse277({ body, signature, pins, issued, now=Date.now() }) {
  const receipt = verifySigned275({body, signature, pins, now});
  if (!issued || receipt.challengeId !== issued.challengeId ||
      receipt.source !== issued.source || receipt.keyId !== issued.keyId ||
      receipt.commitSha !== issued.commitSha || receipt.nonce === issued.requestNonce ||
      !Number.isFinite(issued.issuedAt) || !Number.isFinite(issued.expiresAt) ||
      now < issued.issuedAt || now > issued.expiresAt ||
      Date.parse(receipt.observedAt) < issued.issuedAt ||
      Date.parse(receipt.observedAt) > issued.expiresAt + 30000)
    throw Error("UNMATCHED_EXPIRED_OR_REPLAYED_SERVER_CHALLENGE");
  return receipt;
}

export function classifyFieldReadback277(rows, pins, now=Date.now()) {
  const checks = SOURCES275.map(source=>{
    const row = rows.find(x=>x.source_id===source);
    let status="HOLD";
    if (row) {
      try {
        const receipt=verifyFieldResponse277({
          body:row.signed_body, signature:row.signature_b64url, pins,
          issued:{
            source:row.source_id, keyId:row.key_id,
            commitSha:row.commit_sha, challengeId:row.challenge_id,
            requestNonce:row.request_nonce, issuedAt:Date.parse(row.issued_at),
            expiresAt:Date.parse(row.expires_at),
          },now:Date.parse(row.accepted_at),
        });
        if (receipt.digest===row.body_sha256 &&
            Date.parse(row.accepted_at)>=Date.parse(row.issued_at) &&
            Date.parse(row.accepted_at)<=Date.parse(row.expires_at) &&
            now - Date.parse(row.accepted_at)<=300000 &&
            Date.parse(row.accepted_at)<=now+30000)
          status="FIELD_CHALLENGE_CRYPTOGRAPHICALLY_VERIFIED_EXTERNAL_REVIEW_PENDING";
      } catch {}
    }
    return {source,status};
  });
  const count=checks.filter(c=>c.status!=="HOLD").length;
  return {checks,count,status:count===7?
    "SEVEN_FRESH_FIELD_CHALLENGES_PENDING_INDEPENDENT_SOURCE_ACCEPTANCE":
    "HOLD_SEVEN_ORIGINAL_SIGNED_FIELD_CHALLENGES"};
}

export function classifyExternalRestore277(original, external, readbackVerified) {
  return {
    status: original === true && external === true && readbackVerified === true
      ? "INDEPENDENT_EXTERNAL_RESTORE_EVIDENCE_PRESENT_FIELD_REVIEW_REQUIRED"
      : "HOLD_INDEPENDENT_EXTERNAL_RESTORE_ACCEPTANCE",
    actualRestoreExecuted:false,
  };
}

export function closure277({ host, owner, peer, restore }) {
  return {
    status: host?.pinned && owner?.status ===
      "OWNER_EVIDENCE_PRESENT_INDEPENDENT_REVIEW_REQUIRED" &&
      peer?.count === 7 &&
      restore?.status ===
        "INDEPENDENT_EXTERNAL_RESTORE_EVIDENCE_PRESENT_FIELD_REVIEW_REQUIRED"
      ? "ALL_ORIGINAL_EVIDENCE_PRESENT_INDEPENDENT_CLOSURE_PENDING"
      : "HOLD_ORIGINAL_EXTERNAL_RECOVERY_CERTIFICATION",
    productionRestored:false,
  };
}

export function digest277(raw) {
  return createHash("sha256").update(raw).digest("hex");
}
