const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha40 = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;
const npRef = /^np-[A-Za-z0-9._:-]{5,157}$/;
const exactRepositories = Object.freeze({
  "ai-data-platform": "RosevearCreations/ai-data-platform",
  devilndove: "RosevearCreations/devilndove-site",
  rosiedazzlers: "RosevearCreations/rosiedazzlers",
  yw: "RosevearCreations/yw",
  icamp: "RosevearCreations/iCamp",
  "rosevear-ai-hub": "RosevearCreations/rosevear-ai-hub",
});

export const ql255Stages = Object.freeze({
  six_app_original_proof_disposition: [
    "immutable_original_proof_404_hold",
    "public_json_candidate_untrusted_hold",
    "public_source_origin_exception_hold",
  ],
  private_witness_custody_exception_escalation: [
    "original_witness_missing_hold",
    "witness_receipts_claimed_unverified_hold",
    "signer_witness_pin_discrepancy_hold",
  ],
  reversible_private_relay_test_readiness: [
    "private_relay_not_configured_hold",
    "synthetic_rollback_plan_only_hold",
    "private_owner_review_requested_hold",
  ],
});

function identifier(value, label, required = false) {
  const v = String(value ?? "").trim();
  if ((!v && required) || (v && !uuid.test(v)))
    throw new Error(`${label} requires an original UUID.`);
  return v || null;
}
function hex(value, expression, label) {
  const v = String(value ?? "").trim();
  if (v && !expression.test(v))
    throw new Error(`${label} must be full lowercase hexadecimal.`);
  return v || null;
}
function originalIndex(value, label) {
  const v = String(value ?? "").trim();
  if (v && !npRef.test(v))
    throw new Error(
      `${label} must be a nonsecret np- index, not raw private evidence.`,
    );
  return v || null;
}
function note(value, label, min, max) {
  const v = String(value ?? "").trim();
  if (
    v.length < min ||
    v.length > max ||
    /@|\d{7,}|\b(?:sin|ssn|secret|token|password|private.key|credit.card)\b/i.test(
      v,
    )
  )
    throw new Error(`${label} must be ${min}–${max} nonsecret characters.`);
  return v;
}
function utc(value, label) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime()) || d.toISOString() !== v)
    throw new Error(`${label} must be exact UTC ISO.`);
  return v;
}

