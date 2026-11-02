export const INCIDENT_CATEGORIES: ReadonlyArray<string>;
export const INCIDENT_SEVERITIES: ReadonlyArray<string>;
export const INCIDENT_SIGNALS: ReadonlyArray<string>;
export function incidentUuid(value: unknown, label?: string): string;
export function incidentText(
  value: unknown,
  label: string,
  min?: number,
  max?: number,
): string;
export function normalizeIncidentIntake(input: {
  title: unknown;
  category: string;
  severity: string;
  operationalSummary: unknown;
  linkedSignalKind?: unknown;
  linkedSignalId?: unknown;
}): {
  title: string;
  category: string;
  severity: string;
  operationalSummary: string;
  linkedSignalKind: string | null;
  linkedSignalId: string | null;
};
export function independentReviewEligibility(
  caseItem: {
    status: string;
    openedByUserId: string;
    assigneeUserId: string | null;
    closureRequestedByUserId: string | null;
  },
  actorUserId: string,
  events?: Array<{ actorUserId: string; eventKind: string }>,
): {
  eligible: boolean;
  reason: string | null;
};
export function canRequestIncidentClosure(
  caseItem: { status: string },
  attachments: Array<{
    lifecycleState: string;
    validationState: string;
  }>,
): boolean;
