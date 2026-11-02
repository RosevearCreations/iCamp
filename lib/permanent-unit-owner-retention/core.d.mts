export interface ExportReconciliationInput {
  id: string;
  exportAcceptanceId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  observedCount: string | number;
  observedSha256: string;
  evidenceReference: string;
  reconciliationNote: string;
}
export interface ExportRetentionInput {
  id: string;
  exportAcceptanceId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  eventKind: string;
  retentionDueAt?: string;
  evidenceReference: string;
  retentionNote: string;
  confirmed?: string;
}
export function normalizeOwnerExportReconciliation(
  raw: ExportReconciliationInput,
): Omit<ExportReconciliationInput, "observedCount"> & { observedCount: number };
export function normalizeOwnerExportRetention(
  raw: ExportRetentionInput,
  now?: Date,
): Omit<ExportRetentionInput, "retentionDueAt"> & {
  retentionDueAt: string | null;
};
export function classifyReconciliation(
  receipt: { exportSha256: string; exportRowCount: number },
  observation: { observedSha256: string; observedCount: number },
): string;
export function latestByReceipt<
  T extends { id: string; exportAcceptanceId: string },
>(items: T[], timestampKey: keyof T): Map<string, T>;
export function retentionState(
  reconciliation: { result: string } | undefined,
  event: { eventKind: string; retentionDueAt: string | null } | undefined,
  now?: Date,
): string;
