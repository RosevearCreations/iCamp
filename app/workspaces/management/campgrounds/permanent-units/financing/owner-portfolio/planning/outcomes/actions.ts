"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import {
  recordOwnerHandoffOutcome,
  recordOwnerHandoffResolution,
} from "@/lib/permanent-unit-owner-outcomes/postgres.mjs";

const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function respond(camp: string, kind: "saved" | "error", message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${kind}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function ownerHandoffOutcomeAction(data: FormData) {
  const session = await requireStaff(path);
  const sourceCampgroundId = field(data, "sourceCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Owner coordination outcome recorded without altering applicant, finance or delivery state.";
  try {
    await recordOwnerHandoffOutcome({
      actorUserId: session.user.id,
      id: randomUUID(),
      planId: field(data, "planId"),
      sourceCampgroundId,
      targetCampgroundId: field(data, "targetCampgroundId"),
      outcomeKind: field(data, "outcomeKind"),
      nextActionAt: field(data, "nextActionAt"),
      evidenceReference: field(data, "evidenceReference"),
      ownerNote: field(data, "ownerNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted handoff outcome failed.";
  }
  respond(sourceCampgroundId, kind, message);
}
export async function ownerHandoffResolutionAction(data: FormData) {
  const session = await requireStaff(path);
  const sourceCampgroundId = field(data, "sourceCampgroundId");
  let kind: "saved" | "error" = "saved";
  let message =
    "Administrative handoff-plan resolution recorded. Underlying case and hold status remain unchanged.";
  try {
    await recordOwnerHandoffResolution({
      actorUserId: session.user.id,
      id: randomUUID(),
      planId: field(data, "planId"),
      sourceCampgroundId,
      targetCampgroundId: field(data, "targetCampgroundId"),
      latestOutcomeId: field(data, "latestOutcomeId"),
      resolutionKind: field(data, "resolutionKind"),
      evidenceReference: field(data, "evidenceReference"),
      ownerNote: field(data, "ownerNote"),
    });
  } catch (error) {
    kind = "error";
    message =
      error instanceof Error
        ? error.message
        : "Restricted handoff resolution failed.";
  }
  respond(sourceCampgroundId, kind, message);
}
