"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  publishPoolPolicy,
  recordPoolQualification,
  recordPoolEvent,
} from "@/lib/pool-supervision/postgres.mjs";

const path = "/workspaces/management/campgrounds/pool-safety";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function finish(campgroundId: string, notice: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(notice)}`,
  );
}
export async function publishPoolPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "pool.supervision.manage",
    path,
  );
  await publishPoolPolicy({
    actorUserId: session.user.id,
    campgroundId,
    id: field(formData, "id"),
    assetId: field(formData, "assetId"),
    ruleVersionId: field(formData, "ruleVersionId"),
    maximumBathers: field(formData, "maximumBathers"),
    minimumUnaccompaniedAge: field(formData, "minimumUnaccompaniedAge"),
    minimumSupervisorAge: field(formData, "minimumSupervisorAge"),
    maximumChildrenPerSupervisor: field(
      formData,
      "maximumChildrenPerSupervisor",
    ),
    minimumLifeguards: field(formData, "minimumLifeguards"),
    safetyInstructions: field(formData, "safetyInstructions"),
  });
  finish(
    campgroundId,
    "Versioned pool policy published. Staff must independently verify applicable safety requirements.",
  );
}
export async function recordPoolQualificationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "pool.supervision.manage",
    path,
  );
  await recordPoolQualification({
    actorUserId: session.user.id,
    campgroundId,
    id: field(formData, "id"),
    assetId: field(formData, "assetId"),
    staffUserId: field(formData, "staffUserId"),
    decision: field(formData, "decision"),
    credentialReference: field(formData, "credentialReference"),
    expiresAt: field(formData, "expiresAt"),
    decisionNote: field(formData, "decisionNote"),
  });
  finish(campgroundId, "Credential verification or revocation recorded.");
}
export async function recordPoolEventAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const kind = field(formData, "kind");
  const session = await requireCampgroundPermission(
    campgroundId,
    kind === "release" ? "pool.supervision.manage" : "pool.supervision.attest",
    path,
  );
  await recordPoolEvent({
    actorUserId: session.user.id,
    campgroundId,
    id: field(formData, "id"),
    assetId: field(formData, "assetId"),
    policyId: field(formData, "policyId"),
    kind,
    reservationId: field(formData, "reservationId"),
    batherCount: field(formData, "batherCount"),
    underageCount: field(formData, "underageCount"),
    supervisorCount: field(formData, "supervisorCount"),
    lifeguardCount: field(formData, "lifeguardCount"),
    admitted: field(formData, "admitted"),
    supervisionAgesVerified: field(formData, "supervisionAgesVerified"),
    reason: field(formData, "reason"),
  });
  finish(
    campgroundId,
    kind === "hold"
      ? "Supervised swimming hold recorded; follow on-site closure procedures."
      : kind === "release"
        ? "Independent swimming release recorded; check physical facility operations separately."
        : "Supervision observation recorded in immutable history.",
  );
}
