const SHA40 = /^[a-f0-9]{40}$/u;
const SHA64 = /^[a-f0-9]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const NONCE = /^[A-Za-z0-9_-]{22,96}$/u;
const TENANT_EVENTS = new Set(["fulfillment_signal.v1", "security_exception.v1"]);
const MFA_ACTIONS = new Set([
  "custody.review",
  "contract.approve",
  "security.exception.review",
  "campground.reservation.manage",
  "worker.job.manage",
  "brand.booking.manage",
]);
export const REGISTRY_SCHEMA = "rosevear.seven-app-identity-registry.v1";
export const ENVELOPE_SCHEMA = "rosevear.seven-app-source-envelope.v1";
export const SECURITY_TIERS = Object.freeze([
  "T0_PUBLIC",
  "T1_SOURCE",
  "T2_SIGNED_CUSTODY",
  "T3_SCOPED_IDENTITY",
  "T4_INDEPENDENT_REVIEW",
  "T5_LIVE_TRANSPORT",
]);
export const APPLICATIONS = Object.freeze([
  {
    id: "ai-data-platform",
    repository: "RosevearCreations/ai-data-platform",
    model: "MASTER_TOP_TIER",
    parent: null,
    tenantScoped: false,
  },
  {
    id: "rosevear-ai-hub",
    repository: "RosevearCreations/rosevear-ai-hub",
    model: "MASTER_APPLICATION",
    parent: "ai-data-platform",
    tenantScoped: false,
  },
  {
    id: "rosevear-comms-hub",
    repository: "RosevearCreations/rosevear-comms-hub",
    model: "MASTER_APPLICATION",
    parent: "ai-data-platform",
    tenantScoped: false,
  },
  {
    id: "icamp",
    repository: "RosevearCreations/iCamp",
    model: "GOVERNED_EXTERNAL_SHELL",
    parent: "ai-data-platform",
    tenantScoped: true,
  },
  {
    id: "yw",
    repository: "RosevearCreations/yw",
    model: "GOVERNED_EXTERNAL_SHELL",
    parent: "ai-data-platform",
    tenantScoped: true,
  },
  {
    id: "devilndove",
    repository: "RosevearCreations/devilndove-site",
    model: "DIRECT_MASTER_APPLICATION",
    parent: "ai-data-platform",
    tenantScoped: false,
  },
  {
    id: "rosiedazzlers",
    repository: "RosevearCreations/rosiedazzlers",
    model: "DIRECT_MASTER_APPLICATION",
    parent: "ai-data-platform",
    tenantScoped: false,
  },
]);
export const ROLE_PERMISSION_MATRIX = Object.freeze({
  "ai-data-platform": Object.freeze({
    registry_reviewer: Object.freeze([
      "contract.validate",
      "security.exception.review",
    ]),
    registry_approver: Object.freeze([
      "contract.validate",
      "contract.approve",
      "custody.review",
    ]),
  }),
  "rosevear-ai-hub": Object.freeze({
    host_observer: Object.freeze(["device.off.read"]),
    host_custodian: Object.freeze(["device.off.read", "custody.review"]),
  }),
  "rosevear-comms-hub": Object.freeze({
    routing_observer: Object.freeze(["message.route.read"]),
    routing_reviewer: Object.freeze([
      "message.route.read",
      "security.exception.review",
    ]),
  }),
  icamp: Object.freeze({
    campground_viewer: Object.freeze(["campground.reservation.read"]),
    campground_owner: Object.freeze([
      "campground.reservation.read",
      "campground.reservation.manage",
      "security.exception.review",
    ]),
  }),
  yw: Object.freeze({
    worker_viewer: Object.freeze(["worker.job.read"]),
    worker_manager: Object.freeze(["worker.job.read", "worker.job.manage"]),
  }),
  devilndove: Object.freeze({
    catalog_viewer: Object.freeze(["brand.catalog.read"]),
    brand_owner: Object.freeze(["brand.catalog.read", "brand.booking.manage"]),
  }),
  rosiedazzlers: Object.freeze({
    booking_viewer: Object.freeze(["brand.booking.read"]),
    booking_owner: Object.freeze(["brand.booking.read", "brand.booking.manage"]),
  }),
});
export const EVENT_TYPES = Object.freeze([
  "capability_status.v1",
  "custody_renewal.v1",
  "security_exception.v1",
  "fulfillment_signal.v1",
]);

const appById = (id) => APPLICATIONS.find((app) => app.id === id);
const validTime = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

