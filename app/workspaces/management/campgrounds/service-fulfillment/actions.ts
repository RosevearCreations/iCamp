"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  assignCampgroundFulfillment,
  reviewCampgroundFulfillmentException,
  updateCampgroundFulfillment,
} from "@/lib/booking-charges/fulfillment-postgres.mjs";
import { updateCampgroundFulfillmentPlanningSettings } from "@/lib/booking-charges/fulfillment-forecast-postgres.mjs";
import {
  acknowledgeCampgroundDispatch,
  dispatchCampgroundFulfillment,
} from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";

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

export async function updateFulfillmentForecastSettingsAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "schedule.manage",
    path,
  );
  let result = "forecast-error";
  try {
    await updateCampgroundFulfillmentPlanningSettings({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      expectedRowVersion: Number(field(form, "forecastRowVersion")),
      morningStart: field(form, "morningStart"),
      morningEnd: field(form, "morningEnd"),
      afternoonStart: field(form, "afternoonStart"),
      afternoonEnd: field(form, "afternoonEnd"),
      eveningStart: field(form, "eveningStart"),
      eveningEnd: field(form, "eveningEnd"),
      maxUnitsPerStaffWindow: field(form, "maxUnitsPerStaffWindow"),
    });
    result = "forecast-saved";
  } catch {
    // A failed shift authorization or private roster lookup is never echoed.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

export async function dispatchFulfillmentAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    path,
  );
  let result = "dispatch-error";
  try {
    await dispatchCampgroundFulfillment({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      jobId: field(form, "jobId"),
      assignedUserId: field(form, "assignedUserId"),
      expectedJobVersion: Number(field(form, "rowVersion")),
      expectedAssignmentVersion: Number(field(form, "assignmentVersion")),
      acknowledgementMinutes: field(form, "acknowledgementMinutes"),
      completionTargetUtc: field(form, "completionTargetUtc"),
    });
    result = "dispatched";
  } catch {
    // Keep staff identifiers and private deadline validation out of the URL.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

export async function acknowledgeFulfillmentDispatchAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.modify",
    path,
  );
  let result = "ack-error";
  try {
    await acknowledgeCampgroundDispatch({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      response: field(form, "response"),
      note: field(form, "ackNote"),
    });
    result = "acknowledged";
  } catch {
    // No private dispatch or roster details leak through status parameters.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}
