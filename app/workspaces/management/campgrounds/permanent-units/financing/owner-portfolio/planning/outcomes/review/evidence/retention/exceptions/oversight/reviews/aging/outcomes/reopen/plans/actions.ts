"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerReopenActionPlan,
  recordIndependentHoldResolution,
} from "@/lib/permanent-unit-owner-retention/plans-postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans";
const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function save(form: FormData, resolution: boolean) {
  const session = await requireStaff(path),
    source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind = "saved",
    message = "Append-only independent owner evidence recorded.";
  try {
    const common = {
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      evidenceReference: field(form, "evidenceReference"),
    };
    if (resolution)
      await recordIndependentHoldResolution({
        ...common,
        actionPlanId: field(form, "actionPlanId"),
        resolutionKind: field(form, "resolutionKind"),
        resolutionNote: field(form, "resolutionNote"),
      });
    else
      await recordOwnerReopenActionPlan({
        ...common,
        exceptionReviewId: field(form, "exceptionReviewId"),
        actionKind: field(form, "actionKind"),
        nextDueAt: field(form, "nextDueAt"),
        actionNote: field(form, "actionNote"),
      });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Owner audit action rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function saveReopenPlanAction(form: FormData) {
  return save(form, false);
}
export async function saveIndependentResolutionAction(form: FormData) {
  return save(form, true);
}
