import { createHash } from "node:crypto";

import {
  classifyMessagingConsentKeyword,
  evaluateMessagingDispatchPermission,
} from "../consent/core.mjs";

export const CONTACT_SCHEMA = "icamp.contact-handoff.v1";
export const PROTOCOL = Object.freeze({
  major: 1,
  minor: 1,
  compatibleLegacyMinor: 0,
  lockstepReleaseRequired: false,
  unrelatedLocalOperationsContinue: true,
});
export const CHANNELS = Object.freeze([
  "sms",
  "mms",
  "voice",
  "dtmf",
  "speech",
]);
export const CONTACT_KINDS = Object.freeze([
  "general_request",
  "staff_transfer",
  "booking_question",
  "consent_help",
]);
export const TASK_ACTIONS = Object.freeze([
  "acknowledge",
  "escalate",
  "resolve",
]);
const READ_ONLY_CAPABILITIES = Object.freeze({
  "source.health.read": 0,
  "source.capabilities.read": 0,
  "campground.contact.handoff.read": 1,
});
const deny = (reason) => ({
  status: "HOLD",
  reason,
  localOperationsContinue: true,
  peerDeployRequired: false,
  remoteExecutionAuthorized: false,
  receiverConnected: false,
});
const hash = (input) =>
  createHash("sha256").update(input, "utf8").digest("hex");

/** Compatible schema is never a transport grant or an assertion of delivery. */
export function negotiateContactProtocol({
  peer = null,
  capability = "source.health.read",
  peerAvailable = true,
  changeType = "ADDITIVE",
} = {}) {
  if (!Object.hasOwn(READ_ONLY_CAPABILITIES, capability))
    return deny("HOLD_UNKNOWN_CAPABILITY");
  if (changeType !== "ADDITIVE")
    return deny("HOLD_BREAKING_CHANGE_REQUIRES_MAJOR_HANDOFF");
  if (!peerAvailable || peer === null)
    return deny("HOLD_ONLY_DEPENDENT_PEER_FEATURE");
  const version =
    typeof peer === "string"
      ? peer
      : peer?.protocolMajor === 1 && Number.isSafeInteger(peer?.protocolMinor)
        ? "1." + peer.protocolMinor
        : null;
  if (!["1.0", "1.1"].includes(version))
    return deny("HOLD_INCOMPATIBLE_PEER_PROTOCOL");
  if (version === "1.0" && READ_ONLY_CAPABILITIES[capability] > 0)
    return deny("HOLD_V11_CAPABILITY_ON_LEGACY_PEER");
  if (
    typeof peer === "object" &&
    (!Array.isArray(peer.capabilities) ||
      !peer.capabilities.includes(capability))
  )
    return deny("HOLD_UNADVERTISED_PEER_CAPABILITY");
  return {
    status: "CONTRACT_COMPATIBLE_SOURCE_ONLY",
    negotiatedProtocol: version,
    capability,
    peerDeployRequired: false,
    localOperationsContinue: true,
    remoteExecutionAuthorized: false,
    receiverConnected: false,
  };
}

/** This does NOT read or retain raw SMS, DTMF, customer names or phone values. */
export function validateContactIntake({
  channel,
  contactKind,
  purpose = "operational",
  messageText = null,
}) {
  if (
    !CHANNELS.includes(channel) ||
    !CONTACT_KINDS.includes(contactKind) ||
    !["operational", "transactional"].includes(purpose)
  )
    return deny("HOLD_CONTACT_CHANNEL_OR_PURPOSE");
  // STOP/START must be handled by the existing canonical consent processor,
  // not turned into a new contact task and not interpreted as marketing opt-in.
  if (
    typeof messageText === "string" &&
    ["stop", "start"].includes(
      classifyMessagingConsentKeyword(messageText)?.action,
    )
  )
    return deny("HOLD_CANONICAL_SUPPRESSION_KEYWORD");
  if (messageText !== null) return deny("HOLD_RAW_CONTACT_MESSAGE_FORBIDDEN");
  return {
    status: "LOCAL_CONTACT_REVIEW_ONLY",
    valid: true,
    channel,
    contactKind,
    purpose,
    externalMessageSent: false,
  };
}

