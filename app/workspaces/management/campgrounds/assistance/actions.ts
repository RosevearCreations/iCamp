"use server";

import { redirect } from "next/navigation";

import { requireCampgroundPermission } from "@/lib/authz/current-user";
import {
  acknowledgeAssistanceEscalation,
  addAssistanceStaffNote,
  closeAssistanceCase,
  escalateAssistanceCase,
  recordAssistanceGuestMessage,
  resolveAssistanceEscalation,
  triageAssistanceCase,
} from "@/lib/camper-assistance-triage/postgres.mjs";

const path = "/workspaces/management/campgrounds/assistance";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function finish(campgroundId: string, saved: string) {
  redirect(
    path +
      "?campground=" +
      encodeURIComponent(campgroundId) +
      "&saved=" +
      encodeURIComponent(saved),
  );
}

export async function triageAssistanceCaseAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.triage",
    path,
  );

  await triageAssistanceCase({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    category: field(formData, "category"),
    severity: field(formData, "severity"),
    assignedToUserId: field(formData, "assignedToUserId"),
    note: field(formData, "note"),
  });

  finish(campgroundId, "Assistance case triaged.");
}

export async function addAssistanceStaffNoteAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.triage",
    path,
  );

  await addAssistanceStaffNote({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    note: field(formData, "note"),
  });

  finish(campgroundId, "Internal assistance note added.");
}

export async function recordAssistanceGuestMessageAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.communicate",
    path,
  );

  await recordAssistanceGuestMessage({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    channel: field(formData, "channel"),
    message: field(formData, "message"),
  });

  finish(campgroundId, "Guest communication recorded.");
}

export async function escalateAssistanceCaseAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.escalate",
    path,
  );

  await escalateAssistanceCase({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    level: field(formData, "level"),
    reason: field(formData, "reason"),
  });

  finish(campgroundId, "Assistance case escalated.");
}

export async function acknowledgeAssistanceEscalationAction(
  formData: FormData,
) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.escalate",
    path,
  );

  await acknowledgeAssistanceEscalation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    escalationId: field(formData, "escalationId"),
    expectedEscalationRowVersion: Number(
      field(formData, "escalationRowVersion"),
    ),
  });

  finish(campgroundId, "Management escalation acknowledged.");
}

export async function resolveAssistanceEscalationAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.escalate",
    path,
  );

  await resolveAssistanceEscalation({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    escalationId: field(formData, "escalationId"),
    expectedCaseRowVersion: Number(field(formData, "rowVersion")),
    expectedEscalationRowVersion: Number(
      field(formData, "escalationRowVersion"),
    ),
    resolutionNote: field(formData, "resolutionNote"),
  });

  finish(campgroundId, "Management escalation resolved.");
}

export async function closeAssistanceCaseAction(formData: FormData) {
  const campgroundId = field(formData, "campgroundId");
  const session = await requireCampgroundPermission(
    campgroundId,
    "assistance.close",
    path,
  );

  await closeAssistanceCase({
    actorUserId: session.user.id,
    actorSessionId: session.sessionId,
    campgroundId,
    caseId: field(formData, "caseId"),
    expectedRowVersion: Number(field(formData, "rowVersion")),
    outcomeCode: field(formData, "outcomeCode"),
    outcomeSummary: field(formData, "outcomeSummary"),
  });

  finish(campgroundId, "Assistance case closed.");
}
