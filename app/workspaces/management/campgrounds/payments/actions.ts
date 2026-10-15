"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  moneyInputToCents,
  percentInputToBasisPoints,
} from "@/lib/payments/core.mjs";
import type { PaymentPolicy } from "@/lib/payments/core.mjs";
import { saveCampgroundPaymentPolicy } from "@/lib/payments/postgres.mjs";

const path = "/workspaces/management/campgrounds/payments";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function depositMode(value: string): PaymentPolicy["depositMode"] {
  if (value === "full" || value === "fixed" || value === "percentage") {
    return value;
  }
  throw new Error("Deposit mode is invalid.");
}

function securityDepositDueStage(
  value: string,
): PaymentPolicy["securityDepositDueStage"] {
  if (
    value === "with_deposit" ||
    value === "with_balance" ||
    value === "on_arrival"
  ) {
    return value;
  }
  throw new Error("Security-deposit due stage is invalid.");
}

function balanceDueMode(value: string): PaymentPolicy["balanceDueMode"] {
  if (
    value === "at_booking" ||
    value === "days_before_arrival" ||
    value === "on_arrival"
  ) {
    return value;
  }
  throw new Error("Balance due mode is invalid.");
}

export async function savePaymentPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );
  const selectedDepositMode = depositMode(field(formData, "depositMode"));
  const selectedBalanceDueMode = balanceDueMode(
    field(formData, "balanceDueMode"),
  );

  await saveCampgroundPaymentPolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: Number(field(formData, "rowVersion")),
    depositMode: selectedDepositMode,
    depositFixedCents:
      selectedDepositMode === "fixed"
        ? moneyInputToCents(field(formData, "depositFixedAmount"), "Deposit")
        : null,
    depositPercentageBasisPoints:
      selectedDepositMode === "percentage"
        ? percentInputToBasisPoints(field(formData, "depositPercentage"))
        : null,
    securityDepositCents: moneyInputToCents(
      field(formData, "securityDepositAmount") || "0",
      "Security deposit",
    ),
    securityDepositDueStage: securityDepositDueStage(
      field(formData, "securityDepositDueStage"),
    ),
    balanceDueMode: selectedBalanceDueMode,
    balanceDueDaysBeforeArrival:
      selectedBalanceDueMode === "days_before_arrival"
        ? Number(field(formData, "balanceDueDaysBeforeArrival"))
        : null,
    currencyCode: field(formData, "currencyCode"),
  });

  revalidatePath(path);
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent("Deposit and balance policy saved."),
  );
}
