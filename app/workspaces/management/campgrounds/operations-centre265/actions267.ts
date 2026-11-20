"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { setTelemetryEnrollment267 } from "@/lib/campground-support267/postgres.mjs";

const path = "/workspaces/management/campgrounds/operations-centre265";
export async function setTelemetryConsent267Action(form: FormData) {
  const campgroundId = String(form.get("campgroundId") ?? "");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await setTelemetryEnrollment267({
      userId: session.user.id,
      campgroundId,
      sourceId: String(form.get("sourceId") ?? ""),
      enabled: form.get("enabled") === "yes",
    });
    revalidatePath(path);
  } catch {
    redirect(path + "?campground=" + encodeURIComponent(campgroundId) + "&error=telemetry");
  }
  redirect(path + "?campground=" + encodeURIComponent(campgroundId) + "&saved=telemetry");
}
