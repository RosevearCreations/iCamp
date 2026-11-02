"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerReassessmentOutcome,
  recordIndependentOwnerOutcomeAcceptance,
} from "@/lib/permanent-unit-owner-retention/outcomes-postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes";
const field = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
async function act(form: FormData, accept: boolean) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let key = "saved",
    message = "Append-only owner audit evidence recorded.";
  try {
    const common = {
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
    };
    if (accept)
      await recordIndependentOwnerOutcomeAcceptance({
        ...common,
        outcomeId: field(form, "outcomeId"),
        acceptanceKind: field(form, "acceptanceKind"),
        auditNote: field(form, "auditNote"),
      });
    else
      await recordOwnerReassessmentOutcome({
        ...common,
        reassessmentId: field(form, "reassessmentId"),
        outcomeKind: field(form, "outcomeKind"),
        evidenceReference: field(form, "evidenceReference"),
        outcomeNote: field(form, "outcomeNote"),
      });
  } catch (error) {
    key = "error";
    message =
      error instanceof Error ? error.message : "Owner audit action rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${key}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function recordOutcomeAction(form: FormData) {
  return act(form, false);
}
export async function acceptOutcomeAction(form: FormData) {
  return act(form, true);
}
