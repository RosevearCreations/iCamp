"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  archiveBookingCalendarPeriod,
  createBookingCalendarPeriod,
  saveBookingRulePolicy,
} from "@/lib/booking-rules/postgres.mjs";

const path = "/workspaces/management/campgrounds/booking-rules";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string) {
  return Number(field(formData, key));
}

function optionalNumberField(formData: FormData, key: string) {
  const value = field(formData, key);
  return value ? Number(value) : null;
}

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/workspaces/management/campgrounds");
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(message),
  );
}

export async function saveBookingRulePolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await saveBookingRulePolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: numberField(formData, "rowVersion"),
    checkInTime: field(formData, "checkInTime"),
    checkOutTime: field(formData, "checkOutTime"),
    minimumBookingLeadDays: numberField(formData, "minimumBookingLeadDays"),
    maximumBookingLeadDays: numberField(formData, "maximumBookingLeadDays"),
    minimumStayNights: numberField(formData, "minimumStayNights"),
    maximumStayNights: numberField(formData, "maximumStayNights"),
    weekendIsoDays: formData
      .getAll("weekendIsoDays")
      .map((value) => Number(String(value))),
  });

  finish(campgroundId, "Booking date rules saved.");
}

export async function createBookingCalendarPeriodAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await createBookingCalendarPeriod({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    periodKind: field(formData, "periodKind"),
    code: field(formData, "code"),
    displayName: field(formData, "displayName"),
    startsOn: field(formData, "startsOn"),
    endsOn: field(formData, "endsOn"),
    minimumStayNights: optionalNumberField(formData, "minimumStayNights"),
    maximumStayNights: optionalNumberField(formData, "maximumStayNights"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Booking calendar period created.");
}

export async function archiveBookingCalendarPeriodAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await archiveBookingCalendarPeriod({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    periodId: field(formData, "periodId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Booking calendar period archived.");
}
