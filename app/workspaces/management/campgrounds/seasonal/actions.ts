"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  createSeasonalAssignment,
  transitionSeasonalAssignment,
} from "@/lib/seasonal-assignments/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Seasonal assignment action failed.";
  return message.slice(0, 300);
}

function seasonalPath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/seasonal?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function assignmentKind(value: string): "seasonal" | "yearly" {
  if (value === "seasonal" || value === "yearly") return value;
  throw new Error("Assignment kind is invalid.");
}

function transition(value: string): "end" | "cancel" {
  if (value === "end" || value === "cancel") return value;
  throw new Error("Seasonal assignment transition is invalid.");
}

export async function createSeasonalAssignmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = seasonalPath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await createSeasonalAssignment({
      actorUserId: session.user.id,
      campgroundId,
      reason: text(formData, "reason"),
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        assignmentKind: assignmentKind(text(formData, "assignmentKind")),
        startsOn: text(formData, "startsOn"),
        endsOn: text(formData, "endsOn"),
        occupantDisplayName: text(formData, "occupantDisplayName"),
        reference: text(formData, "reference"),
        ratePlanId: text(formData, "ratePlanId"),
        winterizationRequired: formData.get("winterizationRequired") === "on",
      },
    });
    revalidatePath(path);
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        "Assignment created with " +
          result.currencyCode +
          " " +
          (result.amountCents / 100).toFixed(2) +
          " long-term charge.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function transitionSeasonalAssignmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = seasonalPath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const action = transition(text(formData, "action"));
    await transitionSeasonalAssignment({
      actorUserId: session.user.id,
      campgroundId,
      assignmentId: text(formData, "assignmentId"),
      expectedRowVersion: text(formData, "expectedRowVersion"),
      action,
      reason: text(formData, "reason"),
      sourceChannel: "web",
    });
    revalidatePath(path);
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        action === "end" ? "Assignment ended." : "Assignment cancelled.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}
