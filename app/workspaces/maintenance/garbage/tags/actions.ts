"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  issueGarbageTag,
  redeemGarbageTag,
} from "@/lib/garbage-tags/postgres.mjs";

const path = "/workspaces/maintenance/garbage/tags";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}
export async function issueTagAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.tags.sell",
    path,
  );
  const tag = await issueGarbageTag({
    actorUserId: session.user.id,
    campgroundId,
    accommodationId: field(form, "accommodationId"),
    reservationId: field(form, "reservationId") || null,
    stream: field(form, "stream"),
    priceCents: field(form, "priceCents"),
    receiptReference: field(form, "receiptReference"),
    saleId: field(form, "saleId"),
  });
  finish(
    campgroundId,
    `Issued tag ${tag.tag_code}. Keep this code on the sticker.`,
  );
}
export async function redeemTagAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.tags.redeem",
    path,
  );
  await redeemGarbageTag({
    actorUserId: session.user.id,
    campgroundId,
    tagCode: field(form, "tagCode"),
    pickupId: field(form, "pickupId"),
  });
  finish(campgroundId, "Tag redeemed for the selected pickup.");
}
