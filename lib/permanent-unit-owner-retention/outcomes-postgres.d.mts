export interface OwnerOutcomeReport {
  reassessments: Array<{
    id: string;
    decision_id: string;
    assessment_kind: string;
    reassessed_at: Date;
  }>;
  outcomes: Array<{
    id: string;
    reassessment_id: string;
    outcome_kind: string;
    evidence_reference: string;
    outcome_note: string;
    recorded_at: Date;
  }>;
  acceptances: Array<{
    id: string;
    outcome_id: string;
    acceptance_kind: string;
    audit_note: string;
    accepted_at: Date;
  }>;
  limited: boolean;
}
export function getOwnerReassessmentOutcomes(
  actor: string,
  source: string,
  target: string,
): Promise<OwnerOutcomeReport>;
export function recordOwnerReassessmentOutcome(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
export function recordIndependentOwnerOutcomeAcceptance(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{ id: string }>;
