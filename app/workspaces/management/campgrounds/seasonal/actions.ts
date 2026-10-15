"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  createLongTermAssignment,
  transitionLongTermAssignment,
} from "@/lib/long-term-assignment/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Long-term assignment action failed.";
  return message.slice(0, 300);
}

function pathFor(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/seasonal?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function assignmentKind(value: string): "seasonal" | "yearly" {
  if (value === "seasonal" || value === "yearly") return value;
  throw new Error("Assignment kind is invalid.");
}

function eventKind(
  value: string,
): "winter_closed" | "reopened" | "ended" | "cancelled" {
  if (
    value === "winter_closed" ||
    value === "reopened" ||
    value === "ended" ||
    value === "cancelled"
  ) {
    return value;
  }
  throw new Error("Assignment lifecycle event is invalid.");
}

export async function createLongTermAssignmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await createLongTermAssignment({
      actorUserId: session.user.id,
      campgroundId,
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        assignmentKind: assignmentKind(text(formData, "assignmentKind")),
        occupantDisplayName: text(formData, "occupantDisplayName"),
        contactEmail: text(formData, "contactEmail"),
        startsOn: text(formData, "startsOn"),
        endsOn: text(formData, "endsOn"),
        ratePlanId: text(formData, "ratePlanId"),
        chargeDueOn: text(formData, "chargeDueOn"),
        reference: text(formData, "reference"),
        notes: text(formData, "notes"),
        winterizationRequired: formData.get("winterizationRequired") === "on",
      },
    });
    revalidatePath(path);
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        "Long-term assignment created with " +
          result.canonicalCurrencyCode +
          " " +
          (result.canonicalChargeAmountCents / 100).toFixed(2) +
          " canonical package charge.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function transitionLongTermAssignmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = pathFor(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const kind = eventKind(text(formData, "eventKind"));
    await transitionLongTermAssignment({
      actorUserId: session.user.id,
      campgroundId,
      sourceChannel: "web",
      input: {
        assignmentId: text(formData, "assignmentId"),
        eventKind: kind,
        effectiveOn: text(formData, "effectiveOn"),
        note: text(formData, "note"),
        expectedRowVersion: text(formData, "expectedRowVersion"),
      },
    });
    revalidatePath(path);
    destination =
      path +
      "&saved=" +
      encodeURIComponent(
        kind === "winter_closed"
          ? "Assignment marked winter closed."
          : kind === "reopened"
            ? "Assignment reopened."
            : kind === "ended"
              ? "Assignment ended."
              : "Assignment cancelled.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}
