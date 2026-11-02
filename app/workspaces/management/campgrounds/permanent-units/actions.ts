"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  recordPermanentUnitOwner,
  draftPermanentUnitListing,
  reviewPermanentUnitListing,
  recordPermanentUnitInquiry,
} from "@/lib/permanent-unit-market/postgres.mjs";

const path = "/workspaces/management/campgrounds/permanent-units";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
function finish(
  campgroundId: string,
  key: "saved" | "error",
  value: string,
): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&${key}=${encodeURIComponent(value.slice(0, 180))}`,
  );
}
async function run(
  form: FormData,
  operation: (userId: string, campgroundId: string) => Promise<unknown>,
  message: string,
) {
  const camp = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    camp,
    "permanent_unit.manage",
    path,
  );
  try {
    await operation(session.user.id, camp);
  } catch (error) {
    finish(
      camp,
      "error",
      error instanceof Error ? error.message : "Permanent-unit action failed.",
    );
  }
  finish(camp, "saved", message);
}
export async function recordOwnerAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordPermanentUnitOwner({
        actorUserId,
        campgroundId,
        id: field(form, "id"),
        accommodationId: field(form, "accommodationId"),
        eventKind: field(form, "eventKind"),
        ownerDisplayName: field(form, "ownerDisplayName"),
        evidenceReference: field(form, "evidenceReference"),
        notes: field(form, "notes"),
      }),
    "Append-only ownership evidence recorded. Listings must reference the latest source.",
  );
}
export async function draftListingAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      draftPermanentUnitListing({
        actorUserId,
        campgroundId,
        id: field(form, "id"),
        accommodationId: field(form, "accommodationId"),
        ownershipEventId: field(form, "ownershipEventId"),
        headline: field(form, "headline"),
        description: field(form, "description"),
        askingPrice: field(form, "askingPrice"),
      }),
    "Private listing draft saved for independent review.",
  );
}
export async function reviewListingAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      reviewPermanentUnitListing({
        actorUserId,
        campgroundId,
        listingId: field(form, "listingId"),
        decision: field(form, "decision"),
        note: field(form, "note"),
      }),
    "Immutable listing decision recorded.",
  );
}
export async function recordBuyerInquiryAction(form: FormData) {
  await run(
    form,
    (actorUserId, campgroundId) =>
      recordPermanentUnitInquiry({
        actorUserId,
        campgroundId,
        id: field(form, "id"),
        listingId: field(form, "listingId"),
        buyerDisplayName: field(form, "buyerDisplayName"),
        contactReference: field(form, "contactReference"),
        inquiryNote: field(form, "inquiryNote"),
      }),
    "Private buyer inquiry received; no transfer, financing or sale has occurred.",
  );
}
