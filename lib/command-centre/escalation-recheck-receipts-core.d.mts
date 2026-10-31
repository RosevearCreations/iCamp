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
