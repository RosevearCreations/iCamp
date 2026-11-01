"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { normalizeStaffArrivalReview } from "@/lib/arrival-planner/core.mjs";
import { saveStaffArrivalReview } from "@/lib/arrival-planner/postgres.mjs";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function reviewArrivalPlanAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const path =
    "/workspaces/management/campgrounds/reservations/arrival-readiness?campground=" +
    encodeURIComponent(campgroundId);
  const session = await requireStaff(path);
  try {
    const input = normalizeStaffArrivalReview({
      outcome: field(form, "outcome"),
      note: field(form, "note"),
    });
    const expectedPlanVersion = Number(field(form, "expectedPlanVersion"));
    const expectedReservationVersion = Number(
      field(form, "expectedReservationVersion"),
    );
    if (
      !Number.isSafeInteger(expectedPlanVersion) ||
      expectedPlanVersion < 1 ||
      !Number.isSafeInteger(expectedReservationVersion) ||
      expectedReservationVersion < 1
    ) {
      throw new Error("Invalid source revision.");
    }
    await saveStaffArrivalReview({
      userId: session.user.id,
      campgroundId,
      reservationId: field(form, "reservationId"),
      expectedPlanVersion,
      expectedReservationVersion,
      input,
    });
    revalidatePath(path);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(path + "&error=1");
  }
  redirect(path + "&reviewed=1");
}
