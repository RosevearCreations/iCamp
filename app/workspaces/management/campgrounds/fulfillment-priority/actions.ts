"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  removeSupervisorPriorityView,
  recordSupervisorCaseOwnership,
  saveSupervisorPriorityView,
} from "@/lib/booking-charges/fulfillment-supervisor-postgres.mjs";

const path = "/workspaces/management/campgrounds/fulfillment-priority";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

async function supervisor(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    path,
  );
  await requireCampgroundPermission(campgroundId, "reservation.modify", path);
  return { campgroundId, session };
}

function finish(campgroundId: string, result: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&result=${result}`,
  );
}

export async function savePriorityViewAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "view-error";
  try {
    await saveSupervisorPriorityView({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      label: field(form, "viewLabel"),
      filter: field(form, "viewFilter"),
    });
    result = "view-saved";
  } catch {
    // Keep private view/permission details outside URLs.
  }
  finish(campgroundId, result);
}

export async function removePriorityViewAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "view-error";
  try {
    await removeSupervisorPriorityView({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      viewId: field(form, "viewId"),
    });
    result = "view-removed";
  } catch {
    // A stale view must be refreshed before retry.
  }
  finish(campgroundId, result);
}

export async function recordCaseOwnershipAction(form: FormData) {
  const { campgroundId, session } = await supervisor(form);
  let result = "owner-error";
  try {
    await recordSupervisorCaseOwnership({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      dispatchId: field(form, "dispatchId"),
      previousEventId: field(form, "previousEventId"),
      intent: field(form, "ownerIntent"),
      note: field(form, "ownerNote"),
    });
    result = "owner-recorded";
  } catch {
    // A conflicting claim never becomes an implicit reassignment.
  }
  finish(campgroundId, result);
}
