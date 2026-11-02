"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createCollectionRoute,
  recordCollectionProof,
  recordGarbageFinanceReview,
} from "@/lib/garbage-collections/postgres.mjs";
const path = "/workspaces/maintenance/garbage/collections";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}
export async function createCollectionRouteAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.routes.manage",
    path,
  );
  await createCollectionRoute({
    actorUserId: session.user.id,
    campgroundId,
    clientRouteId: field(form, "clientRouteId"),
    name: field(form, "name"),
    stream: field(form, "stream"),
    serviceDate: field(form, "serviceDate"),
    note: field(form, "note"),
  });
  finish(campgroundId, "Collection route recorded.");
}
export async function recordCollectionProofAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.routes.manage",
    path,
  );
  await recordCollectionProof({
    actorUserId: session.user.id,
    campgroundId,
    routeId: field(form, "routeId"),
    pickupId: field(form, "pickupId"),
    outcome: field(form, "outcome"),
    bagCount: field(form, "bagCount"),
    note: field(form, "note"),
    evidenceReference: field(form, "evidenceReference"),
  });
  finish(
    campgroundId,
    "Collection proof recorded; pickup status was not changed.",
  );
}
export async function recordGarbageFinanceReviewAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.finance.reconcile",
    path,
  );
  await recordGarbageFinanceReview({
    actorUserId: session.user.id,
    campgroundId,
    clientReviewId: field(form, "clientReviewId"),
    tagId: field(form, "tagId"),
    decision: field(form, "decision"),
    checkedAmountCents: field(form, "checkedAmountCents"),
    note: field(form, "note"),
  });
  finish(
    campgroundId,
    "Receipt review recorded; no payment was captured or modified.",
  );
}
