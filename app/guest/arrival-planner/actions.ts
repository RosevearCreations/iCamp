"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/current-session";
import { normalizeArrivalPlan } from "@/lib/arrival-planner/core.mjs";
import { saveOwnArrivalPlan } from "@/lib/arrival-planner/postgres.mjs";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export async function saveArrivalPlanAction(form: FormData) {
  const reservationId = field(form, "reservationId");
  const path =
    "/guest/arrival-planner?reservation=" + encodeURIComponent(reservationId);
  const session = await requireSignedIn(path);
  if (session.user.accountType !== "guest") redirect("/auth/not-authorized");
  try {
    const input = normalizeArrivalPlan({
      state: field(form, "intent"),
      expectedArrivalTime: field(form, "expectedArrivalTime"),
      arrivalMode: field(form, "arrivalMode"),
      expectedVehicleCount: field(form, "expectedVehicleCount"),
      expectedVisitorCount: field(form, "expectedVisitorCount"),
      documentPreparation: field(form, "documentPreparation"),
      rulesReviewed: form.get("rulesReviewed") === "on",
      assistanceRequested: form.get("assistanceRequested") === "on",
      assistanceNote: field(form, "assistanceNote"),
    });
    const expectedReservationVersion = Number(
      field(form, "expectedReservationVersion"),
    );
    const expectedPlanVersion = Number(field(form, "expectedPlanVersion"));
    if (
      !Number.isSafeInteger(expectedReservationVersion) ||
      expectedReservationVersion < 1 ||
      !Number.isSafeInteger(expectedPlanVersion) ||
      expectedPlanVersion < 0
    ) {
      throw new Error("Stale reservation or plan version.");
    }
    await saveOwnArrivalPlan({
      userId: session.user.id,
      reservationId,
      expectedReservationVersion,
      expectedPlanVersion,
      input,
    });
    revalidatePath(path);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(path + "&error=review");
  }
  redirect(path + "&saved=1");
}
