"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  createAmenityHandoff,
  decideAmenityHandoff,
} from "@/lib/amenity-handoffs/postgres.mjs";

const path = "/workspaces/management/campgrounds/amenity-status/handoffs";

function field(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function outcome(campgroundId: string, result: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/management/campgrounds/amenity-status");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

function errorCode(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  if (/changed|refresh|revision/i.test(text)) return "conflict";
  if (/already exists/i.test(text)) return "duplicate";
  if (/migration/i.test(text)) return "migration";
  if (/not authorized|permission|authority/i.test(text)) return "denied";
  if (/invalid|must be|choose|unsupported|unavailable/i.test(text))
    return "invalid";
  return "failed";
}

export async function createAmenityHandoffAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireStaff(path);
  let result = "created";
  try {
    await createAmenityHandoff({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      assetId: field(formData, "assetId"),
      assignedToUserId: field(formData, "assignedToUserId") || null,
      input: {
        kind: field(formData, "kind"),
        priority: field(formData, "priority"),
        summary: field(formData, "summary"),
        nextAction: field(formData, "nextAction"),
      },
    });
  } catch (error) {
    result = errorCode(error);
  }
  outcome(campgroundId, result);
}

export async function decideAmenityHandoffAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireStaff(path);
  let result = "updated";
  try {
    await decideAmenityHandoff({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      handoffId: field(formData, "handoffId"),
      assignedToUserId: field(formData, "assignedToUserId") || null,
      input: {
        action: field(formData, "action"),
        expectedRowVersion: field(formData, "rowVersion"),
        resolutionNote: field(formData, "resolutionNote"),
      },
    });
  } catch (error) {
    result = errorCode(error);
  }
  outcome(campgroundId, result);
}
