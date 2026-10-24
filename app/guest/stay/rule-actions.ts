"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { acknowledgeCurrentCampgroundRule } from "@/lib/campground-rules/postgres.mjs";

export async function acknowledgeCampgroundRuleAction(formData: FormData) {
  const session = await requireSignedIn("/guest/stay");
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  const reservationId = String(formData.get("reservationId") ?? "").trim();
  const acknowledged = formData.get("acknowledge") === "on";
  if (!acknowledged)
    throw new Error(
      "Read the published rule version and confirm your acknowledgement.",
    );
  await acknowledgeCurrentCampgroundRule({
    userId: session.user.id,
    reservationId,
    ruleSetId: String(formData.get("ruleSetId") ?? "").trim(),
    ruleVersionId: String(formData.get("ruleVersionId") ?? "").trim(),
  });
  revalidatePath("/guest/stay");
  redirect(`/guest/stay?reservation=${encodeURIComponent(reservationId)}`);
}
