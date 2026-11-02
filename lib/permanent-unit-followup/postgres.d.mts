export interface FollowupDashboard {
  campground: { id: string; name: string; organization_id: string };
  escalations: Array<{
    id: string;
    target_owner_user_id: string;
    requested_action: string;
    due_at: string;
    priority: string;
  }>;
  responses: Array<{ id: string; escalation_id: string; response: string }>;
  tasks: Array<{
    id: string;
    escalation_id: string;
    owner_response_id: string;
    assigned_owner_user_id: string;
    action_plan: string;
    due_at: string;
    task_reference: string;
  }>;
  evidence: Array<{
    id: string;
    task_id: string;
    evidence_kind: string;
    evidence_reference: string;
    note: string;
    recorded_at: string;
  }>;
  reassessments: Array<{
    id: string;
    task_id: string;
    evidence_id: string;
    reassessment: string;
    reassessed_at: string;
  }>;
  closures: Array<{
    id: string;
    task_id: string;
    outcome: string;
    closed_at: string;
  }>;
}
export function getFollowupDashboard(
  actorUserId: string,
  campgroundId: string,
): Promise<FollowupDashboard>;
export function createFollowupTask(
  input: Record<string, unknown>,
): Promise<string>;
export function recordFollowupEvidence(
  input: Record<string, unknown>,
): Promise<string>;
export function recordFollowupReassessment(
  input: Record<string, unknown>,
): Promise<string>;
export function recordEscalationClosure(
  input: Record<string, unknown>,
): Promise<string>;
