"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createCampgroundRuleSet,
  publishCampgroundRuleVersion,
} from "@/lib/campground-rules/postgres.mjs";

const path = "/workspaces/management/campgrounds/rules";
const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();
function complete(campgroundId: string, message: string) {
  revalidatePath(path);
  revalidatePath("/guest/stay");
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function createCampgroundRuleSetAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.rules.publish",
    path,
  );
  await createCampgroundRuleSet({
    actorUserId: session.user.id,
    campgroundId,
    code: text(formData, "code"),
    title: text(formData, "title"),
    category: text(formData, "category"),
    facilityId: text(formData, "facilityId"),
  });
  complete(campgroundId, "Rule set created. Publish its first version below.");
}

export async function publishCampgroundRuleVersionAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.rules.publish",
    path,
  );
  await publishCampgroundRuleVersion({
    actorUserId: session.user.id,
    campgroundId,
    ruleSetId: text(formData, "ruleSetId"),
    clientPublicationId: text(formData, "clientPublicationId"),
    expectedVersion: Number(text(formData, "expectedVersion")),
    content: text(formData, "content"),
    acknowledgementRequired: formData.get("acknowledgementRequired") === "on",
  });
  complete(campgroundId, "Immutable rule version published.");
}
