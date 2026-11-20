"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  openBookingRecovery268,
  recordBookingRecovery268,
} from "@/lib/campground-support268/postgres.mjs";

const path = "/workspaces/management/campgrounds/booking-recovery268";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function dest(campgroundId: string, code: string) {
  return path + "?campground=" + encodeURIComponent(campgroundId) + "&" + code;
}
export async function openBookingRecovery268Action(form: FormData) {
  const campgroundId = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await openBookingRecovery268({
      userId: session.user.id,
      campgroundId,
      reservationId: f(form, "reservationId"),
      supportCaseId: f(form, "caseId"),
      nextUpdateAt: new Date(Date.now() + 3600000).toISOString(),
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(dest(campgroundId, "error=case"));
  }
  redirect(dest(campgroundId, "saved=case"));
}
export async function recordBookingRecovery268Action(form: FormData) {
  const campgroundId = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await recordBookingRecovery268({
      userId: session.user.id,
      campgroundId,
      recoveryId: f(form, "recoveryId"),
      version: Number(f(form, "version")),
      eventKind: f(form, "eventKind"),
      evidenceReference: f(form, "evidenceReference"),
      outcome: f(form, "outcome"),
      nextUpdateAt: new Date(Date.now() + 3600000).toISOString(),
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(dest(campgroundId, "error=update"));
  }
  redirect(dest(campgroundId, "saved=update"));
}
