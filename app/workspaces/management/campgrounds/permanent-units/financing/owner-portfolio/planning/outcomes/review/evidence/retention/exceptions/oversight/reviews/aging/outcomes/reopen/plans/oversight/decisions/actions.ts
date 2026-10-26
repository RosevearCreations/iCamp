"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
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
