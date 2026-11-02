"use server";

import { clearCampsiteDepartureCleanupTaskAction } from "../departure-cleanup/actions";
import { releaseCottageTurnoverAction } from "../cottage-turnover/actions";

function requireReadback(formData: FormData) {
  if (formData.get("confirmReadback") !== "on") {
    throw new Error(
      "Review and acknowledge the release evidence before continuing.",
    );
  }
}

export async function releaseReviewedCottageTurnoverAction(formData: FormData) {
  requireReadback(formData);
  await releaseCottageTurnoverAction(formData);
}

export async function clearReviewedCampsiteTurnoverAction(formData: FormData) {
  requireReadback(formData);
  await clearCampsiteDepartureCleanupTaskAction(formData);
}
