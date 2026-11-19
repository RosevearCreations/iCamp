"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  submitLocalSupport265,
  transitionLocalSupport265,
} from "@/lib/campground-support265/postgres.mjs";

const path = "/workspaces/management/campgrounds/operations-centre265";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function dest(campgroundId: string, outcome: string) {
  return (
    path + "?campground=" + encodeURIComponent(campgroundId) + "&" + outcome
  );
}
export async function createCampgroundSupport265Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await submitLocalSupport265({
      userId: session.user.id,
      sessionId: session.sessionId,
      campgroundId,
      input: {
        category: field(form, "category"),
        severity: field(form, "severity"),
        title: field(form, "title"),
        description: field(form, "description"),
      },
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(dest(campgroundId, "error=create"));
  }
  redirect(dest(campgroundId, "saved=created"));
}
export async function transitionCampgroundSupport265Action(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await transitionLocalSupport265({
      userId: session.user.id,
      sessionId: session.sessionId,
      campgroundId,
      caseId: field(form, "caseId"),
      version: Number(field(form, "version")),
      status: field(form, "status"),
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(dest(campgroundId, "error=review"));
  }
  redirect(dest(campgroundId, "saved=reviewed"));
}
