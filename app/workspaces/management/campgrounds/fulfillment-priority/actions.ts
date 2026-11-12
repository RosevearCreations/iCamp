"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { getCampgroundAuthorization } from "@/lib/authz/postgres.mjs";
import {
  listCampgroundDispatchEvidence,
  listCampgroundSlaFollowups,
} from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";
import { classifyFulfillmentPriority } from "@/lib/booking-charges/fulfillment-priority-core.mjs";
import { buildRecoveryTrendAnalytics } from "@/lib/booking-charges/fulfillment-shift-core.mjs";
import { listShiftRecoveryEvidence } from "@/lib/booking-charges/fulfillment-shift-postgres.mjs";
import { buildSupervisorWorkloadForecast } from "@/lib/booking-charges/fulfillment-performance-core.mjs";
import {
  recordIndependentFieldWitness,
  recordForecastCheckpoint,
  recordOwnerShiftAudit,
} from "@/lib/booking-charges/fulfillment-witness-postgres.mjs";
import {
  recordOriginalDeviceReview,
  recordCalibrationFollowup,
  listAttestationCalibrationEvidence,
} from "@/lib/booking-charges/fulfillment-attestation-postgres.mjs";
import { listWitnessAuditEvidence } from "@/lib/booking-charges/fulfillment-witness-postgres.mjs";
import { recordSupervisorContinuityReview } from "@/lib/booking-charges/fulfillment-continuity-postgres.mjs";
import { recordFieldClosureEvidence } from "@/lib/booking-charges/fulfillment-performance-postgres.mjs";
import {
  requestShiftHandoff,
  decideShiftHandoff,
} from "@/lib/booking-charges/fulfillment-shift-postgres.mjs";
import {
  removeSupervisorPriorityView,
  recordSupervisorCaseOwnership,
  saveSupervisorPriorityView,
} from "@/lib/booking-charges/fulfillment-supervisor-postgres.mjs";

const path = "/workspaces/management/campgrounds/fulfillment-priority";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

async function supervisor(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    path,
  );
  await requireCampgroundPermission(campgroundId, "reservation.modify", path);
  return { campgroundId, session };
}

function finish(campgroundId: string, result: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

export async function savePriorityViewAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "view-error";
  try {
    await saveSupervisorPriorityView({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      label: field(form, "viewLabel"),
      filter: field(form, "viewFilter"),
    });
    result = "view-saved";
  } catch {
    // Keep private view/permission details outside URLs.
  }
  finish(campgroundId, result);
}

export async function removePriorityViewAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "view-error";
  try {
    await removeSupervisorPriorityView({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      viewId: field(form, "viewId"),
    });
    result = "view-removed";
  } catch {
    // A stale view must be refreshed before retry.
  }
  finish(campgroundId, result);
}

export async function recordCaseOwnershipAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "owner-error";
  try {
    await recordSupervisorCaseOwnership({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      previousEventId: field(form, "previousEventId"),
      intent: field(form, "ownerIntent"),
      note: field(form, "ownerNote"),
    });
    result = "owner-recorded";
  } catch {
    // A conflicting claim never becomes an implicit reassignment.
  }
  finish(campgroundId, result);
}

export async function recordSupervisorContinuityAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "continuity-error";
  try {
    await recordSupervisorContinuityReview({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      subjectId: field(form, "subjectId"),
      previousReviewId: field(form, "previousReviewId"),
      reviewKind: field(form, "reviewKind"),
      decision: field(form, "reviewDecision"),
      note: field(form, "reviewNote"),
    });
    result = "continuity-recorded";
  } catch {
    // A stale source subject or unowned case cannot silently pass review.
  }
  finish(campgroundId, result);
}

export async function requestShiftHandoffAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "handoff-error";
  try {
    await requestShiftHandoff({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      ownerEventId: field(form, "ownerEventId"),
      targetUserId: field(form, "targetUserId"),
      note: field(form, "handoffNote"),
    });
    result = "handoff-requested";
  } catch {
    // Fail closed when the source owner or recipient permission changed.
  }
  finish(campgroundId, result);
}

export async function decideShiftHandoffAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "handoff-error";
  try {
    const outcome = field(form, "handoffDecision");
    await decideShiftHandoff({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      requestId: field(form, "requestId"),
      decision: outcome,
      note: field(form, "handoffNote"),
    });
    result = outcome === "accept" ? "handoff-accepted" : "handoff-declined";
  } catch {
    // The receiving supervisor must refresh before acting on stale handoffs.
  }
  finish(campgroundId, result);
}

export async function recordFieldClosureAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "field-closure-error";
  try {
    await recordFieldClosureEvidence({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      fieldReportId: field(form, "fieldReportId"),
      reviewId: field(form, "reviewId"),
      previousEventId: field(form, "previousClosureId"),
      decision: field(form, "closureDecision"),
      evidenceReference: field(form, "closureEvidenceReference"),
      note: field(form, "closureNote"),
    });
    result = "field-closure-recorded";
  } catch {
    // The row-level source guard rejects stale or cross-campground evidence.
  }
  finish(campgroundId, result);
}

