"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import { recordAccessReconciliationReview } from "@/lib/access-reconciliation/postgres.mjs";

const PATH = "/workspaces/security/credentials";

export async function reviewCredentialAction(formData: FormData) {
  const campgroundId = String(formData.get("campgroundId") ?? "").trim();
  const credentialId = String(formData.get("credentialId") ?? "").trim();
  const session = await requireCampgroundPermission(
    campgroundId,
    "access.reconciliation.review",
    PATH,
  );
  let outcome = "Review recorded. No physical access instruction was issued.";
  let isError = false;
  try {
    await recordAccessReconciliationReview({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      credentialId,
      input: {
        disposition: String(formData.get("disposition") ?? ""),
        reason: String(formData.get("reason") ?? ""),
        rowVersion: Number(formData.get("rowVersion")),
      },
    });
  } catch (error) {
    isError = true;
    outcome =
      error instanceof Error ? error.message : "Could not record review.";
  }
  revalidatePath(PATH);
  redirect(
    `${PATH}?campground=${encodeURIComponent(campgroundId)}` +
      `&${isError ? "error" : "saved"}=${encodeURIComponent(outcome.slice(0, 200))}`,
  );
}
