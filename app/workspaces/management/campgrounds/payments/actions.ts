"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  moneyInputToCents,
  percentInputToBasisPoints,
} from "@/lib/payments/core.mjs";
import { saveCampgroundPaymentPolicy } from "@/lib/payments/postgres.mjs";

const path = "/workspaces/management/campgrounds/payments";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function savePaymentPolicyAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "campground.configuration",
    path,
  );
  const depositMode = field(formData, "depositMode");
  const balanceDueMode = field(formData, "balanceDueMode");

  await saveCampgroundPaymentPolicy({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    expectedRowVersion: Number(field(formData, "rowVersion")),
    depositMode,
    depositFixedCents:
      depositMode === "fixed"
        ? moneyInputToCents(field(formData, "depositFixedAmount"), "Deposit")
        : null,
    depositPercentageBasisPoints:
      depositMode === "percentage"
        ? percentInputToBasisPoints(field(formData, "depositPercentage"))
        : null,
    securityDepositCents: moneyInputToCents(
      field(formData, "securityDepositAmount") || "0",
      "Security deposit",
    ),
    securityDepositDueStage: field(formData, "securityDepositDueStage"),
    balanceDueMode,
    balanceDueDaysBeforeArrival:
      balanceDueMode === "days_before_arrival"
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
