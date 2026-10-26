"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerRecurrenceReview,
  recordIndependentRecurrenceDecision,
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
