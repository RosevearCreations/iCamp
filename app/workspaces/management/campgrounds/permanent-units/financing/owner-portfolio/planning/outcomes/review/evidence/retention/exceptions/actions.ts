"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  openOwnerExportException,
  recordOwnerExportExceptionOutcome,
  reviewOwnerExportException,
} from "@/lib/permanent-unit-owner-retention/exceptions-postgres.mjs";

const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function complete(
  source: string,
  target: string,
  kind: "saved" | "error",
  message: string,
): never {
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${kind}=${encodeURIComponent(message.slice(0, 200))}`,
  );
}
export async function openExportExceptionAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved",
    message = "A source-linked owner export exception was opened.";
  try {
    await openOwnerExportException({
      actorUserId: session.user.id,
      id: randomUUID(),
      exportAcceptanceId: field(form, "exportAcceptanceId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      issueKind: field(form, "issueKind"),
      actionDueAt: field(form, "actionDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      issueNote: field(form, "issueNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Exception case rejected.";
  }
  complete(source, target, kind, message);
}
export async function recordExportExceptionOutcomeAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved",
    message = "An immutable owner exception follow-up outcome was recorded.";
  try {
    await recordOwnerExportExceptionOutcome({
      actorUserId: session.user.id,
      id: randomUUID(),
      caseId: field(form, "caseId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      actionKind: field(form, "actionKind"),
      nextDueAt: field(form, "nextDueAt"),
      evidenceReference: field(form, "evidenceReference"),
      actionNote: field(form, "actionNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Follow-up outcome rejected.";
  }
  complete(source, target, kind, message);
}
export async function reviewExportExceptionAction(form: FormData) {
  const session = await requireStaff(path);
  const source = field(form, "sourceCampgroundId"),
    target = field(form, "targetCampgroundId");
  let kind: "saved" | "error" = "saved",
    message =
      "Independent audit closeout review recorded; underlying export evidence remains immutable.";
  try {
    await reviewOwnerExportException({
      actorUserId: session.user.id,
      id: randomUUID(),
      caseId: field(form, "caseId"),
      outcomeId: field(form, "outcomeId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      reviewKind: field(form, "reviewKind"),
      evidenceReference: field(form, "evidenceReference"),
      reviewNote: field(form, "reviewNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error ? error.message : "Independent closeout rejected.";
  }
  complete(source, target, kind, message);
}
