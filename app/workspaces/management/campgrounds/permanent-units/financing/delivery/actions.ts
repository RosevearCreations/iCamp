"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  registerDisclosureVersion,
  reviewDisclosureVersion,
  recordOfferDeliveryConsent,
  signoffOfferHandoff,
} from "@/lib/permanent-unit-delivery/postgres.mjs";
const path =
  "/workspaces/management/campgrounds/permanent-units/financing/delivery";
const f = (form: FormData, k: string) => String(form.get(k) ?? "").trim();
async function run(
  form: FormData,
  work: (user: string, camp: string) => Promise<unknown>,
  message: string,
) {
  const camp = f(form, "campgroundId"),
    session = await requireCampgroundPermission(
      camp,
      "permanent_unit.transfer",
      path,
    );
  let key: "saved" | "error" = "saved",
    result = message;
  try {
    await work(session.user.id, camp);
  } catch (e) {
    key = "error";
    result =
      e instanceof Error ? e.message : "Private delivery operation failed.";
  }
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&${key}=${encodeURIComponent(result.slice(0, 180))}`,
  );
}
export async function registerDisclosureAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      registerDisclosureVersion({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        jurisdiction: f(form, "jurisdiction"),
        versionCode: f(form, "versionCode"),
        documentReference: f(form, "documentReference"),
        sha256: f(form, "sha256"),
        legalReviewReference: f(form, "legalReviewReference"),
        note: f(form, "note"),
      }),
    "Immutable disclosure version registered; independent approval still required.",
  );
}
export async function reviewDisclosureAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      reviewDisclosureVersion({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        versionId: f(form, "versionId"),
        outcome: f(form, "outcome"),
        note: f(form, "note"),
      }),
    "Independent document version review recorded.",
  );
}
export async function consentDeliveryAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordOfferDeliveryConsent({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        proposalId: f(form, "proposalId"),
        versionId: f(form, "versionId"),
        channel: f(form, "channel"),
        consentReference: f(form, "consentReference"),
        recipientReference: f(form, "recipientReference"),
        note: f(form, "note"),
      }),
    "Applicant-specific delivery consent and exact disclosure version pinned; nothing sent.",
  );
}
export async function signoffDeliveryAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      signoffOfferHandoff({
        actorUserId,
        campgroundId,
        id: randomUUID(),
        consentId: f(form, "consentId"),
        decision: f(form, "decision"),
        reviewReference: f(form, "reviewReference"),
        note: f(form, "note"),
      }),
    "Independent sign-off recorded for manual coordination only; no transmission or acceptance.",
  );
}
