import { createHash, createPublicKey } from "node:crypto";
import { SOURCES275, verifySigned275 } from "../build275/diagnostics.mjs";

export const UUID276 = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export const SHA276 = /^[a-f0-9]{64}$/u;
const KEY_ID = /^[a-z0-9_-]{8,80}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;

export function validateSigner276(value) {
  if (!value || !SOURCES275.includes(value.sourceId) ||
    !KEY_ID.test(value.keyId ?? "") || !COMMIT.test(value.commitSha ?? "") ||
    !SHA276.test(value.evidenceDigest ?? "") ||
    !SHA276.test(value.keyFingerprint ?? "") ||
    typeof value.publicKeyPem !== "string" ||
    value.publicKeyPem.length > 1200 ||
    !value.publicKeyPem.trim().startsWith("-----BEGIN PUBLIC KEY-----") ||
    !value.publicKeyPem.trim().endsWith("-----END PUBLIC KEY-----") ||
    value.publicKeyPem.includes("PRIVATE KEY")) throw Error("INVALID_OR_UNVERIFIED_SIGNER");
  let key;
  try { key = createPublicKey(value.publicKeyPem); } catch { throw Error("INVALID_ED25519_PUBLIC_KEY"); }
  if (key.asymmetricKeyType !== "ed25519") throw Error("ED25519_KEY_REQUIRED");
  const fingerprint = createHash("sha256").update(
    key.export({type:"spki",format:"der"})).digest("hex");
  if (fingerprint !== value.keyFingerprint) throw Error("INDEPENDENT_FINGERPRINT_MISMATCH");
  return {...value, publicKeyPem: key.export({type:"spki",format:"pem"}).trim() + "\n"};
}

export function validateRegistryRow276(row) {
  try {
    const candidate = validateSigner276({
      sourceId: row.source_id, keyId: row.key_id,
      commitSha: row.commit_sha, publicKeyPem: row.public_key_pem,
      evidenceDigest: row.evidence_sha256,
      keyFingerprint: row.key_fingerprint_sha256,
    });
    return {sourceId:candidate.sourceId, keyId:candidate.keyId,
      commitSha:candidate.commitSha, publicKeyPem:candidate.publicKeyPem};
  } catch { return null; }
}

export function classifyOwner276(owner, ownerSession, originalWitnesses) {
  const gate = (ready, detail) => ({
    status: ready ? "OBSERVED_REVIEW_REQUIRED" : "HOLD", detail,
  });
  const checks = [
    {id:"original-host", ...gate(owner?.identifiedOriginalHost === true, "Original database identity and migration must be pinned")},
    {id:"rosevear-account", ...gate(owner?.accountFound && owner?.accountActive, "Original Rosevear staff account must be active")},
    {id:"personal-password", ...gate(owner?.credentialPresent, "Original password verifier must exist; the one-time credential is not an everyday password")},
    {id:"verified-contact", ...gate(owner?.recoveryEmailVerified, "Independent verified original contact required")},
    {id:"owner-binding", ...gate(owner?.platformGrantActive && owner?.independentOwnerBinding, "Original independent owner binding and platform grant required")},
    {id:"verified-mfa", ...gate(owner?.mfaVerified && ownerSession?.originalRosevear && ownerSession?.aal2, "Genuine Rosevear AAL2 session needed, not a synthetic login")},
    {id:"independent-login-witness", ...gate(originalWitnesses > 0, "Separate original reviewer must witness active AAL2 owner session")},
  ];
  return {status:checks.every((check)=>check.status==="OBSERVED_REVIEW_REQUIRED")?
    "OWNER_EVIDENCE_PRESENT_INDEPENDENT_REVIEW_REQUIRED":"HOLD_ORIGINAL_OWNER_RECOVERY",checks};
}

export function verifyReadback276(rows, pins, now=Date.now()) {
  const result = [];
  for (const source of SOURCES275) {
    const row = rows.find(r=>r.source_id===source);
    let status="HOLD";
    if (row && pins[source]) {
      try {
        const receipt=verifySigned275({
          body:row.signed_body,signature:row.signature_b64url,pins,now});
        if (receipt.source===source && receipt.digest===row.body_sha256 &&
            receipt.keyId===row.key_id && receipt.commitSha===row.commit_sha &&
            Date.parse(receipt.observedAt)===Date.parse(row.observed_at))
          status="CRYPTOGRAPHIC_READBACK_REVIEW_REQUIRED";
      } catch {}
    }
    result.push({source,status});
  }
  return {sources:result,verifiedCount:result.filter(r=>r.status!=="HOLD").length,
    status:result.every(r=>r.status!=="HOLD")?
      "SEVEN_PEERS_VERIFIED_PENDING_EXTERNAL_ACCEPTANCE":"HOLD_MISSING_OR_UNVERIFIED_PEERS"};
}

export function classifyRestore276(rows) {
  return {reviewed: rows.filter(r=>r.reviewed_at).length,
    status:rows.some(r=>r.reviewed_at)?
      "INDEPENDENT_REVIEW_STORED_EXTERNAL_RESTORE_NOT_ASSERTED":
      "HOLD_INDEPENDENT_RESTORE_CLOSURE"};
}
