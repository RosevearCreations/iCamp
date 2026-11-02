"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  createOwnerOversightReview,
  appendOwnerOversightDecision,
} from "@/lib/permanent-unit-owner-retention/decisions-postgres.mjs";

const pagePath =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function done(
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
export async function createOwnerOversightReviewAction(form: FormData) {
  const session = await requireStaff(pagePath);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Immutable owner interpretation recorded with database-observed counts.";
  try {
    await createOwnerOversightReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      windowDays: field(form, "windowDays"),
      issueKind: field(form, "issueKind"),
      reviewKind: field(form, "reviewKind"),
      nextReviewAt: field(form, "nextReviewAt"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner oversight review rejected.";
  }
  done(source, target, kind, message);
}
export async function appendOwnerOversightDecisionAction(form: FormData) {
  const session = await requireStaff(pagePath);
  const source = field(form, "sourceCampgroundId");
  const target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message = "An immutable owner follow-up decision was appended.";
  try {
    await appendOwnerOversightDecision({
      actorUserId: session.user.id,
      id: randomUUID(),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      reviewId: field(form, "reviewId"),
      decisionKind: field(form, "decisionKind"),
      basisCaseId: field(form, "basisCaseId"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      decisionNote: field(form, "decisionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner follow-up decision rejected.";
  }
  done(source, target, kind, message);
}
