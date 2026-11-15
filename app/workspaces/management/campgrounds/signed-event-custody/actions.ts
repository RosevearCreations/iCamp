"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  admitProtectedSignedEvent,
  recordIndependentSignedRevocation,
} from "@/lib/release/build256-signed-events-postgres.mjs";

const route = "/workspaces/management/campgrounds/signed-event-custody";
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

export async function claimSignedEventAction(form: FormData) {
  const { campgroundId, session } = await ownerSession(form);
  let result = "signed-original-hold";
  try {
    await admitProtectedSignedEvent({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
    });
    result = "signed-source-recorded-hold";
  } catch {
    // Missing real protected signer, Master receipts, migration, MFA or
    // replayed nonce must NEVER be reported as admitted.
  }
  done(campgroundId, result);
}

export async function reviewSignedRevocationAction(form: FormData) {
  const { campgroundId, session } = await ownerSession(form);
  let result = "signed-revocation-hold";
  try {
    await recordIndependentSignedRevocation({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      revokedReceiptId: field(form, "revokedReceiptId"),
      signedRevocationReceiptId: field(form, "signedRevocationReceiptId"),
      reasonCode: field(form, "reasonCode"),
    });
    result = "revocation-queued-undelivered-hold";
  } catch {
    // No synthetic signing, self-review, duplicate dispositions, unverified
    // sources, cross-tenant grant or actual delivery is permitted.
  }
  done(campgroundId, result);
}
