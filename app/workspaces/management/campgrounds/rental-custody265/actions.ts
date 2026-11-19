"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  recordLocalCustody265,
  recordLocalWitness265,
} from "@/lib/campground-support265/postgres.mjs";

const path = "/workspaces/management/campgrounds/rental-custody265";
const f = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const go = (id: string, status: string) =>
  path + "?campground=" + encodeURIComponent(id) + "&" + status;
export async function recordRentalPickup265Action(form: FormData) {
  const campgroundId = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  try {
    await recordLocalCustody265({
      userId: session.user.id,
      sessionId: session.sessionId,
      campgroundId,
      input: {
        allocationId: f(form, "allocationId"),
        eventKind: f(form, "eventKind"),
        evidenceReference: f(form, "evidenceReference"),
        conditionNote: f(form, "conditionNote"),
      },
    });
    revalidatePath(path);
    revalidatePath("/guest/rentals");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(go(campgroundId, "error=custody"));
  }
  redirect(go(campgroundId, "saved=custody"));
}
export async function recordSupervisedWitness265Action(form: FormData) {
  const campgroundId = f(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "rental.manage",
    path,
  );
  await requireCampgroundPermission(campgroundId, "staff.manage", path);
  try {
    await recordLocalWitness265({
      userId: session.user.id,
      sessionId: session.sessionId,
      campgroundId,
      input: {
        pilotReviewId: f(form, "pilotReviewId"),
        siteReference: f(form, "siteReference"),
        supervisionReference: f(form, "supervisionReference"),
        safetyRestrictions: f(form, "safetyRestrictions"),
      },
    });
    revalidatePath(path);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    redirect(go(campgroundId, "error=witness"));
  }
  redirect(go(campgroundId, "saved=witness"));
}
