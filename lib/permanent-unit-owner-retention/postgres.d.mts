import type {
  ExportReconciliationInput,
  ExportRetentionInput,
} from "./core.mjs";
export interface ExportReceiptRow {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  exportSha256: string;
  exportRowCount: number;
  searchStatus: string;
  searchQuery: string;
  evidenceReference: string;
  acceptedByUserId: string;
  acceptedAt: string;
}
export interface ReconciliationRow {
  id: string;
  exportAcceptanceId: string;
  observedSha256: string;
  observedCount: number;
  result: string;
  evidenceReference: string;
  reconciliationNote: string;
  reconciledByUserId: string;
  reconciledAt: string;
}
export interface RetentionEventRow {
  id: string;
  exportAcceptanceId: string;
  eventKind: string;
  retentionDueAt: string | null;
  evidenceReference: string;
  retentionNote: string;
  recordedByUserId: string;
  recordedAt: string;
}
export function getOwnerExportRetentionLedger(
  actorUserId: string,
  sourceCampgroundId: string | null,
  targetCampgroundId: string | null,
): Promise<{
  receipts: ExportReceiptRow[];
  reconciliations: ReconciliationRow[];
  events: RetentionEventRow[];
  receiptsLimited: boolean;
  historyLimited: boolean;
}>;
export function reconcileOwnerExport(
  input: ExportReconciliationInput & { actorUserId: string },
): Promise<{ id: string; result: string }>;
export function recordOwnerExportRetention(
  input: ExportRetentionInput & { actorUserId: string },
): Promise<string>;
