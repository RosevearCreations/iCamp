"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  decideEnforcementCase,
  recordEnforcementCase,
} from "@/lib/safety-enforcement/postgres.mjs";

const path = "/workspaces/management/campgrounds/enforcement";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/guest/stay");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function recordEnforcementAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const kind = field(formData, "kind");
  const session = await requireCampgroundPermission(
    campgroundId,
    kind === "warning" ? "safety.warning.issue" : "safety.suspension.issue",
    path,
  );
  await recordEnforcementCase({
    actorUserId: session.user.id,
    campgroundId,
    caseId: field(formData, "caseId"),
    reservationId: field(formData, "reservationId"),
    ruleVersionId: field(formData, "ruleVersionId"),
    kind,
    scopeType: field(formData, "scopeType"),
    facilityId: field(formData, "facilityId"),
    accessZoneId: field(formData, "accessZoneId"),
    feature: field(formData, "feature"),
    reason: field(formData, "reason"),
  });
  finish(
    campgroundId,
    kind === "warning"
      ? "Warning recorded with immutable evidence."
      : "Suspension request awaiting independent management review.",
  );
}

export async function decideEnforcementAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "safety.suspension.review",
    path,
  );
  const decision = field(formData, "decision");
  await decideEnforcementCase({
    actorUserId: session.user.id,
    campgroundId,
    caseId: field(formData, "caseId"),
    expectedVersion: Number(field(formData, "rowVersion")),
    decision,
    note: field(formData, "note"),
  });
  finish(
    campgroundId,
    decision === "approve"
      ? "Suspension approved and recorded (physical access unchanged)."
      : decision === "deny"
        ? "Suspension request denied and recorded."
        : "Access reinstatement recorded (verify physical controls separately).",
  );
}
