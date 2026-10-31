import { summarizeAcknowledgementEvidence } from "./escalation-aging-core.mjs";

// A receipt records a user's local observation of an authorized source
// snapshot. It is not a server-issued receipt, authenticated reviewer proof,
// case acknowledgment, delivery evidence or closure certification.
export function captureEscalationRecheckReceipt(
  summary,
  escalationId,
  capturedAt = new Date(),
  previousReceipt = null,
) {
  const evidence = summarizeAcknowledgementEvidence(summary);
  const observedAt = Date.parse(summary.generatedAt);
  const recordedAt = capturedAt.getTime();
  if (!Number.isFinite(recordedAt) || !Number.isFinite(observedAt)) {
    throw new Error("Invalid source or operator observation time.");
  }
  const record = evidence.records.find(
    (item) => item.escalationId === escalationId,
  );
  if (!record)
    throw new Error(
      "Escalation is not present in the current authorized source readback.",
    );
  if (
    previousReceipt &&
    previousReceipt.escalationId === escalationId &&
    previousReceipt.sourceObservedAt === summary.generatedAt
  ) {
    throw new Error(
      "Refresh the source before recording a second observation.",
    );
  }
  const comparablePrevious =
    previousReceipt?.escalationId === escalationId ? previousReceipt : null;
  return {
    escalationId: record.escalationId,
    caseId: record.caseId,
    sourceObservedAt: summary.generatedAt,
    operatorRecordedAt: capturedAt.toISOString(),
    status: record.status,
    previousStatus: comparablePrevious?.status ?? null,
    change: !comparablePrevious
      ? "baseline"
      : comparablePrevious.status === record.status
        ? "unchanged"
        : "changed",
  };
}
