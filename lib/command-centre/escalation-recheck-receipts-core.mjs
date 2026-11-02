import { summarizeAcknowledgementEvidence } from "./escalation-aging-core.mjs";

export const ESCALATION_SESSION_LIMIT = 16;
export const ESCALATION_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1_000;
const evidenceStatuses = new Set([
  "recorded",
  "pending",
  "missing_timestamp",
  "invalid_timestamp",
  "sequence_unknown",
  "state_conflict",
]);

// Temporary operator observations survive a same-tab refresh, but are always
// scoped to the signed-in user and campground. They are not authoritative
// records and cannot be presented as external delivery or closure evidence.
export function parseEscalationSnapshotSession(raw, scope, now = new Date()) {
  if (typeof raw !== "string" || raw.length > 12_000) return [];
  try {
    const payload = JSON.parse(raw);
    const age = now.getTime() - Date.parse(payload.savedAt);
    if (
      payload.version !== 1 ||
      payload.scope?.userId !== scope.userId ||
      payload.scope?.campgroundId !== scope.campgroundId ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > ESCALATION_SESSION_MAX_AGE_MS ||
      !Array.isArray(payload.receipts) ||
      payload.receipts.length > ESCALATION_SESSION_LIMIT
    )
      return [];
    const observed = new Set();
    const result = [];
    for (const item of payload.receipts) {
      if (
        !item ||
        ![item.escalationId, item.caseId].every(
          (id) =>
            typeof id === "string" &&
            id.length > 0 &&
            id.length <= 100 &&
            !/[\r\n|\t]/.test(id),
        ) ||
        !Number.isFinite(Date.parse(item.sourceObservedAt)) ||
        !Number.isFinite(Date.parse(item.operatorRecordedAt)) ||
        !evidenceStatuses.has(item.status) ||
        (item.previousStatus !== null &&
          !evidenceStatuses.has(item.previousStatus)) ||
        !["baseline", "unchanged", "changed"].includes(item.change) ||
        observed.has(item.escalationId)
      )
        return [];
      observed.add(item.escalationId);
      result.push({
        escalationId: item.escalationId,
        caseId: item.caseId,
        sourceObservedAt: item.sourceObservedAt,
        operatorRecordedAt: item.operatorRecordedAt,
        status: item.status,
        previousStatus: item.previousStatus,
        change: item.change,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export function serializeEscalationSnapshotSession(
  receipts,
  scope,
  now = new Date(),
) {
  const raw = JSON.stringify({
    version: 1,
    savedAt: now.toISOString(),
    scope: { userId: scope.userId, campgroundId: scope.campgroundId },
    receipts,
  });
  if (
    parseEscalationSnapshotSession(raw, scope, now).length !== receipts.length
  )
    throw new Error("Only valid scoped source observations can be retained.");
  return raw;
}

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

// Opt-in clipboard handoff preserves both source timestamps and the actual
// uncertainty. Never represents local observations as independent receipts.
export function createEscalationDeltaEvidenceHandoff(
  summary,
  prioritized,
  campgroundId,
  focus = "triage",
) {
  if (
    !summary ||
    !Number.isFinite(Date.parse(summary.generatedAt)) ||
    !Array.isArray(prioritized?.items) ||
    typeof campgroundId !== "string" ||
    !campgroundId ||
    !["triage", "all"].includes(focus)
  ) {
    throw new Error("A valid source snapshot and handoff scope are required.");
  }
  const rows = prioritized.items.filter((item) =>
    focus === "all" ? true : item.priority <= 2,
  );
  const cell = (value) =>
    String(value ?? "not in active source")
      .replace(/[|\r\n\t]/g, " ")
      .slice(0, 180);
  return {
    selectedCount: rows.length,
    text: [
      "iCamp Build 170 — Source-pinned local escalation delta evidence handoff",
      `Current authorized source snapshot UTC: ${summary.generatedAt}`,
      `Selection: ${focus === "triage" ? "changed / missing active source" : "all local observations"} (${rows.length})`,
      ...rows.map(
        (item) =>
          `priority ${item.priority} | case ${cell(item.caseId)} | escalation ${cell(item.escalationId)} | ${cell(item.kind)} | earlier captured ${cell(item.status)} at ${cell(item.sourceObservedAt)} | current source ${cell(item.currentStatus)} at ${summary.generatedAt} | owner ${cell(item.assignedToLabel)} | ${cell(item.guidance)} | triage /workspaces/management/campgrounds/assistance?campground=${encodeURIComponent(campgroundId)}#assistance-case-${encodeURIComponent(item.caseId)}`,
      ),
      "Local operator observations only. Missing from active source does not mean closed. No independent signature, acknowledgment, delivery or closure proof. No case write or external message was sent.",
    ].join("\n"),
  };
}
