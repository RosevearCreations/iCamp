"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/current-session";
import {
  getStaffShiftPermissions,
  createStaffShift,
  recordStaffAvailability,
  recordStaffQualification,
  recordStaffHandoff,
  recordStaffShiftEvent,
} from "@/lib/staff-shifts/postgres.mjs";

const path = "/workspaces/management/campgrounds/staff-shifts";
const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
function finish(campgroundId: string, notice: string): never {
  revalidatePath(path);
  redirect(
    `${path}?campground=${encodeURIComponent(campgroundId)}&saved=${encodeURIComponent(notice)}`,
  );
}
function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    /shift overlaps|unavailability|qualification|current staff|independent|handoff|cancelled|authorized|permission|expiry|time|interval|UUID|source shift|receiving staff|staff assignment/i.test(
      message,
    )
  )
    return "Not saved: " + message.slice(0, 240);
  return "Not saved: the staffing evidence could not be recorded. Check inputs and current campground permissions.";
}
async function execute(
  form: FormData,
  required: "self" | "manage" | "verify" | "handoff",
  task: (actorUserId: string, actorSessionId: string) => Promise<unknown>,
  success: string,
) {
  const campgroundId = field(form, "campgroundId");
  const session = await requireStaff(path);
  const p = await getStaffShiftPermissions(session.user.id, campgroundId);
  if (!(required === "handoff" ? p.self || p.manage : p[required]))
    redirect("/auth/not-authorized");
  let notice = success;
  try {
    await task(session.user.id, session.sessionId);
  } catch (error) {
    notice = safeError(error);
  }
  finish(campgroundId, notice);
}

export async function createStaffShiftAction(form: FormData) {
  await execute(
    form,
    "manage",
    (actorUserId, actorSessionId) =>
      createStaffShift({
        actorUserId,
        actorSessionId,
        campgroundId: field(form, "campgroundId"),
        input: {
          id: field(form, "id"),
          staffUserId: field(form, "staffUserId"),
          department: field(form, "department"),
          roleLabel: field(form, "roleLabel"),
          startsAt: field(form, "startsAt"),
          endsAt: field(form, "endsAt"),
          assignmentNote: field(form, "assignmentNote"),
        },
      }),
    "Shift planned. Overlaps, unavailable periods and sensitive qualifications were checked at the database.",
  );
}
export async function recordStaffAvailabilityAction(form: FormData) {
  await execute(
    form,
    "self",
    (actorUserId, actorSessionId) =>
      recordStaffAvailability({
        actorUserId,
        actorSessionId,
        campgroundId: field(form, "campgroundId"),
        input: {
          id: field(form, "id"),
          staffUserId: actorUserId,
          kind: field(form, "kind"),
          startsAt: field(form, "startsAt"),
          endsAt: field(form, "endsAt"),
          clearsEventId: field(form, "clearsEventId"),
          reason: field(form, "reason"),
        },
      }),
    "Availability decision saved. Existing shifts are not automatically cancelled.",
  );
}
export async function recordStaffQualificationAction(form: FormData) {
  await execute(
    form,
    "verify",
    (actorUserId, actorSessionId) =>
      recordStaffQualification({
        actorUserId,
        actorSessionId,
        campgroundId: field(form, "campgroundId"),
        input: {
          id: field(form, "id"),
          staffUserId: field(form, "staffUserId"),
          qualificationKey: field(form, "qualificationKey"),
          decision: field(form, "decision"),
          validUntil: field(form, "validUntil"),
          sourceReference: field(form, "sourceReference"),
          reviewNote: field(form, "reviewNote"),
        },
      }),
    "Independent qualification evidence recorded. Specialized pool/waterfront operating checks remain separate.",
  );
}
export async function recordStaffHandoffAction(form: FormData) {
  await execute(
    form,
    "handoff",
    (actorUserId, actorSessionId) =>
      recordStaffHandoff({
        actorUserId,
        actorSessionId,
        campgroundId: field(form, "campgroundId"),
        input: {
          id: field(form, "id"),
          fromShiftId: field(form, "fromShiftId"),
          toShiftId: field(form, "toShiftId"),
          summary: field(form, "summary"),
          outstandingWork: field(form, "outstandingWork"),
          followUpRequired: form.get("followUpRequired") === "true",
        },
      }),
    "Handoff evidence recorded. The receiving staff member must acknowledge it independently.",
  );
}
export async function recordStaffShiftEventAction(form: FormData) {
  const kind = field(form, "kind");
  await execute(
    form,
    kind === "cancel" ? "manage" : "self",
    (actorUserId, actorSessionId) =>
      recordStaffShiftEvent({
        actorUserId,
        actorSessionId,
        campgroundId: field(form, "campgroundId"),
        input: {
          id: field(form, "id"),
          shiftId: field(form, "shiftId"),
          handoffId: field(form, "handoffId"),
          kind,
          reason: field(form, "reason"),
        },
      }),
    kind === "cancel"
      ? "Shift cancellation recorded without deleting schedule history."
      : "Receiving staff acknowledgement recorded independently.",
  );
}