/** Inbound staff review is permitted even when the contact opted out.
 * Outbound follow-up remains a separate consent-gated operation. */
export function evaluateFollowup({
  channel,
  purpose,
  preferenceState = null,
  consentState = null,
  consentOccurredAt = null,
  providerSuppressed = true,
  now,
} = {}) {
  if (!["sms", "mms"].includes(channel))
    return deny("HOLD_MANUAL_VOICE_OR_IVR_FOLLOWUP");
  if (!["operational", "transactional", "marketing"].includes(purpose))
    return deny("HOLD_INVALID_FOLLOWUP_PURPOSE");
  try {
    const decision = evaluateMessagingDispatchPermission({
      channel,
      purpose,
      preferenceState,
      consentState,
      consentOccurredAt,
      providerSuppressed,
      messageKind: "normal",
      now,
    });
    return decision.allowed
      ? {
          status: "CONSENT_ELIGIBLE_NOT_DISPATCHED",
          providerDispatchAuthorized: false,
          reason: decision.reason,
          receiverConnected: false,
        }
      : deny("HOLD_CONSENT_" + decision.reason.toUpperCase());
  } catch {
    return deny("HOLD_CONSENT_POLICY_UNAVAILABLE");
  }
}

export function authorizeContactAction({ action, permissions, roleCodes }) {
  const set = new Set(Array.isArray(permissions) ? permissions : []);
  const roles = new Set(Array.isArray(roleCodes) ? roleCodes : []);
  if (!TASK_ACTIONS.includes(action))
    return { allowed: false, reason: "HOLD_UNKNOWN_TASK_ACTION" };
  if (!set.has("communications.read"))
    return { allowed: false, reason: "HOLD_INBOX_READ_PERMISSION" };
  if (action !== "acknowledge" && !set.has("communications.manage"))
    return { allowed: false, reason: "HOLD_TASK_MANAGE_PERMISSION" };
  if (
    action === "resolve" &&
    !roles.has("owner_admin") &&
    !set.has("campground.operations.manage")
  )
    return { allowed: false, reason: "HOLD_RESOLUTION_SUPERVISOR_REQUIRED" };
  return { allowed: true, reason: "LOCAL_SCOPE_ONLY" };
}

export function contactEventDigest({
  campgroundId,
  providerKey,
  providerEventId,
} = {}) {
  if (
    !/^[0-9a-f-]{36}$/iu.test(String(campgroundId ?? "")) ||
    !/^[a-z][a-z0-9_-]{1,63}$/u.test(String(providerKey ?? "")) ||
    typeof providerEventId !== "string" ||
    providerEventId.length < 1 ||
    providerEventId.length > 240
  )
    throw new Error("Original scoped provider event identity required.");
  return hash(
    JSON.stringify([
      CONTACT_SCHEMA,
      campgroundId,
      providerKey,
      providerEventId,
    ]),
  );
}

/** Metadata-only review plan. Consent never grants a cross-app capability. */
export function planMasterHandoff({
  peerProtocol = "1.0",
  peerAvailable = false,
  contactKind = "general_request",
} = {}) {
  if (!CONTACT_KINDS.includes(contactKind))
    return deny("HOLD_UNKNOWN_CONTACT_KIND");
  const compatibility = negotiateContactProtocol({
    peer: peerProtocol,
    peerAvailable,
    capability: "campground.contact.handoff.read",
  });
  return {
    schema: CONTACT_SCHEMA,
    status:
      compatibility.status === "CONTRACT_COMPATIBLE_SOURCE_ONLY"
        ? "SOURCE_ONLY_OUTBOUND_HANDOFF_HOLD"
        : compatibility.status,
    reason: compatibility.reason ?? "NO_LIVE_TRANSPORT",
    targets: ["rosevear-comms-hub"],
    containsCustomerPii: false,
    rawSecretSynchronized: false,
    directPeerDatabaseSync: false,
    localOperationsContinue: true,
    remoteExecutionAuthorized: false,
    deliveryAcknowledged: false,
    receiverConnected: false,
  };
}
