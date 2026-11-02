"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  requestGarbagePickup,
  saveGarbagePolicy,
  transitionGarbagePickup,
} from "@/lib/garbage-service/postgres.mjs";

const path = "/workspaces/maintenance/garbage";
const field = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

function finish(campgroundId: string, message: string) {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(message)}`,
  );
}

export async function saveGarbagePolicyAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.configure",
    path,
  );
  await saveGarbagePolicy({
    actorUserId: session.user.id,
    campgroundId,
    stream: field(form, "stream"),
    mode: field(form, "mode"),
    feeCents: field(form, "feeCents"),
    weekday: field(form, "weekday"),
    instructions: field(form, "instructions"),
    locationDescription: field(form, "locationDescription"),
    isEnabled: field(form, "isEnabled") === "true",
    expectedRowVersion: field(form, "rowVersion") || "0",
  });
  finish(campgroundId, "Waste service saved.");
}

export async function requestGarbagePickupAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const [stream, mode, extra] = field(form, "service").split("|");
  if (!stream || !mode || extra) {
    throw new Error("Select a valid offered pickup service.");
  }
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.dispatch",
    path,
  );
  await requestGarbagePickup({
    actorUserId: session.user.id,
    campgroundId,
    accommodationId: field(form, "accommodationId"),
    reservationId: field(form, "reservationId") || null,
    stream,
    mode,
    note: field(form, "note"),
    clientRequestId: field(form, "clientRequestId"),
  });
  finish(campgroundId, "Pickup request recorded.");
}

export async function transitionGarbagePickupAction(form: FormData) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "garbage.dispatch",
    path,
  );
  await transitionGarbagePickup({
    actorUserId: session.user.id,
    campgroundId,
    pickupId: field(form, "pickupId"),
    expectedRowVersion: Number(field(form, "rowVersion")),
    nextState: field(form, "nextState"),
    scheduledFor: field(form, "scheduledFor")
      ? `${field(form, "scheduledFor")}Z`
      : null,
    note: field(form, "note"),
  });
  finish(campgroundId, "Pickup status updated.");
}
