"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createSection,
  createSubsection,
  updateCampgroundConfiguration,
  updateSection,
  updateSubsection,
} from "@/lib/campground-structure/postgres.mjs";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string) {
  return Number(field(formData, key));
}

function settingsFrom(formData: FormData) {
  return {
    operatingMode: field(formData, "operatingMode"),
    quietHoursStart: field(formData, "quietHoursStart") || null,
    quietHoursEnd: field(formData, "quietHoursEnd") || null,
    staffNote: field(formData, "staffNote"),
  };
}

function finish(campgroundId: string, message: string) {
  revalidatePath("/workspaces/management/campgrounds");
  redirect(
    `/workspaces/management/campgrounds?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function updateCampgroundAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    "/workspaces/management/campgrounds",
  );

  await updateCampgroundConfiguration({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: numberField(formData, "rowVersion"),
    name: field(formData, "name"),
    timezone: field(formData, "timezone"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Campground settings saved.");
}

export async function createSectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    "/workspaces/management/campgrounds",
  );

  await createSection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    name: field(formData, "name"),
    code: field(formData, "code"),
    sortOrder: numberField(formData, "sortOrder"),
    lifecycleState: field(formData, "lifecycleState"),
    settings: settingsFrom(formData),
  });

  finish(campgroundId, "Section created.");
}

export async function updateSectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    "/workspaces/management/campgrounds",
  );

  await updateSection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    sortOrder: numberField(formData, "sortOrder"),
    lifecycleState: field(formData, "lifecycleState"),
    settings: settingsFrom(formData),
  });

  finish(campgroundId, "Section saved.");
}

export async function createSubsectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    "/workspaces/management/campgrounds",
  );

  await createSubsection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    sectionId: field(formData, "sectionId"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    sortOrder: numberField(formData, "sortOrder"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Subsection created.");
}

export async function updateSubsectionAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    "/workspaces/management/campgrounds",
  );

  await updateSubsection({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    subsectionId: field(formData, "subsectionId"),
    expectedRowVersion: numberField(formData, "rowVersion"),
    name: field(formData, "name"),
    code: field(formData, "code"),
    sortOrder: numberField(formData, "sortOrder"),
    lifecycleState: field(formData, "lifecycleState"),
  });

  finish(campgroundId, "Subsection saved.");
}
