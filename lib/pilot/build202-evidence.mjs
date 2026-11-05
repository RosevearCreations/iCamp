export const BUILD202_EVIDENCE_CLASSES = Object.freeze([
  "real_device",
  "independent_source_signer",
  "hub_peer_enrollment",
  "owner_test_authorization",
  "signed_test_handshake",
]);
export const BUILD202_DEVICES = Object.freeze([
  "PHONE_TOUCH",
  "TABLET_TOUCH",
  "DESKTOP_KEYBOARD",
  "SCREEN_READER_KEYBOARD",
  "OFFLINE_RECOVERY",
]);
export const BUILD202_STATUS = "SUBMITTED_UNVERIFIED";
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ref =
  /^(?:issue|ticket|review|owner|test|evidence|receipt)-[a-zA-Z0-9][a-zA-Z0-9._-]{4,79}$/;
const digest = /^[a-f0-9]{64}$/;

export function validateBuild202Evidence(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_EVIDENCE_PACKET");
  const permitted = new Set([
    "campgroundId",
    "sourceClass",
    "evidenceRef",
    "claimedSha256",
    "deviceProfile",
  ]);
  if (Object.keys(input).some((key) => !permitted.has(key)))
    throw new Error("UNTRUSTED_APPROVAL_OR_PRIVATE_FIELDS");
  if (typeof input.campgroundId !== "string" || !uuid.test(input.campgroundId))
    throw new Error("INVALID_CAMPGROUND_SCOPE");
  if (!BUILD202_EVIDENCE_CLASSES.includes(input.sourceClass))
    throw new Error("INVALID_EVIDENCE_CLASS");
  if (typeof input.evidenceRef !== "string" || !ref.test(input.evidenceRef))
    throw new Error("INVALID_EVIDENCE_REFERENCE");
  if (
    typeof input.claimedSha256 !== "string" ||
    !digest.test(input.claimedSha256)
  )
    throw new Error("INVALID_CLAIMED_DIGEST");
  if (
    input.sourceClass === "real_device"
      ? !BUILD202_DEVICES.includes(input.deviceProfile)
      : input.deviceProfile !== null && input.deviceProfile !== undefined
  )
    throw new Error("DEVICE_SCOPE_MISMATCH");
  return Object.freeze({
    campgroundId: input.campgroundId.toLowerCase(),
    sourceClass: input.sourceClass,
    evidenceRef: input.evidenceRef,
    claimedSha256: input.claimedSha256,
    deviceProfile:
      input.sourceClass === "real_device" ? input.deviceProfile : null,
    disposition: BUILD202_STATUS,
    independentVerification: false,
  });
}

export function build202EvidenceReadback(rows = []) {
  if (!Array.isArray(rows)) throw new Error("INVALID_EVIDENCE_ROWS");
  const evidence = rows.slice(0, 100).map((row) => ({
    id: row.id,
    sourceClass: row.source_class,
    evidenceRef: row.evidence_ref,
    claimedSha256: row.claimed_sha256,
    deviceProfile: row.device_profile,
    submittedAt: new Date(row.created_at).toISOString(),
    disposition: BUILD202_STATUS,
    independentVerification: false,
  }));
  return Object.freeze({
    schema: "icamp.build202.pilot-evidence-intake.v1",
    rows: evidence,
    peer_enrollment: "NOT_INDEPENDENTLY_VERIFIED",
    source_signer: "NOT_INDEPENDENTLY_VERIFIED",
    scope_test_approval: "NOT_INDEPENDENTLY_VERIFIED",
    signed_get_witness: "NOT_INDEPENDENTLY_VERIFIED",
    connection_state: "DISCONNECTED / HOLD",
    owner_go_live_decision: "NO_GO_PENDING_EVIDENCE",
    no_activation_or_external_dispatch: true,
  });
}
