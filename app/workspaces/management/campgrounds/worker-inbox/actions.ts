"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { acknowledgeCampgroundDispatch } from "@/lib/booking-charges/fulfillment-dispatch-postgres.mjs";

const path = "/workspaces/management/campgrounds/worker-inbox";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function acknowledgeWorkerInboxDispatchAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "reservation.modify",
    path,
  );
  let result = "ack-error";
  try {
    await acknowledgeCampgroundDispatch({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      response: field(form, "response"),
      note: field(form, "ackNote"),
    });
    result = "acknowledged";
  } catch {
    // Do not expose private staff identity or dispatch metadata in the URL.
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}
