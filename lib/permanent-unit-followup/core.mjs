import { unitId } from "../permanent-unit-market/core.mjs";
const detail = (value, label, min = 8, max = 400) => {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max)
    throw new Error(`${label} needs ${min}–${max} characters.`);
  return s;
};
const future = (value) => {
  const n = Date.parse(String(value ?? ""));
  if (!Number.isFinite(n) || n <= Date.now() || n > Date.now() + 90 * 86400000)
    throw new Error("Follow-up due date must be within 90 days in the future.");
  return new Date(n).toISOString();
};
const base = (input) => ({
  id: unitId(input.id),
  evidenceReference: detail(input.evidenceReference, "Evidence reference"),
  note: detail(input.note, "Rationale", 12, 800),
});
export function normalizeFollowupTask(input) {
  return {
    id: unitId(input.id),
    escalationId: unitId(input.escalationId, "Escalation"),
    ownerResponseId: unitId(input.ownerResponseId, "Owner response"),
    assignedOwnerUserId: unitId(input.assignedOwnerUserId, "Owner"),
    taskReference: detail(input.taskReference, "Task reference"),
    actionPlan: detail(input.actionPlan, "Action plan", 12, 800),
    dueAt: future(input.dueAt),
  };
}
export function normalizeFollowupEvidence(input) {
  const kind = String(input.evidenceKind ?? "");
  if (!["action_taken", "pending_dependency", "blocked"].includes(kind))
    throw new Error("Invalid follow-up evidence kind.");
  return {
    ...base(input),
    taskId: unitId(input.taskId, "Task"),
    evidenceKind: kind,
  };
}
export function normalizeFollowupReassessment(input) {
  const reassessment = String(input.reassessment ?? "");
  if (!["continue_followup", "recommend_admin_closure"].includes(reassessment))
    throw new Error("Invalid independent reassessment.");
  return {
    ...base(input),
    taskId: unitId(input.taskId, "Task"),
    evidenceId: unitId(input.evidenceId, "Evidence"),
    reassessment,
  };
}
export function normalizeEscalationClosure(input) {
  const outcome = String(input.outcome ?? "");
  if (
    !["administrative_followup_complete", "returned_to_operator"].includes(
      outcome,
    )
  )
    throw new Error("Invalid administrative closure outcome.");
  return {
    ...base(input),
    taskId: unitId(input.taskId, "Task"),
    reassessmentId: unitId(input.reassessmentId, "Reassessment"),
    outcome,
  };
}
