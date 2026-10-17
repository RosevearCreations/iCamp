"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { createPaymentProviderAdapter } from "@/lib/payments/provider.mjs";
import {
  createExtraVehiclePass,
  createNonStayVehiclePass,
  revokeVehiclePass,
  saveVehiclePassPolicy,
  startVehiclePassPayment,
} from "@/lib/vehicle-pass/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  return (
    error instanceof Error ? error.message : "Vehicle pass operation failed."
  ).slice(0, 420);
}

function passDeskPath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/vehicles/passes?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function destination(
  campgroundId: string,
  kind: "saved" | "error",
  message: string,
) {
  return (
    passDeskPath(campgroundId) +
    "&" +
    kind +
    "=" +
    encodeURIComponent(message)
  );
}

export async function saveVehiclePassPolicyAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = passDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    await saveVehiclePassPolicy({
      actorUserId: session.user.id,
      campgroundId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      input: {
        dayPassChargeId: text(formData, "dayPassChargeId") || null,
        weekPassChargeId: text(formData, "weekPassChargeId") || null,
        extraVehicleChargeId:
          text(formData, "extraVehicleChargeId") || null,
        includedStayVehicleCount: text(
          formData,
          "includedStayVehicleCount",
        ),
        parkingRule: text(formData, "parkingRule"),
        accessRule: text(formData, "accessRule"),
      },
    });
    revalidatePath(path);
    next = destination(campgroundId, "saved", "Vehicle pass policy saved.");
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function issueNonStayVehiclePassAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = passDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await createNonStayVehiclePass({
      actorUserId: session.user.id,
      campgroundId,
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        passKind: text(formData, "passKind"),
        plateNumber: text(formData, "plateNumber"),
        plateJurisdiction: text(formData, "plateJurisdiction"),
        vehicleDescription: text(formData, "vehicleDescription"),
        driverName: text(formData, "driverName"),
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
        ? "This vehicle pass was already recorded."
        : result.pass.paymentState === "unpaid"
          ? "Vehicle pass created. Capture the configured fee to activate it."
          : "Vehicle pass issued and active.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function issueExtraVehiclePassAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = passDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await createExtraVehiclePass({
      actorUserId: session.user.id,
      campgroundId,
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        roadVehicleRegistrationId: text(
          formData,
          "roadVehicleRegistrationId",
        ),
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
        ? "This extra-vehicle pass was already recorded."
        : result.pass.paymentState === "unpaid"
          ? "Extra-vehicle pass created. Capture the configured fee to activate it."
          : "Extra-vehicle pass issued and active.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function captureVehiclePassPaymentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = passDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await startVehiclePassPayment({
      actorUserId: session.user.id,
      campgroundId,
      vehiclePassId: text(formData, "vehiclePassId"),
      provider: createPaymentProviderAdapter(),
    });
    revalidatePath(path);
    next = destination(
      campgroundId,
      "saved",
      result.alreadySatisfied
        ? "Vehicle pass fee was already satisfied."
        : result.pass?.paymentState === "captured"
          ? "Vehicle pass fee captured and pass activated."
          : "Vehicle pass payment is in progress.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}

export async function revokeVehiclePassAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = passDeskPath(campgroundId);
  const session = await requireStaff(path);
  let next: string;

  try {
    const result = await revokeVehiclePass({
      actorUserId: session.user.id,
      campgroundId,
      vehiclePassId: text(formData, "vehiclePassId"),
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      sourceChannel: "web",
    });
    revalidatePath(path);
    next = destination(
      campgroundId,
      "saved",
      result.idempotent
        ? "Vehicle pass was already revoked."
        : "Vehicle pass revoked.",
    );
  } catch (error) {
    next = destination(campgroundId, "error", errorMessage(error));
  }

  redirect(next);
}
