"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import { ql247DenialKinds } from "@/lib/permanent-unit-owner-retention/recurrence-core.mjs";
import {
  recordOwnerRecurrenceReview,
  recordIndependentRecurrenceDecision,
  recordIndependentRecurrenceReassessment,
  recordOwnerEvidenceGapAction,
  recordReconciliationExceptionReview,
  recordIndependentClosureRecheck,
  recordClosureOwnerDecision,
  recordIndependentClosureFollowupReview,
  recordOwnerIndependentHandoffDecision,
  recordHandoffIndependentClosureAudit,
  recordClosureAuditOwnerSignoff,
  recordOwnerSignoffIndependentCloseout,
  recordIndependentCloseoutOwnerOutcome,
  recordOwnerEvidenceIndependentDisposition,
  recordIndependentDispositionRecheck,
  recordIndependentRecheckOwnerDecision,
  recordIndependentProofContinuityReview,
  recordClosureRecurrenceEvent,
  recordReopenedExceptionAgingReview,
  recordContinuityResolutionFollowup,
  recordVerifiedClosureMonitor,
  recordReopeningFollowupOversight,
  recordEscalationResolutionRenewal,
  recordRenewalFreshnessDecision,
  recordContinuityRecurrenceRecheck,
  recordOwnerRecheckRenewalWatch,
  recordContinuityEvidenceReconciliation,
  recordOwnerProofGatewayReview,
  recordGatewayHoldReceiptReview,
  recordQl245SourcePinHoldReview,
  recordQl246ExceptionPinHoldDecision,
  recordQl247TestReceiptHoldWatch,
  recordQl248ProvenanceGapHoldRenewal,
  recordQl248SourceReceiptExceptionReassessment,
  recordQl252SourceAuditHoldReview,
  recordQl253ProofCustodyOwnerHoldReview,
  recordQl254OriginalProofRegistryOwnerHoldReview,
  recordQl255SixAppProofWitnessRelayHoldReview,
} from "@/lib/permanent-unit-owner-retention/recurrence-postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
async function save(form: FormData, decision: boolean) {
  const session = await requireStaff(path),
    source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Immutable owner recurrence evidence recorded.";
  try {
    const common = {
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      evidenceReference: field(form, "evidenceReference"),
    };
    if (decision)
      await recordIndependentRecurrenceDecision({
        ...common,
        recurrenceReviewId: field(form, "recurrenceReviewId"),
        decisionKind: field(form, "decisionKind"),
        nextDueAt: field(form, "nextDueAt"),
        decisionNote: field(form, "decisionNote"),
      });
    else
      await recordOwnerRecurrenceReview({
        ...common,
        acceptanceId: field(form, "acceptanceId"),
        reviewNote: field(form, "reviewNote"),
      });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Recurrence audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordRecurrenceReviewAction(form: FormData) {
  return save(form, false);
}
export async function recordRecurrenceDecisionAction(form: FormData) {
  return save(form, true);
}
export async function recordRecurrenceReassessmentAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Independent exception reassessment recorded.";
  try {
    await recordIndependentRecurrenceReassessment({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      recurrenceDecisionId: field(form, "recurrenceDecisionId"),
      assessmentKind: field(form, "assessmentKind"),
      evidenceReference: field(form, "evidenceReference"),
      assessmentNote: field(form, "assessmentNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent reassessment rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordEvidenceGapAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Owner evidence action recorded.";
  try {
    await recordOwnerEvidenceGapAction({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      reassessmentId: field(form, "reassessmentId"),
      actionKind: field(form, "actionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      actionNote: field(form, "actionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner evidence action rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
async function saveClosureAudit(form: FormData, independent: boolean) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Immutable owner exception audit recorded.";
  try {
    const common = {
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      evidenceReference: field(form, "evidenceReference"),
    };
    if (independent)
      await recordIndependentClosureRecheck({
        ...common,
        exceptionReviewId: field(form, "exceptionReviewId"),
        recheckKind: field(form, "recheckKind"),
        recheckNote: field(form, "recheckNote"),
      });
    else
      await recordReconciliationExceptionReview({
        ...common,
        ownerActionId: field(form, "ownerActionId"),
        reviewNote: field(form, "reviewNote"),
      });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Exception closure audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordExceptionRecurrenceAction(form: FormData) {
  return saveClosureAudit(form, false);
}
export async function recordIndependentClosureAction(form: FormData) {
  return saveClosureAudit(form, true);
}
export async function recordClosureOwnerDecisionAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Owner closure follow-up decision recorded.";
  try {
    await recordClosureOwnerDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      closureRecheckId: field(form, "closureRecheckId"),
      decisionKind: field(form, "decisionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      decisionNote: field(form, "decisionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Owner decision rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordIndependentClosureFollowupAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Independent closure follow-up and recurrence snapshot recorded.";
  try {
    await recordIndependentClosureFollowupReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerDecisionId: field(form, "ownerDecisionId"),
      reviewKind: field(form, "reviewKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Independent review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOwnerIndependentHandoffAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Immutable owner escalation handoff and evidence decision recorded.";
  try {
    await recordOwnerIndependentHandoffDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      independentReviewId: field(form, "independentReviewId"),
      actionKind: field(form, "actionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      actionNote: field(form, "actionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Owner handoff rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordHandoffIndependentClosureAuditAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Independent owner handoff evidence reassessment recorded.";
  try {
    await recordHandoffIndependentClosureAudit({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      handoffDecisionId: field(form, "handoffDecisionId"),
      auditKind: field(form, "auditKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      auditNote: field(form, "auditNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent closure audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordClosureAuditOwnerSignoffAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Owner exception sign-off and escalation recurrence snapshot recorded.";
  try {
    await recordClosureAuditOwnerSignoff({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      independentAuditId: field(form, "independentAuditId"),
      signoffKind: field(form, "signoffKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      signoffNote: field(form, "signoffNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Owner audit sign-off rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOwnerSignoffIndependentCloseoutAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent owner sign-off follow-up and evidence closeout recorded.";
  try {
    await recordOwnerSignoffIndependentCloseout({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerSignoffId: field(form, "ownerSignoffId"),
      reviewKind: field(form, "reviewKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Independent closeout rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordIndependentCloseoutOwnerOutcomeAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Owner independent-closeout evidence and escalation renewal recorded.";
  try {
    await recordIndependentCloseoutOwnerOutcome({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      closeoutReviewId: field(form, "closeoutReviewId"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      outcomeNote: field(form, "outcomeNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner evidence outcome rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOwnerEvidenceIndependentDispositionAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent evidence renewal and closure-continuity audit recorded.";
  try {
    await recordOwnerEvidenceIndependentDisposition({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerOutcomeId: field(form, "ownerOutcomeId"),
      dispositionKind: field(form, "dispositionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      dispositionNote: field(form, "dispositionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent evidence disposition rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordIndependentDispositionRecheckAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent escalation recheck and owner evidence replay recorded.";
  try {
    await recordIndependentDispositionRecheck({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      independentDispositionId: field(form, "independentDispositionId"),
      replayOwnerOutcomeId: field(form, "replayOwnerOutcomeId"),
      recheckKind: field(form, "recheckKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      recheckNote: field(form, "recheckNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent evidence replay recheck rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordIndependentRecheckOwnerDecisionAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Owner replay-gap outcome and closure proof continuity recorded.";
  try {
    await recordIndependentRecheckOwnerDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      independentRecheckId: field(form, "independentRecheckId"),
      decisionKind: field(form, "decisionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      decisionNote: field(form, "decisionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner replay-gap exception decision rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordIndependentProofContinuityReviewAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent proof continuity and owner disposition replay recorded.";
  try {
    await recordIndependentProofContinuityReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerDecisionId: field(form, "ownerDecisionId"),
      replayOwnerDecisionId: field(form, "replayOwnerDecisionId"),
      reviewKind: field(form, "reviewKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent proof audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordClosureRecurrenceEventAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Immutable closure recurrence and follow-up audit recorded.";
  try {
    await recordClosureRecurrenceEvent({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      proofReviewId: field(form, "proofReviewId"),
      priorEventId: field(form, "priorEventId"),
      eventKind: field(form, "eventKind"),
      outcomeKind: field(form, "outcomeKind"),
      ownerEvidenceDecisionId: field(form, "ownerEvidenceDecisionId"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      eventNote: field(form, "eventNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Recurrence audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordReopenedExceptionAgingReviewAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent reopened-exception aging and continuity review recorded.";
  try {
    await recordReopenedExceptionAgingReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      reopenEventId: field(form, "reopenEventId"),
      priorReviewId: field(form, "priorReviewId"),
      verifiedFollowupEventId: field(form, "verifiedFollowupEventId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent aging review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordContinuityResolutionFollowupAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent continuity, overdue resolution and closure follow-up recorded.";
  try {
    await recordContinuityResolutionFollowup({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      agingReviewId: field(form, "agingReviewId"),
      priorFollowupId: field(form, "priorFollowupId"),
      verifiedFollowupEventId: field(form, "verifiedFollowupEventId"),
      followupKind: field(form, "followupKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      followupNote: field(form, "followupNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent follow-up rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordVerifiedClosureMonitorAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Verified closure recurrence, independent renewal or reopening audit recorded.";
  try {
    await recordVerifiedClosureMonitor({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      closureFollowupId: field(form, "closureFollowupId"),
      priorMonitorId: field(form, "priorMonitorId"),
      linkedReopenEventId: field(form, "linkedReopenEventId"),
      monitorKind: field(form, "monitorKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      monitorNote: field(form, "monitorNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent closure monitoring rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordReopeningFollowupOversightAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent reopening follow-up, decision replay or owner escalation oversight recorded.";
  try {
    await recordReopeningFollowupOversight({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      verifiedMonitorId: field(form, "verifiedMonitorId"),
      priorOversightId: field(form, "priorOversightId"),
      verifiedResolutionEventId: field(form, "verifiedResolutionEventId"),
      oversightKind: field(form, "oversightKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      oversightNote: field(form, "oversightNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent reopening oversight rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordEscalationResolutionRenewalAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent escalation follow-up, recurrence watch or owner renewal recorded.";
  try {
    await recordEscalationResolutionRenewal({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      resolvedOversightId: field(form, "resolvedOversightId"),
      priorRenewalId: field(form, "priorRenewalId"),
      renewalEvidenceEventId: field(form, "renewalEvidenceEventId"),
      renewalKind: field(form, "renewalKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      renewalNote: field(form, "renewalNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent escalation renewal rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordRenewalFreshnessDecisionAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent evidence comparison, reopening recheck or owner continuity decision recorded.";
  try {
    await recordRenewalFreshnessDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerRenewalId: field(form, "ownerRenewalId"),
      priorAuditId: field(form, "priorAuditId"),
      comparisonEvidenceEventId: field(form, "comparisonEvidenceEventId"),
      auditKind: field(form, "auditKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      auditNote: field(form, "auditNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Renewal freshness and owner continuity audit rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordContinuityRecurrenceRecheckAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent continuity watch, renewal aging or verified owner audit recheck recorded.";
  try {
    await recordContinuityRecurrenceRecheck({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerContinuityId: field(form, "ownerContinuityId"),
      priorRecheckId: field(form, "priorRecheckId"),
      verifiedFollowupEventId: field(form, "verifiedFollowupEventId"),
      recheckKind: field(form, "recheckKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      recheckNote: field(form, "recheckNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent continuity owner recheck rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOwnerRecheckRenewalWatchAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent owner recheck renewal, overdue disposition or continuity evidence watch recorded.";
  try {
    await recordOwnerRecheckRenewalWatch({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerRecheckId: field(form, "ownerRecheckId"),
      priorWatchId: field(form, "priorWatchId"),
      verifiedEvidenceEventId: field(form, "verifiedEvidenceEventId"),
      watchKind: field(form, "watchKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      watchNote: field(form, "watchNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent owner audit renewal rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordContinuityEvidenceReconciliationAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent continuity recurrence, aging exception or owner proof reconciliation recorded.";
  try {
    await recordContinuityEvidenceReconciliation({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      continuityWatchId: field(form, "continuityWatchId"),
      priorReconciliationId: field(form, "priorReconciliationId"),
      verifiedSourceEventId: field(form, "verifiedSourceEventId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent owner proof reconciliation rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOwnerProofGatewayReviewAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent owner proof renewal, aged exception or read-only HOLD gate review recorded.";
  try {
    await recordOwnerProofGatewayReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ownerReconciliationId: field(form, "ownerReconciliationId"),
      priorReviewId: field(form, "priorReviewId"),
      verifiedRenewalEventId: field(form, "verifiedRenewalEventId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      gatewayHealthReceiptRef: field(form, "gatewayHealthReceiptRef"),
      gatewayCapabilitiesReceiptRef: field(
        form,
        "gatewayCapabilitiesReceiptRef",
      ),
      gatewayAuditReceiptRef: field(form, "gatewayAuditReceiptRef"),
      independentWitnessAttestationRef: field(
        form,
        "independentWitnessAttestationRef",
      ),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner proof renewal and gateway HOLD review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordGatewayHoldReceiptReviewAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message =
      "Independent Build 141 documentary HOLD receipt follow-up recorded; no connection or pilot authorized.";
  try {
    await recordGatewayHoldReceiptReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      gatewayReviewId: field(form, "gatewayReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      receiptKind: field(form, "receiptKind"),
      receiptReference: field(form, "receiptReference"),
      sourceRevision: field(form, "sourceRevision"),
      ciRunUrl: field(form, "ciRunUrl"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Build 141 documentary review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordQl245SourcePinHoldReviewAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 142 independent documentary source/pin/HOLD review recorded. Gateway remains HOLD / DISCONNECTED.";
  try {
    await recordQl245SourcePinHoldReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      receiptReviewId: field(form, "receiptReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      nextDueAt: field(form, "nextDueAt"),
      comparisonSourceRevision: field(form, "comparisonSourceRevision"),
      comparisonCiRunUrl: field(form, "comparisonCiRunUrl"),
      publicSourcePinSha256: field(form, "publicSourcePinSha256"),
      separatelySourcedPinSha256: field(form, "separatelySourcedPinSha256"),
      pinProvenanceRef: field(form, "pinProvenanceRef"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Build 142 independent follow-up rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordQl246ExceptionPinHoldDecisionAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 143 independent QL-246 exception/pin/hold review recorded. Phase B, pilot and gateway remain NOT AUTHORIZED / HOLD.";
  try {
    await recordQl246ExceptionPinHoldDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      sourcePinReviewId: field(form, "sourcePinReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      sourceProofStatus: field(form, "sourceProofStatus") || "MISSING",
      sourceRevision: field(form, "sourceRevision"),
      ciRunUrl: field(form, "ciRunUrl"),
      proofRawJsonSha256: field(form, "proofRawJsonSha256"),
      publicSignerSpkiSha256: field(form, "publicSignerSpkiSha256"),
      outOfBandSpkiSha256: field(form, "outOfBandSpkiSha256"),
      outOfBandReference: field(form, "outOfBandReference"),
      operatorChallengeId: field(form, "operatorChallengeId"),
      operatorChallengeSha256: field(form, "operatorChallengeSha256"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Build 143 independent review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl247TestReceiptHoldWatchAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 144 documentary test/denial HOLD review recorded; no Phase B, pilot, or dispatch authorization was granted.";
  try {
    await recordQl247TestReceiptHoldWatch({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql246HoldDecisionId: field(form, "ql246HoldDecisionId"),
      priorReviewId: field(form, "priorReviewId"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      authorizationReferenceStatus:
        field(form, "authorizationReferenceStatus") || "NOT_GIVEN",
      testAuthorizationReference: field(form, "testAuthorizationReference"),
      twoShaAgreementStatus:
        field(form, "twoShaAgreementStatus") || "NOT_AGREED",
      twoShaAgreementReference: field(form, "twoShaAgreementReference"),
      sourceRevisionSha: field(form, "sourceRevisionSha"),
      proofCommitSha: field(form, "proofCommitSha"),
      proofSha256: field(form, "proofSha256"),
      ciRunUrl: field(form, "ciRunUrl"),
      denialReceiptIds: [
        "nonce_replay_denied",
        "stale_request_denied",
        "cross_business_denied",
        "cross_tenant_denied",
        "revoked_key_denied",
        "write_denied",
        "dispatch_denied",
      ].map((key) => {
        const receipt = field(form, `denial_${key}`);
        return receipt ? `${key}|${receipt}` : "";
      }),
      denialWitnessReference: field(form, "denialWitnessReference"),
      rollbackReference: field(form, "rollbackReference"),
      revocationReference: field(form, "revocationReference"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Build 144 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl248ProvenanceGapHoldRenewalAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 145 public-proof/denial-gap/HOLD review recorded. Gateway stays DISCONNECTED / HOLD; no owner authorization granted.";
  try {
    await recordQl248ProvenanceGapHoldRenewal({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql247WatchId: field(form, "ql247WatchId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      proofPublicReference: field(form, "proofPublicReference"),
      sourceRevisionSha: field(form, "sourceRevisionSha"),
      proofCommitSha: field(form, "proofCommitSha"),
      proofSha256: field(form, "proofSha256"),
      sourceCiRunUrl: field(form, "sourceCiRunUrl"),
      signerPinSha256: field(form, "signerPinSha256"),
      signerPinReference: field(form, "signerPinReference"),
      consumerAgreementReference: field(form, "consumerAgreementReference"),
      denialReceiptIds: [
        "nonce_replay_denied",
        "stale_request_denied",
        "cross_business_denied",
        "cross_tenant_denied",
        "revoked_key_denied",
        "write_denied",
        "dispatch_denied",
      ].map((key) => {
        const receipt = field(form, `denial_${key}`);
        return receipt ? `${key}|${receipt}` : "";
      }),
      denialWitnessReference: field(form, "denialWitnessReference"),
      ownerTestAuthorizationReference: field(
        form,
        "ownerTestAuthorizationReference",
      ),
      rollbackReference: field(form, "rollbackReference"),
      revocationReference: field(form, "revocationReference"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Build 145 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl248SourceReceiptExceptionReassessmentAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 146 original source receipt/HOLD reassessment recorded. External gateway remains DISCONNECTED / HOLD.";
  try {
    await recordQl248SourceReceiptExceptionReassessment({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql248RenewalId: field(form, "ql248RenewalId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      denialReceiptIds: ql247DenialKinds.map((key) => {
        const receipt = field(form, `denial_${key}`);
        return receipt ? `${key}|${receipt}` : "";
      }),
      sourceAuditReference: field(form, "sourceAuditReference"),
      ownerAuthorizationReference: field(form, "ownerAuthorizationReference"),
      rollbackReference: field(form, "rollbackReference"),
      revocationReference: field(form, "revocationReference"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Build 146 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl252SourceAuditHoldReviewAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "Build 147 QL-252 public-source/denial/owner HOLD follow-up recorded. No gateway test has run; connection stays DISCONNECTED / HOLD.";
  try {
    await recordQl252SourceAuditHoldReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql248SourceReviewId: field(form, "ql248SourceReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      sourceRevisionSha: field(form, "sourceRevisionSha"),
      sourceCiRunUrl: field(form, "sourceCiRunUrl"),
      proofCommitSha: field(form, "proofCommitSha"),
      proofSha256: field(form, "proofSha256"),
      publicSpkiSha256: field(form, "publicSpkiSha256"),
      sourceAuditReference: field(form, "sourceAuditReference"),
      denialReceiptIds: ql247DenialKinds.map((denial) => {
        const index = field(form, `denial_${denial}`);
        return index ? `${denial}|${index}` : "";
      }),
      denialWitnessReference: field(form, "denialWitnessReference"),
      ownerTestReceiptId: field(form, "ownerTestReceiptId"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Build 147 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl253ProofCustodyOwnerHoldReviewAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "QL-253 immutable public proof/custody/owner TEST-only recheck recorded. Gateway remains NOT_RUN / DISCONNECTED / HOLD.";
  try {
    await recordQl253ProofCustodyOwnerHoldReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql252ReviewId: field(form, "ql252ReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      sourceRevisionSha: field(form, "sourceRevisionSha"),
      sourceCiRunUrl: field(form, "sourceCiRunUrl"),
      proofCommitSha: field(form, "proofCommitSha"),
      proofSha256: field(form, "proofSha256"),
      publicSpkiSha256: field(form, "publicSpkiSha256"),
      proofHttpStatus: field(form, "proofHttpStatus") || "NOT_CHECKED",
      sourceAuditReference: field(form, "sourceAuditReference"),
      custodianReceiptId: field(form, "custodianReceiptId"),
      distinctWitnessReceiptId: field(form, "distinctWitnessReceiptId"),
      challengeSha256: field(form, "challengeSha256"),
      custodyPinSha256: field(form, "custodyPinSha256"),
      challengeIssuedAt: field(form, "challengeIssuedAt"),
      challengeExpiresAt: field(form, "challengeExpiresAt"),
      ownerTestReceiptId: field(form, "ownerTestReceiptId"),
      testTenantId: field(form, "testTenantId"),
      testWindowStart: field(form, "testWindowStart"),
      testWindowEnd: field(form, "testWindowEnd"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "QL-253 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl254OriginalProofRegistryOwnerHoldReviewAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "QL-254 original public proof, private registry witness and owner TEST continuity recorded. Integration remains DISCONNECTED / HOLD; no relay or gateway test started.";
  try {
    await recordQl254OriginalProofRegistryOwnerHoldReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql253ReviewId: field(form, "ql253ReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      mainRevisionSha: field(form, "mainRevisionSha"),
      sourceRevisionSha: field(form, "sourceRevisionSha"),
      sourceCiRunUrl: field(form, "sourceCiRunUrl"),
      proofCommitSha: field(form, "proofCommitSha"),
      proofSha256: field(form, "proofSha256"),
      publicSpkiSha256: field(form, "publicSpkiSha256"),
      proofHttpStatus: field(form, "proofHttpStatus") || "NOT_CHECKED",
      sourceAuditReference: field(form, "sourceAuditReference"),
      registrySnapshotSha256: field(form, "registrySnapshotSha256"),
      registryReceiptId: field(form, "registryReceiptId"),
      custodianReceiptId: field(form, "custodianReceiptId"),
      witnessReceiptId: field(form, "witnessReceiptId"),
      registryPinSha256: field(form, "registryPinSha256"),
      nonceChallengeSha256: field(form, "nonceChallengeSha256"),
      nonceIssuedAt: field(form, "nonceIssuedAt"),
      nonceExpiresAt: field(form, "nonceExpiresAt"),
      ownerTestReceiptId: field(form, "ownerTestReceiptId"),
      testTenantId: field(form, "testTenantId"),
      testWindowStart: field(form, "testWindowStart"),
      testWindowEnd: field(form, "testWindowEnd"),
      relayReadiness: field(form, "relayReadiness") || "NOT_CONFIGURED",
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "QL-254 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}

export async function recordQl255SixAppProofWitnessRelayHoldReviewAction(
  form: FormData,
) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind = "saved";
  let message =
    "QL-255 original public proof, independent private witness and synthetic relay readiness recorded. No TEST was authorized and no home server or gateway was contacted.";
  try {
    await recordQl255SixAppProofWitnessRelayHoldReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      ql254ReviewId: field(form, "ql254ReviewId"),
      priorReviewId: field(form, "priorReviewId"),
      sourceSystem: field(form, "sourceSystem"),
      repository: field(form, "repository"),
      reviewKind: field(form, "reviewKind"),
      outcomeKind: field(form, "outcomeKind"),
      observedMainSha: field(form, "observedMainSha"),
      sourceShaA: field(form, "sourceShaA"),
      sourceCiRunUrl: field(form, "sourceCiRunUrl"),
      proofCommitShaB: field(form, "proofCommitShaB"),
      proofSha256: field(form, "proofSha256"),
      proofHttpStatus: field(form, "proofHttpStatus") || "NOT_CHECKED",
      publicAuditReference: field(form, "publicAuditReference"),
      registrySnapshotSha256: field(form, "registrySnapshotSha256"),
      signerPinSha256: field(form, "signerPinSha256"),
      witnessPinSha256: field(form, "witnessPinSha256"),
      custodianReceiptId: field(form, "custodianReceiptId"),
      witnessReceiptId: field(form, "witnessReceiptId"),
      registryReceiptId: field(form, "registryReceiptId"),
      nonceChallengeSha256: field(form, "nonceChallengeSha256"),
      nonceIssuedAt: field(form, "nonceIssuedAt"),
      nonceExpiresAt: field(form, "nonceExpiresAt"),
      relayPlanKind: field(form, "relayPlanKind") || "NOT_CONFIGURED",
      relayPlanReference: field(form, "relayPlanReference"),
      healthIntervalSeconds: field(form, "healthIntervalSeconds"),
      testTenantId: field(form, "testTenantId"),
      testWindowStart: field(form, "testWindowStart"),
      testWindowEnd: field(form, "testWindowEnd"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "QL-255 review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