/** Verify the authoritative repository topology; not a network discovery call. */
export function validateRegistryAgainstTopology(topology) {
  const expected = [...APPLICATIONS].map((a) => a.id).sort();
  const records = topology?.applications;
  if (
    topology?.schema !== "rosevear.master-repository-topology.v1" ||
    topology?.self?.appId !== "icamp" ||
    topology?.validationAuthority?.appId !== "ai-data-platform" ||
    !Array.isArray(records) ||
    records.length !== 7 ||
    new Set(records.map((a) => a.appId)).size !== 7 ||
    JSON.stringify(records.map((a) => a.appId).sort()) !==
      JSON.stringify(expected)
  ) {
    return { status: "HOLD_CANONICAL_TOPOLOGY_MISMATCH", valid: false };
  }
  for (const app of APPLICATIONS) {
    const record = records.find((item) => item.appId === app.id);
    if (
      record?.repository !== app.repository ||
      record?.connectionModel !== app.model ||
      record?.externalShell !== (app.model === "GOVERNED_EXTERNAL_SHELL")
    ) {
      return { status: "HOLD_CANONICAL_TOPOLOGY_MISMATCH", valid: false };
    }
  }
  if (
    topology?.rules?.masterApplications !== 3 ||
    topology?.rules?.governedExternalShellApplications !== 2 ||
    topology?.rules?.directMasterApplications !== 2 ||
    topology?.rules?.authorityTransfer !== false
  ) {
    return { status: "HOLD_CANONICAL_TOPOLOGY_MISMATCH", valid: false };
  }
  return { status: "SOURCE_TOPOLOGY_MATCH_REVIEW_ONLY", valid: true };
}

/** Structural checks only. Not proof of signature, sender or live transport. */
export function validateSourceEnvelope(envelope, { asOf } = {}) {
  const now = Date.parse(asOf ?? "");
  if (
    !envelope ||
    typeof envelope !== "object" ||
    Array.isArray(envelope) ||
    !Number.isFinite(now)
  )
    return { valid: false, status: "HOLD_MALFORMED_ENVELOPE" };
  const keys = Object.keys(envelope);
  const accepted = [
    "schema",
    "sourceAppId",
    "targetAppId",
    "sourceRevision",
    "eventType",
    "issuedAt",
    "nonce",
    "tenantId",
    "dataClassification",
    "contractVersion",
  ];
  if (keys.some((k) => !accepted.includes(k)))
    return { valid: false, status: "HOLD_UNAPPROVED_ENVELOPE_FIELDS" };
  const sender = appById(envelope.sourceAppId);
  const recipient = appById(envelope.targetAppId);
  const sent = Date.parse(envelope.issuedAt);
  if (
    envelope.schema !== ENVELOPE_SCHEMA ||
    envelope.contractVersion !== REGISTRY_SCHEMA ||
    !sender ||
    !recipient ||
    sender.id === recipient.id ||
    !SHA40.test(String(envelope.sourceRevision ?? "")) ||
    !EVENT_TYPES.includes(envelope.eventType) ||
    !NONCE.test(String(envelope.nonce ?? "")) ||
    !validTime(envelope.issuedAt) ||
    now - sent < -60_000 ||
    now - sent > 15 * 60_000 ||
    envelope.dataClassification !== "non_sensitive_metadata"
  )
    return { valid: false, status: "HOLD_CONTRACT_OR_FRESHNESS" };
  if (
    TENANT_EVENTS.has(envelope.eventType) &&
    (!sender.tenantScoped || !UUID.test(String(envelope.tenantId ?? "")))
  )
    return { valid: false, status: "HOLD_TENANT_SCOPE_REQUIRED" };
  if (
    !TENANT_EVENTS.has(envelope.eventType) &&
    envelope.tenantId !== null
  )
    return { valid: false, status: "HOLD_UNEXPECTED_TENANT_SCOPE" };
  if (
    sender.tenantScoped &&
    recipient.model === "DIRECT_MASTER_APPLICATION"
  )
    return { valid: false, status: "HOLD_CROSS_BRAND_TENANT_BOUNDARY" };
  return {
    valid: true,
    status: "STRUCTURAL_CONTRACT_MATCH_UNAUTHENTICATED",
    sourceOnly: true,
    cryptographicallyAuthenticated: false,
    receiverConnected: false,
    ownerAcceptance: "HOLD",
  };
}

