export type ReadinessStep = { key: string; label: string; required: boolean };
export { winterOperatingYear, winterUuid } from "../winterization/core.mjs";
export function normalizeReadinessTemplate(input: Record<string, unknown>): {
  id: string;
  name: string;
  instructions: string;
  steps: ReadinessStep[];
};
export function normalizeReadinessAssessment(input: Record<string, unknown>): {
  id: string;
  accommodationId: string;
  assignmentId: string | null;
  templateId: string;
  winterYear: number;
  waterMode: string;
  operatingLimits: string;
};
export function normalizeReadinessObservation(input: Record<string, unknown>): {
  id: string;
  assessmentId: string;
  stepKey: string;
  result: string;
  evidenceReference: string | null;
  workOrderId: string | null;
  note: string;
};
export function normalizeReadinessDecision(input: Record<string, unknown>): {
  id: string;
  assessmentId: string;
  decision: string;
  note: string;
};
