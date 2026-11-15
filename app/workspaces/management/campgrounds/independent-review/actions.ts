"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  admitProtectedSourceReceipt,
  recordIndependentRemediation,
} from "@/lib/release/build254-security-postgres.mjs";

const route = "/workspaces/management/campgrounds/independent-review";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

async function ownerSession(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "staff.manage",
    route,
  );
  await requireCampgroundPermission(campgroundId, "reservation.modify", route);
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(route));
  return { campgroundId, session };
}
function done(campgroundId: string, result: string): never {
  revalidatePath(route);
  redirect(
    route +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&result=" +
      result,
  );
}

export async function claimProtectedReceiptAction(form: FormData) {
  const { campgroundId, session } = await ownerSession(form);
  let result = "claim-hold";
  try {
    const receiptType = field(form, "receiptType");
    const masterPlane =
      receiptType === "master_source" ? field(form, "masterPlane") : null;
    await admitProtectedSourceReceipt({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      receiptType,
      masterPlane,
    });
    result = "source-claim-recorded-hold";
  } catch {
    // Duplicate nonce, missing migration, invalid authority, or absent
    // original signature never becomes a successful claim.
  }
  done(campgroundId, result);
}
export async function independentRemediationDecisionAction(form: FormData) {
  const { campgroundId, session } = await ownerSession(form);
  let result = "review-hold";
  try {
    await recordIndependentRemediation({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      sourceReceiptClaimId: field(form, "claimId"),
      decision: field(form, "decision"),
      explanation: field(form, "explanation"),
    });
    result = "independent-review-recorded-hold";
  } catch {
    // No self-review, duplicate disposition, wrong source or cross-tenant grant.
  }
  done(campgroundId, result);
}