export async function recordFieldWitnessAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "witness-error";
  try {
    await recordIndependentFieldWitness({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      closureId: field(form, "closureId"),
      previousWitnessId: field(form, "previousWitnessId"),
      decision: field(form, "witnessDecision"),
      evidenceReference: field(form, "witnessEvidenceReference"),
      explanation: field(form, "witnessExplanation"),
    });
    result = "witness-recorded";
  } catch {
    // Source history, actor diversity and RLS guards are authoritative.
  }
  finish(campgroundId, result);
}

export async function saveForecastCheckpointAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "forecast-error";
  try {
    const [dispatch, followup, shift] = await Promise.all([
      listCampgroundDispatchEvidence({ userId: session.user.id, campgroundId }),
      listCampgroundSlaFollowups({ userId: session.user.id, campgroundId }),
      listShiftRecoveryEvidence({ userId: session.user.id, campgroundId }),
    ]);
    const asOf = new Date().toISOString();
    const latest = new Map<string, (typeof followup.followups)[number]>();
    for (const item of followup.followups)
      if (!latest.has(item.dispatchId)) latest.set(item.dispatchId, item);
    const openCases = dispatch.entries.filter(
      (entry) =>
        classifyFulfillmentPriority({
          dispatch: entry.dispatch,
          classification: entry.classification,
          followup: latest.get(entry.dispatch.id) ?? null,
          now: asOf,
        }).isOpen,
    ).length;
    const decisions = new Set(
      shift.handoffs
        .filter((item) => item.eventKind !== "request")
        .map((item) => item.requestId),
    );
    const pendingHandoffs = shift.handoffs.filter(
      (item) => item.eventKind === "request" && !decisions.has(item.id),
    ).length;
    const trend = buildRecoveryTrendAnalytics({
      reviews: shift.reviews,
      handoffs: shift.handoffs,
      asOf,
      days: 7,
      truncated: shift.truncated,
    });
    const forecast = buildSupervisorWorkloadForecast({
      trend,
      openCases,
      pendingHandoffs,
      asOf,
      truncated: dispatch.truncated || followup.truncated || shift.truncated,
    });
    await recordForecastCheckpoint({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      forecast,
    });
    result = "forecast-recorded";
  } catch {
    // Never store client-supplied workload numbers as verified evidence.
  }
  finish(campgroundId, result);
}

export async function recordOwnerShiftAuditAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "shift-audit-error";
  try {
    const grant = await getCampgroundAuthorization(
      session.user.id,
      campgroundId,
    );
    if (!grant?.roleCodes.includes("owner_admin"))
      throw new Error("Owner approval required.");
    await recordOwnerShiftAudit({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      subjectKind: field(form, "subjectKind"),
      subjectId: field(form, "subjectId"),
      decision: field(form, "auditDecision"),
      explanation: field(form, "auditExplanation"),
    });
    result = "shift-audit-recorded";
  } catch {
    // Active owner role, latest source and completed horizon are mandatory.
  }
  finish(campgroundId, result);
}

export async function recordOriginalDeviceReviewAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "device-attestation-error";
  try {
    await recordOriginalDeviceReview({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      fieldReportId: field(form, "fieldReportId"),
      witnessId: field(form, "witnessId"),
      previousReviewId: field(form, "previousDeviceReviewId"),
      evidenceReference: field(form, "deviceEvidenceReference"),
      digestSha256: field(form, "deviceEvidenceSha256"),
      decision: field(form, "deviceAttestationDecision"),
      explanation: field(form, "deviceAttestationExplanation"),
    });
    result = "device-attestation-recorded";
  } catch {
    // No device attestation can be claimed without independent original proof.
  }
  finish(campgroundId, result);
}

export async function recordCalibrationFollowupAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "calibration-error";
  try {
    const [source, witness, shift] = await Promise.all([
      listAttestationCalibrationEvidence({
        userId: session.user.id,
        campgroundId,
      }),
      listWitnessAuditEvidence({ userId: session.user.id, campgroundId }),
      listShiftRecoveryEvidence({ userId: session.user.id, campgroundId }),
    ]);
    await recordCalibrationFollowup({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      checkpointId: field(form, "checkpointId"),
      previousEventId: field(form, "previousCalibrationId"),
      decision: field(form, "calibrationDecision"),
      explanation: field(form, "calibrationExplanation"),
      checkpoints: witness.checkpoints,
      reviews: shift.reviews,
      handoffs: shift.handoffs,
      truncated: source.truncated || witness.truncated || shift.truncated,
      asOf: new Date().toISOString(),
    });
    result = "calibration-recorded";
  } catch {
    // Fail closed on incomplete source history, stale sequence or partial replay.
  }
  finish(campgroundId, result);
}
