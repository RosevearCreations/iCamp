"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import { moneyInputToCents } from "@/lib/payments/core.mjs";
import { saveCampgroundCancellationRefundPolicy } from "@/lib/refunds/postgres.mjs";

const path = "/workspaces/management/campgrounds/refunds";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function percentToBasisPoints(value: string, label: string) {
  if (!/^\d{1,3}(?:\.\d{1,2})?$/u.test(value)) {
    throw new Error(label + " must be between 0 and 100.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(label + " must be between 0 and 100.");
  }
  return Math.round(parsed * 100);
}

export async function saveCancellationRefundPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireStaff(
    path + "?campground=" + encodeURIComponent(campgroundId),
  );

  await saveCampgroundCancellationRefundPolicy({
    actorUserId: session.user.id,
    campgroundId,
    expectedRowVersion: Number(field(formData, "rowVersion")),
    currencyCode: field(formData, "currencyCode"),
    freeCancellationDaysBeforeArrival: Number(
      field(formData, "freeCancellationDaysBeforeArrival"),
    ),
    earlyRefundBasisPoints: percentToBasisPoints(
      field(formData, "earlyRefundPercentage"),
      "Early refund percentage",
    ),
    lateRefundBasisPoints: percentToBasisPoints(
      field(formData, "lateRefundPercentage"),
      "Late refund percentage",
    ),
    securityDepositRefundBasisPoints: percentToBasisPoints(
      field(formData, "securityDepositRefundPercentage"),
      "Security-deposit refund percentage",
    ),
    cancellationFeeCents: moneyInputToCents(
      field(formData, "cancellationFeeAmount") || "0",
      "Cancellation fee",
    ),
    approvalThresholdCents: moneyInputToCents(
      field(formData, "approvalThresholdAmount") || "0",
      "Approval threshold",
    ),
  });

  revalidatePath(path);
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent("Cancellation/refund policy saved."),
  );
}
