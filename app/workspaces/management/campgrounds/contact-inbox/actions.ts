"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  checkContactFollowup,
  createContactFromOriginal,
  recordContactAction,
} from "@/lib/release/build257-contact-inbox-postgres.mjs";

const route = "/workspaces/management/campgrounds/contact-inbox";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

async function requireContactStaff(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "communications.read",
    route,
  );
  if (session.assuranceLevel !== "aal2")
    redirect("/auth/mfa?next=" + encodeURIComponent(route));
  return { campgroundId, session };
}

function finish(campgroundId: string, result: string): never {
  revalidatePath(route);
  redirect(
    route +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&result=" +
      encodeURIComponent(result),
  );
}

export async function createContactInboxAction(form: FormData) {
  const { campgroundId, session } = await requireContactStaff(form);
  await requireCampgroundPermission(
    campgroundId,
    "communications.manage",
    route,
  );
  let status = "original-source-hold";
  try {
    const result = await createContactFromOriginal({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      providerEventId: field(form, "providerEventId"),
      contactKind: field(form, "contactKind"),
      assignedRole: field(form, "assignedRole"),
    });
    status = result.status;
  } catch {
    // No original source, missing migration, duplicate or wrong-tenant
    // evidence can ever become a successful intake.
  }
  finish(campgroundId, status);
}

export async function contactTaskAction(form: FormData) {
  const { campgroundId, session } = await requireContactStaff(form);
  let status = "contact-action-hold";
  try {
    const result = await recordContactAction({
      actorUserId: session.user.id,
      actorSessionId: session.sessionId,
      campgroundId,
      inboxId: field(form, "inboxId"),
      action: field(form, "action"),
    });
    status = result.status;
  } catch {
    // Wrong role, cross-tenant inbox, duplicate action or revoked authority
    // is not overridden by a form field.
  }
  finish(campgroundId, status);
}

export async function checkContactConsentAction(form: FormData) {
  const { campgroundId, session } = await requireContactStaff(form);
  let status = "HOLD_CONTACT_CONSENT_OR_SUPPRESSION";
  try {
    const result = await checkContactFollowup({
      actorUserId: session.user.id,
      campgroundId,
      inboxId: field(form, "inboxId"),
    });
    status = result.status;
  } catch {
    // No sending here. A failed or missing original consent check is HOLD.
  }
  finish(campgroundId, status);
}
