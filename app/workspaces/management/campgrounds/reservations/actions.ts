"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { moneyInputToCents } from "@/lib/payments/core.mjs";
import {
  createRefundProviderAdapter,
  getRefundProviderConfig,
} from "@/lib/refunds/provider.mjs";
import {
  approveReservationRefund,
  executeReservationRefund,
  recordCancellationForfeit,
  recordReservationFinancialAdjustment,
  rejectReservationRefund,
  requestReservationRefund,
} from "@/lib/refunds/postgres.mjs";
import {
  cancelManagedReservation,
  createManagedReservation,
  updateManagedReservation,
} from "@/lib/reservation-management/postgres.mjs";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function errorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Reservation action failed.";
  return message.slice(0, 300);
}

function consolePath(campgroundId: string) {
  return (
    "/workspaces/management/campgrounds/reservations?campground=" +
    encodeURIComponent(campgroundId)
  );
}

function detailPath(campgroundId: string, reservationId: string) {
  return (
    "/workspaces/management/campgrounds/reservations/" +
    encodeURIComponent(reservationId) +
    "?campground=" +
    encodeURIComponent(campgroundId)
  );
}

export async function createReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const path = consolePath(campgroundId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await createManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        arrivalDate: text(formData, "arrivalDate"),
        departureDate: text(formData, "departureDate"),
        guestDisplayName: text(formData, "guestDisplayName"),
        contactEmail: text(formData, "contactEmail"),
        chargeSelections: text(formData, "chargeSelections"),
      },
    });
    revalidatePath(path);
    destination =
      detailPath(campgroundId, result.reservationId) +
      "&saved=" +
      encodeURIComponent(
        result.idempotent
          ? "Reservation creation was already applied."
          : "Reservation created.",
      );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function updateReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await updateManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
      input: {
        accommodationId: text(formData, "accommodationId"),
        arrivalDate: text(formData, "arrivalDate"),
        departureDate: text(formData, "departureDate"),
        guestDisplayName: text(formData, "guestDisplayName"),
        contactEmail: text(formData, "contactEmail"),
        chargeSelections: text(formData, "chargeSelections"),
      },
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    const message =
      "Reservation " +
      result.changeKind +
      " recorded." +
      (result.financialReviewRequired
        ? " Financial review is required before money is adjusted."
        : "");
    destination = path + "&saved=" + encodeURIComponent(message);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function cancelReservationAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);
  let destination: string;

  try {
    const result = await cancelManagedReservation({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      expectedRowVersion: Number(text(formData, "rowVersion")),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
      sourceChannel: "web",
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    const message =
      "Reservation cancelled." +
      (result.financialReviewRequired
        ? " Captured payment exists; Build 045 financial review is required. No refund was issued."
        : " No refund was issued.");
    destination = path + "&saved=" + encodeURIComponent(message);
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }

  redirect(destination);
}

export async function requestRefundAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    const config = getRefundProviderConfig();
    const refund = await requestReservationRefund({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      originalPaymentId: text(formData, "originalPaymentId"),
      amountCents: moneyInputToCents(text(formData, "refundAmount"), "Refund"),
      refundKind: text(formData, "refundKind") || "partial",
      reason: text(formData, "reason"),
      providerKey: config.provider,
      idempotencyKey: text(formData, "idempotencyKey"),
    });
    revalidatePath(path);
    const message = refund.approvalRequired
      ? "Refund request recorded and awaiting a separate finance approver."
      : "Refund request recorded and approved by policy; provider execution is ready.";
    redirect(path + "&saved=" + encodeURIComponent(message));
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function approveRefundAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    await approveReservationRefund({
      actorUserId: session.user.id,
      campgroundId,
      refundId: text(formData, "refundId"),
      reason: text(formData, "reason") || "Approve refund request.",
    });
    revalidatePath(path);
    redirect(path + "&saved=" + encodeURIComponent("Refund approved."));
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function rejectRefundAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    await rejectReservationRefund({
      actorUserId: session.user.id,
      campgroundId,
      refundId: text(formData, "refundId"),
      reason: text(formData, "reason") || "Reject refund request.",
    });
    revalidatePath(path);
    redirect(path + "&saved=" + encodeURIComponent("Refund rejected."));
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function executeRefundAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    const provider = createRefundProviderAdapter(getRefundProviderConfig());
    const result = await executeReservationRefund({
      actorUserId: session.user.id,
      campgroundId,
      refundId: text(formData, "refundId"),
      provider,
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    redirect(
      path +
        "&saved=" +
        encodeURIComponent(
          result.duplicate
            ? "Refund was already completed."
            : "Refund completed and adjustment evidence recorded.",
        ),
    );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function recordFinancialAdjustmentAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    const adjustmentKind = text(formData, "adjustmentKind");
    const effectByKind: Record<string, string> = {
      credit: "customer_credit",
      charge: "customer_debit",
      forfeit: "retained",
      writeoff: "none",
    };
    const financialEffect = effectByKind[adjustmentKind];
    if (!financialEffect) {
      throw new Error("Financial adjustment kind is invalid.");
    }

    await recordReservationFinancialAdjustment({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      adjustmentKind,
      financialEffect,
      amountCents: moneyInputToCents(
        text(formData, "adjustmentAmount"),
        "Adjustment",
      ),
      currencyCode: text(formData, "currencyCode"),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
    revalidatePath(path);
    redirect(
      path +
        "&saved=" +
        encodeURIComponent("Append-only financial adjustment recorded."),
    );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}

export async function recordCancellationForfeitAction(formData: FormData) {
  const campgroundId = text(formData, "campgroundId");
  const reservationId = text(formData, "reservationId");
  const path = detailPath(campgroundId, reservationId);
  const session = await requireStaff(path);

  try {
    await recordCancellationForfeit({
      actorUserId: session.user.id,
      campgroundId,
      reservationId,
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
    revalidatePath(path);
    revalidatePath(consolePath(campgroundId));
    redirect(
      path +
        "&saved=" +
        encodeURIComponent(
          "Cancellation policy retained amount recorded; financial review resolved.",
        ),
    );
  } catch (error) {
    redirect(path + "&error=" + encodeURIComponent(errorMessage(error)));
  }
}
