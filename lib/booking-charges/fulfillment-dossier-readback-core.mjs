import { createHash, createPublicKey } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{64}$/u;
const REV = /^[0-9a-f]{40}$/u;
const KEY = /^[a-zA-Z0-9_.:-]{8,96}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

const result = (status, count = 0) => ({
  status,
  reviewedSnapshotCount: count,
  contentDigestRecomputed: false,
  independentSignatureVerified: false,
  ownerProductionAcceptance: "HOLD",
  masterConnection: "HOLD",
});

/** Protected server configuration only: never infer independent enrollment
 * merely because a browser or local test supplied a public key. */
export function assessDeviceVerifierPin({ custodianEnrolled, trust }) {
  if (
    custodianEnrolled !== true ||
    !trust?.keyId ||
    !trust?.publicKeySpkiBase64 ||
    !trust?.independentlyAuthenticatedSpkiFingerprint
  )
    return {
      status: "HOLD_INDEPENDENT_DEVICE_PIN_NOT_ENROLLED",
      configured: false,
    };
  if (
    !KEY.test(String(trust.keyId)) ||
    !SHA.test(String(trust.independentlyAuthenticatedSpkiFingerprint))
  )
    return { status: "HOLD_INVALID_PIN_METADATA", configured: false };
  try {
    const encoded = String(trust.publicKeySpkiBase64);
    if (encoded.length > 8192 || !B64.test(encoded))
      return { status: "HOLD_INVALID_PIN_MATERIAL", configured: false };
    const der = Buffer.from(encoded, "base64");
    if (!der.length || der.toString("base64") !== encoded)
      return { status: "HOLD_INVALID_PIN_MATERIAL", configured: false };
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519")
      return { status: "HOLD_WRONG_PIN_ALGORITHM", configured: false };
    const actual = createHash("sha256").update(der).digest("hex");
    if (actual !== trust.independentlyAuthenticatedSpkiFingerprint)
      return { status: "HOLD_PIN_FINGERPRINT_MISMATCH", configured: false };
    return {
      status: "PIN_CONFIGURED_REQUIRES_INDEPENDENT_SOURCE_WITNESS",
      configured: true,
    };
  } catch {
    return { status: "HOLD_INVALID_PIN_MATERIAL", configured: false };
  }
}

/** This verifies *stored pointer lineage*, not the original document bytes
 * or an external cryptographic signature. Query is already tenant/owner RLS
 * scoped; the caller supplies the selected campground to defend that scope. */
export function auditOwnerDossierLineage({
  campgroundId,
  snapshots,
  windowTruncated = false,
}) {
  if (!UUID.test(String(campgroundId)))
    return result("HOLD_INVALID_CAMPGROUND_SCOPE");
  if (!Array.isArray(snapshots))
    return result("HOLD_DOSSIER_READBACK_UNAVAILABLE");
  if (!snapshots.length)
    return result("HOLD_NO_DOSSIER_SNAPSHOTS");
  const ids = new Set();
  for (const snapshot of snapshots) {
    if (
      !UUID.test(String(snapshot?.id)) ||
      !UUID.test(String(snapshot?.campgroundId)) ||
      snapshot.campgroundId !== campgroundId ||
      !REV.test(String(snapshot?.sourceRevision)) ||
      !SHA.test(String(snapshot?.digestSha256)) ||
      !["SOURCE_SNAPSHOT_ONLY", "PARTIAL_HOLD"].includes(
        snapshot?.completeness,
      ) ||
      ![
        snapshot?.witnessCount,
        snapshot?.deviceReviewCount,
        snapshot?.forecastCount,
        snapshot?.auditedCount,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isFinite(Date.parse(snapshot?.recordedAt)) ||
      ids.has(snapshot.id)
    )
      return result("HOLD_MALFORMED_DOSSIER_RECORD", snapshots.length);
    ids.add(snapshot.id);
  }
  for (let index = 0; index < snapshots.length - 1; index += 1) {
    const newest = snapshots[index];
    const older = snapshots[index + 1];
    if (
      Date.parse(newest.recordedAt) < Date.parse(older.recordedAt) ||
      newest.previousSnapshotId !== older.id ||
      newest.previousDigestSha256 !== older.digestSha256
    )
      return result("HOLD_BROKEN_DOSSIER_POINTER", snapshots.length);
  }
  const oldest = snapshots[snapshots.length - 1];
  if (windowTruncated || oldest.previousSnapshotId !== null)
    return result("HOLD_INCOMPLETE_DOSSIER_WINDOW", snapshots.length);
  if (oldest.previousDigestSha256 !== null)
    return result("HOLD_BROKEN_DOSSIER_ROOT", snapshots.length);
  return result(
    "POINTER_CHAIN_CONSISTENT_UNSIGNED_NOT_CONTENT_VERIFIED",
    snapshots.length,
  );
}
