"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { createPaymentProviderAdapter } from "@/lib/payments/provider.mjs";
import {
  createVisitorRegistration,
  revokeVisitorRegistration,
  saveVisitorPolicy,
  startVisitorRegistrationPayment,
} from "@/lib/visitor-registration/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error
      ? error.message
      : "Visitor registration operation failed."
  ).slice(0, 420);
}

function visitorDeskPath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/visitors?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function destination(
  campgroundId: string,
  kind: "saved" | "error",
  message: string,
) {
  return (
    visitorDeskPath(campgroundId) +
    "&" +
    kind +
    "=" +
    encodeURIComponent(message)
  );
}

export async function saveVisitorPolicyAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = visitorDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    await saveVisitorPolicy({
      actorUserId: session.user.id,
      campgroundId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      input: {
        dayVisitChargeId: text(formData, "dayVisitChargeId") || null,
        weekVisitChargeId: text(formData, "weekVisitChargeId") || null,
        identityVerificationMode: text(formData, "identityVerificationMode"),
        contactRequirement: text(formData, "contactRequirement"),
        visitorRule: text(formData, "visitorRule"),
      },
    });
    revalidatePath(path);
    next = destination(campgroundId, "saved", "Visitor policy saved.");
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function registerVisitorAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = visitorDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await createVisitorRegistration({
      actorUserId: session.user.id,
      campgroundId,
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        reservationId: text(formData, "reservationId"),
        visitorName: text(formData, "visitorName"),
        contactPhone: text(formData, "contactPhone"),
        contactEmail: text(formData, "contactEmail"),
        identityVerified: text(formData, "identityVerified"),
        visitKind: text(formData, "visitKind"),
        validFromLocal: text(formData, "validFromLocal"),
        validUntilLocal: text(formData, "validUntilLocal"),
        notes: text(formData, "notes"),
      },
    });
    revalidatePath(path);
    next = destination(
      campgroundId,
      "saved",
      result.idempotent
        ? "This visitor registration was already recorded."
        : result.registration.paymentState === "unpaid"
          ? "Visitor registered. Capture the configured fee to activate the visit."
          : "Visitor registered and active.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function captureVisitorPaymentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = visitorDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await startVisitorRegistrationPayment({
      actorUserId: session.user.id,
      campgroundId,
      visitorRegistrationId: text(formData, "visitorRegistrationId"),
      provider: createPaymentProviderAdapter(),
    });
    revalidatePath(path);
    next = destination(
      campgroundId,
      "saved",
      result.alreadySatisfied
        ? "Visitor fee was already satisfied."
        : result.registration?.paymentState === "captured"
          ? "Visitor fee captured and registration activated."
          : "Visitor payment is in progress.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function revokeVisitorAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = visitorDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await revokeVisitorRegistration({
      actorUserId: session.user.id,
      campgroundId,
      visitorRegistrationId: text(formData, "visitorRegistrationId"),
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      sourceChannel: "web",
    });
    revalidatePath(path);
    next = destination(
      campgroundId,
      "saved",
      result.idempotent
        ? "Visitor registration was already revoked."
        : "Visitor registration revoked.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}
