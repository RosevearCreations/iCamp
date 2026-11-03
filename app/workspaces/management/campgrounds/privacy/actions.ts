"use server";

import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { reviewGuestPrivacyRequest } from "@/lib/guest-privacy/postgres.mjs";

export async function recordPrivacyReviewAction(form: FormData) {
  const campgroundId = String(form.get("campgroundId") ?? "").trim();
  const path =
    "/workspaces/management/campgrounds/privacy?campground=" +
    encodeURIComponent(campgroundId);
  const session = await requireCampgroundPermission(
    campgroundId,
    "guest.manage",
    path,
  );
  try {
    await reviewGuestPrivacyRequest({
      actorUserId: session.user.id,
      campgroundId,
      requestId: String(form.get("requestId") ?? ""),
      input: {
        eventKind: String(form.get("eventKind") ?? ""),
        sourceReference: String(form.get("sourceReference") ?? ""),
      },
    });
  } catch {
    redirect(path + "&error=1");
  }
  redirect(path + "&saved=1");
}
