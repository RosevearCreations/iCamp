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

// Priorities are review prompts derived from the latest authorized source,
// not an assertion that a case was changed, delivered or closed.
export function prioritizeEscalationRecheckDeltas(receipts, summary) {
  if (!summary || !Array.isArray(summary.items) || !Array.isArray(receipts)) {
    throw new Error("Source recheck data is unavailable.");
  }
  const evidence = summarizeAcknowledgementEvidence(summary);
  const evidenceById = new Map(
    evidence.records.map((item) => [item.escalationId, item]),
  );
  const sourceById = new Map(
    summary.items.map((item) => [item.escalationId, item]),
  );
  const items = receipts.map((receipt) => {
    const current = evidenceById.get(receipt.escalationId);
    const source = sourceById.get(receipt.escalationId);
    const newerSnapshot = receipt.sourceObservedAt !== summary.generatedAt;
    let kind = "await_refresh";
    let priority = 4;
    let guidance = "Refresh the authorized source before another readback.";
    if (!current) {
      kind = "missing_active_source";
      priority = 0;
      guidance =
        "Absent from active source readback: inspect triage; do not infer closure.";
    } else if (newerSnapshot && current.status !== receipt.status) {
      kind = "status_delta";
      priority = current.status === "recorded" ? 2 : 1;
      guidance =
        "Source evidence status differs; inspect triage before capturing the delta.";
    } else if (newerSnapshot) {
      kind = "new_snapshot";
      priority = 3;
      guidance =
        "New source snapshot available; explicitly recapture to confirm.";
    }
    return {
      ...receipt,
      currentStatus: current?.status ?? null,
      kind,
      priority,
      severity: source?.severity ?? "unknown",
      band: source?.band ?? "unknown",
      assignedToLabel: source?.assignedToLabel ?? null,
      guidance,
    };
  });
  items.sort(
    (a, b) =>
      a.priority - b.priority ||
      Number(b.severity === "urgent") - Number(a.severity === "urgent") ||
      Number(!b.assignedToLabel) - Number(!a.assignedToLabel) ||
      Number(b.band === "over72") - Number(a.band === "over72") ||
      a.escalationId.localeCompare(b.escalationId),
  );
  return {
    items,
    count: items.length,
    needsTriageCount: items.filter((item) => item.priority <= 2).length,
    newSnapshotCount: items.filter((item) => item.kind === "new_snapshot")
      .length,
  };
}
