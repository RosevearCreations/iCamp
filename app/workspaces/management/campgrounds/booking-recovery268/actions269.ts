"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { recordBookingWitness269 } from "@/lib/campground-pilot269/postgres.mjs";

const path = "/workspaces/management/campgrounds/booking-recovery268";
export async function recordBookingWitness269Action(form: FormData) {
  const campgroundId = String(form.get("campgroundId") ?? "");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    path,
  );
  try {
    await recordBookingWitness269({
      userId: session.user.id,
      campgroundId,
      recoveryId: String(form.get("recoveryId") ?? ""),
      stage: String(form.get("stage") ?? ""),
      evidenceDigestSha256: String(form.get("evidenceDigestSha256") ?? ""),
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(
      path +
        "?campground=" +
        encodeURIComponent(campgroundId) +
        "&error=pilot269",
    );
  }
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=pilot269",
  );
}
