"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth/current-session";
import { submitGuestPrivacyRequest } from "@/lib/guest-privacy/postgres.mjs";

export async function submitPrivacyRequestAction(form: FormData) {
  const campgroundId = String(form.get("campgroundId") ?? "").trim();
  const path = "/guest/privacy?campground=" + encodeURIComponent(campgroundId);
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    await submitGuestPrivacyRequest({
      userId: session.user.id,
      campgroundId,
      input: {
        requestKind: String(form.get("requestKind") ?? ""),
        subjectArea: String(form.get("subjectArea") ?? ""),
      },
    });
  } catch {
    redirect(path + "&error=1");
  }
  redirect(path + "&saved=1");
}
