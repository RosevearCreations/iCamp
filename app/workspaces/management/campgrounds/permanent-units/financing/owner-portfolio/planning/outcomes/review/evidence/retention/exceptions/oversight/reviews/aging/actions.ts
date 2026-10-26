"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import { recordIndependentOwnerDecisionReassessment } from "@/lib/permanent-unit-owner-retention/aging-postgres.mjs";

const pagePath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function finish(
  source: string,
  target: string,
  kind: "saved" | "error",
  message: string,
): never {
  revalidatePath(pagePath);
  redirect(
    `${pagePath}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 200))}`,
  );
}
export async function reassessOwnerDecisionAction(form: FormData) {
  const session = await requireStaff(pagePath);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Independent owner decision reassessment recorded; original evidence is unchanged.";
  try {
    await recordIndependentOwnerDecisionReassessment({
      actorUserId: session.user.id,
      id: randomUUID(),
      decisionId: field(form, "decisionId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      assessmentKind: field(form, "assessmentKind"),
      basisCaseId: field(form, "basisCaseId"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      reassessmentNote: field(form, "reassessmentNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent reassessment rejected.";
  }
  finish(source, target, kind, message);
}