/** A policy match does not grant runtime privileges or substitute for auth. */
export function evaluateRoleScope({ principal, request }) {
  const app = appById(principal?.appId);
  const roles = app ? ROLE_PERMISSION_MATRIX[app.id] : null;
  if (
    !app ||
    !roles ||
    !UUID.test(String(principal?.principalId ?? "")) ||
    !Object.hasOwn(roles, String(principal?.role ?? "")) ||
    !appById(request?.targetAppId)
  )
    return { allowed: false, status: "HOLD_UNVERIFIED_PRINCIPAL" };
  const permissions = roles[principal.role];
  if (!permissions.includes(request.permission))
    return { allowed: false, status: "HOLD_PERMISSION_DENIED" };
  if (request.targetAppId !== principal.appId)
    return { allowed: false, status: "HOLD_CROSS_APP_GRANT_FORBIDDEN" };
  if (
    app.tenantScoped &&
    (!UUID.test(String(principal.tenantId ?? "")) ||
      request.tenantId !== principal.tenantId)
  )
    return { allowed: false, status: "HOLD_TENANT_SCOPE_MISMATCH" };
  if (!app.tenantScoped && request.tenantId !== null)
    return { allowed: false, status: "HOLD_UNEXPECTED_TENANT_SCOPE" };
  if (
    MFA_ACTIONS.has(request.permission) &&
    principal.mfaAssurance !== "aal2"
  )
    return { allowed: false, status: "HOLD_STEP_UP_MFA_REQUIRED" };
  if (
    !SECURITY_TIERS.includes(request.tier) ||
    request.tier === "T5_LIVE_TRANSPORT"
  )
    return { allowed: false, status: "HOLD_LIVE_AUTHORITY_NOT_GRANTED" };
  return {
    allowed: false,
    status: "SOURCE_ROLE_MATCH_AWAIT_INDEPENDENT_AUTHORIZATION",
    requiresOriginalSourceProof: true,
    requiresIndependentOwnerReview: true,
    receiverConnected: false,
  };
}

/** No key material or pin mutation. Independently attested metadata only. */
export function assessPinLifecycle({ appId, pins, asOf }) {
  const now = Date.parse(asOf);
  if (!appById(appId) || !Array.isArray(pins) || !Number.isFinite(now))
    return { status: "HOLD_PIN_SOURCE_UNAVAILABLE", eligible: false };
  if (pins.length === 0 || pins.length > 2)
    return { status: "HOLD_PIN_COUNT_INVALID", eligible: false };
  if (
    new Set(pins.map((pin) => pin.fingerprintSha256)).size !== pins.length
  )
    return { status: "HOLD_DUPLICATE_PIN", eligible: false };
  for (const pin of pins) {
    if (
      pin.appId !== appId ||
      !SHA64.test(String(pin.fingerprintSha256 ?? "")) ||
      !validTime(pin.notBefore) ||
      !validTime(pin.notAfter) ||
      !SHA40.test(String(pin.sourceRevision ?? "")) ||
      pin.custodianAttested !== true ||
      pin.revoked === true
    )
      return { status: "HOLD_PIN_ATTESTATION_OR_REVOCATION", eligible: false };
    const start = Date.parse(pin.notBefore);
    const end = Date.parse(pin.notAfter);
    if (start > now + 60_000 || end <= now || end <= start)
      return { status: "HOLD_PIN_NOT_CURRENT", eligible: false };
    if (end - start > 90 * 24 * 60 * 60_000)
      return { status: "HOLD_PIN_LIFETIME_TOO_LONG", eligible: false };
  }
  const expiry = Math.min(...pins.map((pin) => Date.parse(pin.notAfter)));
  const due = expiry - now <= 7 * 24 * 60 * 60_000;
  return {
    status: due ? "SOURCE_PIN_RENEWAL_DUE_REVIEW_ONLY" : "SOURCE_PIN_CURRENT_REVIEW_ONLY",
    eligible: false,
    daysUntilEarliestExpiry: Math.max(0, Math.floor((expiry - now) / 86400000)),
    pinCount: pins.length,
    autoRotate: false,
    receiverConnected: false,
    ownerAcceptance: "HOLD",
  };
}

export function getRegistrySummary() {
  return {
    schema: REGISTRY_SCHEMA,
    identityCount: APPLICATIONS.length,
    tierCount: SECURITY_TIERS.length,
    ownerOrder: APPLICATIONS.map((app) => app.id),
    sourceOnly: true,
    externalConnected: false,
    ownerAcceptance: "HOLD",
    rotationAuthority: "INDEPENDENT_CUSTODIAN_REQUIRED",
  };
}
