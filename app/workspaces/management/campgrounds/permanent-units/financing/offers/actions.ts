"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  draftOfferTerms,
  reviewOfferTerms,
} from "@/lib/permanent-unit-offers/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/offers";
const v = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function run(
  form: FormData,
  work: (user: string, camp: string) => Promise<unknown>,
  success: string,
) {
  const camp = v(form, "campgroundId"),
    session = await requireCampgroundPermission(
      camp,
      "permanent_unit.transfer",
      path,
    );
  let key: "saved" | "error" = "saved",
    message = success;
  try {
    await work(session.user.id, camp);
  } catch (e) {
    key = "error";
    message = e instanceof Error ? e.message : "Offer review failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${key}=${encodeURIComponent(message.slice(0, 180))}`,
  );
}
export async function draftOfferAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      draftOfferTerms({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        applicationId: v(form, "applicationId"),
        principal: v(form, "principal"),
        annualRateBps: v(form, "annualRateBps"),
        months: v(form, "months"),
        fee: v(form, "fee"),
        policyReference: v(form, "policyReference"),
        disclosureReference: v(form, "disclosureReference"),
        note: v(form, "note"),
      }),
    "Private non-binding terms illustration saved for independent internal authorization.",
  );
}
export async function reviewOfferAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      reviewOfferTerms({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        proposalId: v(form, "proposalId"),
        decision: v(form, "decision"),
        externalReviewReference: v(form, "externalReviewReference"),
        note: v(form, "note"),
      }),
    "Independent internal preparation decision recorded; no applicant offer or loan created.",
  );
}
