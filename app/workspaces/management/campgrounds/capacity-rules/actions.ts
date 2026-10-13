"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  archiveCapacityLimitRule,
  createCapacityLimitRule,
} from "@/lib/capacity-rules/postgres.mjs";

const path = "/workspaces/management/campgrounds/capacity-rules";

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

export async function createCapacityLimitRuleAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );
  const scopeKind = field(formData, "scopeKind");

  await createCapacityLimitRule({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    scopeKind,
    sectionId: scopeKind === "section" ? field(formData, "sectionId") : null,
    accommodationKind:
      scopeKind === "accommodation_type"
        ? field(formData, "accommodationKind")
        : null,
    accommodationId:
      scopeKind === "accommodation"
        ? field(formData, "accommodationId")
        : null,
    minimumSiteAreaSquareMeters: optionalNumberField(
      formData,
      "minimumSiteAreaSquareMeters",
    ),
    maximumSiteAreaSquareMeters: optionalNumberField(
      formData,
      "maximumSiteAreaSquareMeters",
    ),
    maxOccupants: optionalNumberField(formData, "maxOccupants"),
    maxVisitors: optionalNumberField(formData, "maxVisitors"),
    maxVehicles: optionalNumberField(formData, "maxVehicles"),
    notes: field(formData, "notes"),
  });

  finish(campgroundId, "Capacity limit rule created.");
}

export async function archiveCapacityLimitRuleAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );

  await archiveCapacityLimitRule({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    ruleId: field(formData, "ruleId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
  });

  finish(campgroundId, "Capacity limit rule archived.");
}
