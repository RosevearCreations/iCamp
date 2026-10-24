"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  createEmergencyNotice,
  recordEmergencyNoticeDecision,
} from "@/lib/emergency-notices/postgres.mjs";

const path = "/workspaces/management/campgrounds/emergency-notices";
const field = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();

function finish(camp: string, notice: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(camp)}&saved=${encodeURIComponent(notice)}`,
  );
}

export async function createEmergencyNoticeAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "emergency.notice.draft",
    path,
  );
  await createEmergencyNotice({
    actorUserId: session.user.id,
    campgroundId,
    id: field(data, "id"),
    audience: field(data, "audience"),
    sectionId: field(data, "sectionId"),
    accommodationId: field(data, "accommodationId"),
    severity: field(data, "severity"),
    title: field(data, "title"),
    message: field(data, "message"),
    onsiteInstructions: field(data, "onsiteInstructions"),
  });
  finish(
    campgroundId,
    "Emergency notice draft saved for independent review; nothing has been sent.",
  );
}

export async function recordEmergencyDecisionAction(data: FormData) {
  const campgroundId = field(data, "campgroundId");
  const kind = field(data, "kind");
  const session = await requireCampgroundPermission(
    campgroundId,
    kind === "manual_handoff"
      ? "emergency.notice.record"
      : "emergency.broadcast",
    path,
  );
  await recordEmergencyNoticeDecision({
    actorUserId: session.user.id,
    campgroundId,
    id: field(data, "id"),
    noticeId: field(data, "noticeId"),
    kind,
    method: field(data, "method"),
    evidenceReference: field(data, "evidenceReference"),
    boundaryAcknowledged: field(data, "boundaryAcknowledged"),
    onsitePlanChecked: field(data, "onsitePlanChecked"),
    note: field(data, "note"),
  });
  finish(
    campgroundId,
    kind === "approve"
      ? "Independent approval recorded. This did not notify anyone or contact emergency services."
      : kind === "manual_handoff"
        ? "An on-site staff handoff was attested; delivery and receipt remain unverified by software."
        : "Emergency notice review recorded in immutable history.",
  );
}
