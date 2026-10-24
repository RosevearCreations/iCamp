"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  publishWaterfrontZone,
  recordWaterfrontTraining,
  recordWaterfrontEvent,
} from "@/lib/waterfront-swim/postgres.mjs";

const path = "/workspaces/management/campgrounds/waterfront-safety";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
function finish(campgroundId: string, notice: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(notice)}`,
  );
}

export async function publishWaterfrontZoneAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "waterfront.swim.manage",
    path,
  );
  await publishWaterfrontZone({
    actorUserId: session.user.id,
    campgroundId,
    id: field(data, "id"),
    assetId: field(data, "assetId"),
    zoneCode: field(data, "zoneCode"),
    zoneName: field(data, "zoneName"),
    boundaryDescription: field(data, "boundaryDescription"),
    operatingDays: data.getAll("operatingDays").map(String),
    openTime: field(data, "openTime"),
    closeTime: field(data, "closeTime"),
    maximumSwimmers: field(data, "maximumSwimmers"),
    minimumUnaccompaniedAge: field(data, "minimumUnaccompaniedAge"),
    minimumSupervisorAge: field(data, "minimumSupervisorAge"),
    maximumChildrenPerSupervisor: field(data, "maximumChildrenPerSupervisor"),
    ruleVersionId: field(data, "ruleVersionId"),
    hazardInstructions: field(data, "hazardInstructions"),
  });
  finish(
    campgroundId,
    "Immutable swimming-zone version published. Confirm physical signs and current on-site safety procedures.",
  );
}

export async function recordWaterfrontTrainingAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "waterfront.swim.manage",
    path,
  );
  await recordWaterfrontTraining({
    actorUserId: session.user.id,
    campgroundId,
    id: field(data, "id"),
    assetId: field(data, "assetId"),
    staffUserId: field(data, "staffUserId"),
    decision: field(data, "decision"),
    trainingReference: field(data, "trainingReference"),
    expiresAt: field(data, "expiresAt"),
    note: field(data, "note"),
  });
  finish(campgroundId, "Independent waterfront training decision recorded.");
}

export async function recordWaterfrontEventAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const kind = field(data, "kind");
  const session = await requireCampgroundPermission(
    campgroundId,
    kind === "reopen" ? "waterfront.swim.manage" : "waterfront.swim.monitor",
    path,
  );
  await recordWaterfrontEvent({
    actorUserId: session.user.id,
    campgroundId,
    id: field(data, "id"),
    assetId: field(data, "assetId"),
    zoneCode: field(data, "zoneCode"),
    zoneVersionId: field(data, "zoneVersionId"),
    kind,
    reservationId: field(data, "reservationId"),
    swimmerCount: field(data, "swimmerCount"),
    underageCount: field(data, "underageCount"),
    supervisorCount: field(data, "supervisorCount"),
    admitted: field(data, "admitted"),
    agesVerified: field(data, "agesVerified"),
    hazardType: field(data, "hazardType"),
    hazardLevel: field(data, "hazardLevel"),
    evidenceReference: field(data, "evidenceReference"),
    note: field(data, "note"),
  });
  finish(
    campgroundId,
    kind === "closure"
      ? "Swimming closure recorded. Place real-world warnings/barriers and follow emergency procedures immediately."
      : kind === "reopen"
        ? "Independent swimming reopening recorded. Confirm actual site conditions and physical restrictions separately."
        : "Waterfront observation recorded in immutable history.",
  );
}
