export function springWinterYear(date?: Date): number;
export function winterUuid(value: unknown, label: string): string;
export type SpringStep = { key: string; label: string; required: boolean };
export const requiredSpringSteps: readonly SpringStep[];
export function normalizeSpringTemplate(input: Record<string, unknown>): {
  id: string;
  name: string;
  instructions: string;
  steps: SpringStep[];
};
export function normalizeSpringInspection(input: Record<string, unknown>): {
  id: string;
  accommodationId: string;
  assignmentId: string | null;
  templateId: string;
  winterYear: number;
  waterService: string;
  operatingLimits: string;
};
export function normalizeSpringObservation(input: Record<string, unknown>): {
  id: string;
  inspectionId: string;
  stepKey: string;
  result: string;
  evidenceReference: string | null;
  workOrderId: string | null;
  note: string;
};
export function normalizeSpringDecision(input: Record<string, unknown>): {
  id: string;
  inspectionId: string;
  decision: string;
  note: string;
};
