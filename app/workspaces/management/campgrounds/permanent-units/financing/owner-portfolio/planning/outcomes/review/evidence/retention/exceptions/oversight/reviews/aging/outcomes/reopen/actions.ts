"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/current-session";
import { recordAcceptanceExceptionReview } from "@/lib/permanent-unit-owner-retention/reopen-postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen";
const value = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export async function recordAcceptanceExceptionReviewAction(form: FormData) {
  const session = await requireStaff(path),
    source = value(form, "sourceCampgroundId"),
    target = value(form, "targetCampgroundId");
  let key = "saved",
    message =
      "Independent post-acceptance review recorded; source evidence remains unchanged.";
  try {
    await recordAcceptanceExceptionReview({
      actorUserId: session.user.id,
      id: randomUUID(),
      acceptanceId: value(form, "acceptanceId"),
      sourceCampgroundId: source,
      targetCampgroundId: target,
      reviewKind: value(form, "reviewKind"),
      evidenceReference: value(form, "evidenceReference"),
      reviewNote: value(form, "reviewNote"),
    });
  } catch (error) {
    key = "error";
    message =
      error instanceof Error
        ? error.message
        : "Independent exception review rejected.";
  }
  revalidatePath(path);
  redirect(
    `${path}?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&${key}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
