export function validateSavedPriorityView(input: {
  label: string;
  filter: string;
}): {
  label: string;
  filter: string;
};
export function validateCaseOwnership(input: {
  dispatchId: string;
  previousEventId: string;
  intent: string;
  note: string;
}): {
  dispatchId: string;
  previousEventId: string | null;
  intent: string;
  note: string;
};
export function validateMobileFieldReport(input: {
  dispatchId: string;
  deviceKind: string;
  outcome: string;
  note: string;
}): { dispatchId: string; deviceKind: string; outcome: string; note: string };
export function fieldAcceptanceLabel(
  report: { outcome: string } | null,
): string;
