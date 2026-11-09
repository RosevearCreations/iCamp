"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  assignCampgroundFulfillment,
  reviewCampgroundFulfillmentException,
  updateCampgroundFulfillment,
} from "@/lib/booking-charges/fulfillment-postgres.mjs";

const path = "/workspaces/management/campgrounds/service-fulfillment";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function updateFulfillmentAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.modify",
    path,
  );
  let state = "update-error";
  try {
    await updateCampgroundFulfillment({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      jobId: field(form, "jobId"),
      expectedRowVersion: Number(field(form, "rowVersion")),
      nextState: field(form, "nextState"),
      serviceDate: field(form, "serviceDate"),
      serviceWindow: field(form, "serviceWindow"),
      staffNote: field(form, "staffNote"),
    });
    state = "updated";
  } catch {
    // Never leak a private reservation, permission or database error into URL.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${state}`,
  );
}

export async function assignFulfillmentAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    path,
  );
  let result = "assignment-error";
  try {
    await assignCampgroundFulfillment({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      jobId: field(form, "jobId"),
      assignedUserId: field(form, "assignedUserId"),
      assignmentNote: field(form, "assignmentNote"),
      expectedAssignmentVersion: Number(field(form, "assignmentVersion")),
      expectedJobVersion: Number(field(form, "rowVersion")),
    });
    result = "assigned";
  } catch {
    // A private staff identity or tenant ID must never be exposed in the URL.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

export async function reviewFulfillmentExceptionAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    path,
  );
  let result = "review-error";
  try {
    await reviewCampgroundFulfillmentException({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      jobId: field(form, "jobId"),
      expectedJobVersion: Number(field(form, "rowVersion")),
      reviewState: field(form, "reviewState"),
      reviewNote: field(form, "reviewNote"),
    });
    result = "reviewed";
  } catch {
    // Do not disclose untrusted work identities, notes, or internal SQL errors.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}
