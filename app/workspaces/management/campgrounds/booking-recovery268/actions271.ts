"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { certifyBooking271 } from "@/lib/build271/postgres.mjs";
const route = "/workspaces/management/campgrounds/booking-recovery268";
export async function certifyBooking271Action(form: FormData) {
  const campgroundId = String(form.get("campgroundId") ?? "");
  const { user } = await requireCampgroundPermission(
    campgroundId,
    "campground.operations.manage",
    route,
  );
  try {
    await certifyBooking271({
      reviewerId: user.id,
      campgroundId,
      recoveryId: String(form.get("recoveryId") ?? ""),
      evidenceDigest: String(form.get("evidenceDigest") ?? ""),
    });
    revalidatePath(route);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(
      route +
        "?campground=" +
        encodeURIComponent(campgroundId) +
        "&closure271=hold",
    );
  }
  redirect(
    route +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&closure271=certified",
  );
}
