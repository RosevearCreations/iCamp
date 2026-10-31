import type {
  EscalationAgingSummary,
  AcknowledgementEvidenceRecord,
} from "./escalation-aging-core.mjs";

export interface LocalRecheckReceipt {
  escalationId: string;
  caseId: string;
  sourceObservedAt: string;
  operatorRecordedAt: string;
  status: AcknowledgementEvidenceRecord["status"];
  previousStatus: AcknowledgementEvidenceRecord["status"] | null;
  change: "baseline" | "unchanged" | "changed";
}
export function captureEscalationRecheckReceipt(
  summary: EscalationAgingSummary,
  escalationId: string,
  capturedAt?: Date,
  previousReceipt?: LocalRecheckReceipt | null,
): LocalRecheckReceipt;
export interface PrioritizedRecheckDelta extends LocalRecheckReceipt {
  currentStatus: LocalRecheckReceipt["status"] | null;
  kind:
    "await_refresh" | "missing_active_source" | "status_delta" | "new_snapshot";
  priority: number;
  severity: string;
  band: string;
  assignedToLabel: string | null;
  guidance: string;
}
export function prioritizeEscalationRecheckDeltas(
  receipts: LocalRecheckReceipt[],
  summary: EscalationAgingSummary,
): {
  items: PrioritizedRecheckDelta[];
  count: number;
  needsTriageCount: number;
  newSnapshotCount: number;
};
export function createEscalationDeltaEvidenceHandoff(
  summary: EscalationAgingSummary,
  prioritized: ReturnType<typeof prioritizeEscalationRecheckDeltas>,
  campgroundId: string,
  focus?: "triage" | "all",
): { selectedCount: number; text: string };
