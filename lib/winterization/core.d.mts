export type WinterStep = { key: string; label: string; required: boolean };
export function winterUuid(value: unknown, label: string): string;
export function normalizeWinterTemplate(input: Record<string, unknown>): {
  id: string;
  name: string;
  instructions: string;
  steps: WinterStep[];
};
export function normalizeWinterRun(input: Record<string, unknown>): {
  id: string;
  assignmentId: string;
  templateId: string;
  winterYear: number;
};
export function normalizeWinterStep(input: Record<string, unknown>): {
  id: string;
  runId: string;
  stepKey: string;
  result: string;
  evidenceReference: string | null;
  workOrderId: string | null;
  note: string;
};
export function normalizeWinterReview(input: Record<string, unknown>): {
  id: string;
  runId: string;
  decision: string;
  note: string;
};
export function winterOperatingYear(date?: Date): number;
