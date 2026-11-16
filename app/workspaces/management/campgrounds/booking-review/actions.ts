"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createStaffWaitlistInterest258,
  recordStaffWaitlistReview258,
} from "@/lib/release/build258-booking-postgres.mjs";

const route = "/workspaces/management/campgrounds/booking-review";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

function finish(
  campgroundId: string,
  arrivalDate: string,
  departureDate: string,
  result: string,
): never {
  revalidatePath(route);
  revalidatePath("/workspaces/management/campgrounds/availability");
  redirect(
    route +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&arrivalDate=" +
      encodeURIComponent(arrivalDate) +
      "&departureDate=" +
      encodeURIComponent(departureDate) +
      "&result=" +
      encodeURIComponent(result),
  );
}

async function staffSession(
  form: FormData,
  permission: "reservation.create" | "reservation.modify",
) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    permission,
    route,
  );
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(route));
  return { campgroundId, session };
}

export async function addWaitlistInterest258Action(form: FormData) {
  const { campgroundId, session } = await staffSession(
    form,
    "reservation.create",
  );
  const arrivalDate = field(form, "arrivalDate");
  const departureDate = field(form, "departureDate");
  let result = "HOLD_ORIGINAL_INVENTORY_OR_DB_UNAVAILABLE";
  try {
    const created = await createStaffWaitlistInterest258({
      actorUserId: session.user.id,
      campgroundId,
      accommodationId: field(form, "accommodationId"),
      arrivalDate,
      departureDate,
      requestKey: field(form, "requestKey") || randomUUID(),
    });
    result = created.status;
  } catch {
    // Never claim inventory was held or a guest placed on an active waitlist.
  }
  finish(campgroundId, arrivalDate, departureDate, result);
}

export async function reviewWaitlist258Action(form: FormData) {
  const { campgroundId, session } = await staffSession(
    form,
    "reservation.modify",
  );
  const arrivalDate = field(form, "arrivalDate");
  const departureDate = field(form, "departureDate");
  let result = "HOLD_WAITLIST_REVIEW_UNAVAILABLE";
  try {
    const outcome = await recordStaffWaitlistReview258({
      actorUserId: session.user.id,
      campgroundId,
      waitlistId: field(form, "waitlistId"),
      action: field(form, "action"),
    });
    result = outcome.status;
  } catch {
    // No unverified staff action can change a guest reservation or dispatch.
  }
  finish(campgroundId, arrivalDate, departureDate, result);
}