export function normalizeQl255HoldReview(raw, now = new Date()) {
  const reviewKind = String(raw.reviewKind ?? "").trim();
  const outcomeKind = String(raw.outcomeKind ?? "").trim();
  if (!ql255Stages[reviewKind]?.includes(outcomeKind))
    throw new Error("Unknown QL-255 HOLD stage/outcome.");
  const sourceSystem = String(raw.sourceSystem ?? "").trim();
  const repository = exactRepositories[sourceSystem];
  if (!repository || (raw.repository && raw.repository !== repository))
    throw new Error("QL-255 exact six-app repository required.");
  const sourceCampgroundId = identifier(
    raw.sourceCampgroundId,
    "source campground",
    true,
  );
  const targetCampgroundId = identifier(
    raw.targetCampgroundId,
    "target campground",
    true,
  );
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Independent source and target campgrounds required.");
  const priorReviewId = identifier(raw.priorReviewId, "prior review");
  const sourceStage = reviewKind === "six_app_original_proof_disposition";
  const witnessStage =
    reviewKind === "private_witness_custody_exception_escalation";
  const relayStage = reviewKind === "reversible_private_relay_test_readiness";
  if (!priorReviewId && !sourceStage)
    throw new Error("QL-255 starts with public six-source proof disposition.");
  const observedMainSha = hex(
    raw.observedMainSha,
    sha40,
    "current immutable main SHA",
  );
  const sourceShaA = hex(raw.sourceShaA, sha40, "source A");
  const sourceCiRunUrl = String(raw.sourceCiRunUrl ?? "").trim() || null;
  const proofCommitShaB = hex(raw.proofCommitShaB, sha40, "proof B");
  const proofSha256 = hex(raw.proofSha256, sha256, "raw proof digest");
  const proofHttpStatus = String(raw.proofHttpStatus ?? "NOT_CHECKED").trim();
  const publicAuditReference = originalIndex(
    raw.publicAuditReference,
    "public source audit",
  );
  if (
    !new Set(["404", "200", "UNAVAILABLE", "NOT_CHECKED"]).has(proofHttpStatus)
  )
    throw new Error("Unknown actual public proof HTTP status.");
  if (
    !!sourceShaA !== !!sourceCiRunUrl ||
    (sourceCiRunUrl &&
      !new RegExp(
        `^https://github\\.com/${repository}/actions/runs/[0-9]{1,20}$`,
      ).test(sourceCiRunUrl))
  )
    throw new Error(
      "Source A must pair with exact-repository original CI URL.",
    );
  if (
    !sourceStage &&
    (observedMainSha ||
      sourceShaA ||
      sourceCiRunUrl ||
      proofCommitShaB ||
      proofSha256 ||
      publicAuditReference ||
      proofHttpStatus !== "NOT_CHECKED")
  )
    throw new Error(
      "Public origin evidence belongs only in first QL-255 stage.",
    );
  if (sourceStage) {
    if (!observedMainSha) throw new Error("Record exact observed main commit.");
    if (
      outcomeKind === "immutable_original_proof_404_hold" &&
      (proofHttpStatus !== "404" ||
        proofCommitShaB ||
        proofSha256 ||
        publicAuditReference)
    )
      throw new Error("404 cannot claim a proof B or raw proof digest.");
    if (
      outcomeKind === "public_json_candidate_untrusted_hold" &&
      (proofHttpStatus !== "200" ||
        !sourceShaA ||
        !proofCommitShaB ||
        !proofSha256 ||
        !publicAuditReference ||
        sourceShaA === proofCommitShaB)
    )
      throw new Error(
        "200 candidate requires genuine distinct A/B, source CI, raw bytes and audit index; remains untrusted.",
      );
    if (
      outcomeKind === "public_source_origin_exception_hold" &&
      !publicAuditReference
    )
      throw new Error("Origin drift needs an original public audit reference.");
  }
  const registrySnapshotSha256 = hex(
    raw.registrySnapshotSha256,
    sha256,
    "private registry public snapshot digest",
  );
  const signerPinSha256 = hex(
    raw.signerPinSha256,
    sha256,
    "signer public SPKI digest",
  );
  const witnessPinSha256 = hex(
    raw.witnessPinSha256,
    sha256,
    "independent witness public SPKI digest",
  );
  const custodianReceiptId = originalIndex(
    raw.custodianReceiptId,
    "custodian receipt",
  );
  const witnessReceiptId = originalIndex(
    raw.witnessReceiptId,
    "witness receipt",
  );
  const registryReceiptId = originalIndex(
    raw.registryReceiptId,
    "registry receipt",
  );
  const nonceChallengeSha256 = hex(
    raw.nonceChallengeSha256,
    sha256,
    "nonce challenge digest",
  );
  const nonceIssuedAt = utc(raw.nonceIssuedAt, "nonce issue");
  const nonceExpiresAt = utc(raw.nonceExpiresAt, "nonce expiry");
  const witnessFields = [
    registrySnapshotSha256,
    signerPinSha256,
    witnessPinSha256,
    custodianReceiptId,
    witnessReceiptId,
    registryReceiptId,
    nonceChallengeSha256,
    nonceIssuedAt,
    nonceExpiresAt,
  ];
  if (!witnessStage && witnessFields.some(Boolean))
    throw new Error("Private witness references belong only in second stage.");
  if (witnessStage) {
    if (
      outcomeKind === "original_witness_missing_hold" &&
      witnessFields.some(Boolean)
    )
      throw new Error(
        "Missing independent witness evidence cannot be fabricated.",
      );
    if (outcomeKind !== "original_witness_missing_hold") {
      if (
        witnessFields.some((x) => !x) ||
        signerPinSha256 === witnessPinSha256 ||
        new Set([registryReceiptId, custodianReceiptId, witnessReceiptId])
          .size !== 3
      )
        throw new Error(
          "Distinct registry/custodian/witness originals and two separate public pins required.",
        );
      const issued = Date.parse(nonceIssuedAt),
        expires = Date.parse(nonceExpiresAt);
      if (
        issued > now.getTime() ||
        expires <= issued ||
        expires - issued > 300000
      )
        throw new Error(
          "Fresh witness challenge may last no more than five minutes.",
        );
    }
  }
  const relayPlanKind = String(raw.relayPlanKind ?? "NOT_CONFIGURED").trim();
  const relayPlanReference = originalIndex(
    raw.relayPlanReference,
    "private relay plan index",
  );
  const healthIntervalSeconds = raw.healthIntervalSeconds
    ? Number(raw.healthIntervalSeconds)
    : null;
  const testTenantId = originalIndex(
    raw.testTenantId,
    "nonproduction tenant index",
  );
  const testWindowStart = utc(raw.testWindowStart, "TEST UTC start");
  const testWindowEnd = utc(raw.testWindowEnd, "TEST UTC end");
  if (
    ![
      "NOT_CONFIGURED",
      "OUTBOUND_PLAN_ONLY",
      "SYNTHETIC_ROLLBACK_REHEARSED",
    ].includes(relayPlanKind)
  )
    throw new Error("A private relay cannot be installed by QL-255.");
  if (
    !relayStage &&
    (relayPlanKind !== "NOT_CONFIGURED" ||
      relayPlanReference ||
      healthIntervalSeconds ||
      testTenantId ||
      testWindowStart ||
      testWindowEnd)
  )
    throw new Error("Relay and TEST-only planning belongs to third stage.");
  if (relayStage) {
    if (
      relayPlanKind === "NOT_CONFIGURED" &&
      (relayPlanReference || healthIntervalSeconds)
    )
      throw new Error("Unconfigured relay cannot have a deployed-health plan.");
    if (
      relayPlanKind !== "NOT_CONFIGURED" &&
      (!relayPlanReference ||
        !Number.isInteger(healthIntervalSeconds) ||
        healthIntervalSeconds < 30 ||
        healthIntervalSeconds > 300)
    )
      throw new Error(
        "Only documented 30–300-second private outbound relay planning permitted.",
      );
    if (outcomeKind === "private_owner_review_requested_hold") {
      const start = Date.parse(testWindowStart ?? ""),
        end = Date.parse(testWindowEnd ?? "");
      if (
        !testTenantId ||
        !testWindowStart ||
        !testWindowEnd ||
        start <= now.getTime() ||
        end <= start ||
        end - start > 1800000
      )
        throw new Error(
          "Requested owner TEST-only scope must be named nonproduction tenant and future ≤30-minute UTC window.",
        );
    } else if (testTenantId || testWindowStart || testWindowEnd)
      throw new Error(
        "No TEST scope without separate private owner review request.",
      );
  }
  const dueDate = String(raw.nextDueAt ?? "").trim();
  const due = new Date(`${dueDate}T23:59:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    !Number.isFinite(due.getTime()) ||
    due.toISOString().slice(0, 10) !== dueDate ||
    due <= now ||
    due.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error("Independent QL-255 follow-up must be due within 90 days.");
  return {
    id: identifier(raw.id, "review ID", true),
    ql254ReviewId: identifier(
      raw.ql254ReviewId,
      "Build 149 QL-254 owner HOLD root",
      true,
    ),
    priorReviewId,
    sourceCampgroundId,
    targetCampgroundId,
    sourceSystem,
    repository,
    reviewKind,
    outcomeKind,
    observedMainSha,
    sourceShaA,
    sourceCiRunUrl,
    proofCommitShaB,
    proofSha256,
    proofHttpStatus,
    publicAuditReference,
    registrySnapshotSha256,
    signerPinSha256,
    witnessPinSha256,
    custodianReceiptId,
    witnessReceiptId,
    registryReceiptId,
    nonceChallengeSha256,
    nonceIssuedAt,
    nonceExpiresAt,
    relayPlanKind,
    relayPlanReference,
    healthIntervalSeconds,
    testTenantId,
    testWindowStart,
    testWindowEnd,
    nextDueAt: due.toISOString(),
    evidenceReference: note(
      raw.evidenceReference,
      "original evidence index",
      8,
      400,
    ),
    reviewNote: note(
      raw.reviewNote,
      "independent exception disposition",
      12,
      800,
    ),
  };
}

export function classifyQl255ReviewStatus(record, next, now = new Date()) {
  if (next) return "ql255_independent_next_stage_recorded";
  const due = Date.parse(record.next_due_at ?? "");
  if (!Number.isFinite(due)) return "ql255_due_missing_hold";
  const overdue = now.getTime() - due;
  if (overdue >= 30 * 86400000) return "ql255_overdue_30_plus_hold";
  if (overdue >= 0) return "ql255_overdue_hold";
  if (record.review_kind === "six_app_original_proof_disposition")
    return "ql255_private_witness_escalation_pending";
  if (record.review_kind === "private_witness_custody_exception_escalation")
    return "ql255_private_relay_owner_test_plan_pending";
  return "ql255_six_app_public_refresh_pending_hold";
}

// Pure simulation only: models a reversible state machine. It never executes
// a process, contacts a gateway or manipulates Windows/Tailscale/firewalls.
export function simulateQl255RelayRollback(events = []) {
  const allowed = ["PLAN", "SIMULATE_START", "KILL_SWITCH", "ROLLBACK"];
  let phase = "NOT_CONFIGURED";
  for (const event of events) {
    if (!allowed.includes(event))
      throw new Error("Unknown synthetic relay event.");
    if (event === "PLAN" && phase === "NOT_CONFIGURED") phase = "PLAN_ONLY";
    else if (event === "SIMULATE_START" && phase === "PLAN_ONLY")
      phase = "SIMULATED_ACTIVE";
    else if (event === "KILL_SWITCH" && phase === "SIMULATED_ACTIVE")
      phase = "SIMULATED_STOPPED";
    else if (event === "ROLLBACK" && phase === "SIMULATED_STOPPED")
      phase = "NOT_CONFIGURED";
    else throw new Error("Unsafe or out-of-order synthetic relay transition.");
  }
  return {
    simulation_phase: phase,
    real_relay_running: false,
    home_endpoint_exposed: false,
    owner_test_authorized: false,
    actual_gateway_gets: "NOT_RUN",
    connection_state: "DISCONNECTED",
    gate_state: "HOLD",
  };
}
