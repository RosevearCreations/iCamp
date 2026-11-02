"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerResolutionReview,
  recordOwnerReviewAcceptance,
} from "@/lib/permanent-unit-owner-review/postgres.mjs";

const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function respond(campground: string, kind: "saved" | "error", message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campground)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function independentResolutionReviewAction(data: FormData) {
  const session = await requireStaff(path);
  const sourceCampgroundId = field(data, "sourceCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Independent reassessment recorded. Existing planning, financing and delivery states are unchanged.";
  try {
    await recordOwnerResolutionReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      resolutionId: field(data, "resolutionId"),
      planId: field(data, "planId"),
      sourceCampgroundId,
      targetCampgroundId: field(data, "targetCampgroundId"),
      reviewKind: field(data, "reviewKind"),
      nextReviewAt: field(data, "nextReviewAt"),
      evidenceReference: field(data, "evidenceReference"),
      reviewerNote: field(data, "reviewerNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent review was rejected.";
  }
  respond(sourceCampgroundId, kind, message);
}
export async function ownerResolutionAcceptanceAction(data: FormData) {
  const session = await requireStaff(path);
  const sourceCampgroundId = field(data, "sourceCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Independent review acceptance recorded for internal planning only.";
  try {
    await recordOwnerReviewAcceptance({
      actorUserId: session.user.id,
      id: randomUUID(),
      resolutionId: field(data, "resolutionId"),
      planId: field(data, "planId"),
      sourceCampgroundId,
      targetCampgroundId: field(data, "targetCampgroundId"),
      reassessmentId: field(data, "reassessmentId"),
      evidenceReference: field(data, "evidenceReference"),
      acceptanceNote: field(data, "acceptanceNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Owner review acceptance was rejected.";
  }
  respond(sourceCampgroundId, kind, message);
}
