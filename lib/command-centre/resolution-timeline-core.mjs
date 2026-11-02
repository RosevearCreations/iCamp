function validTime(value) {
  if (!value) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}

export function buildCamperResolutionTimeline(cases, observedAt = new Date()) {
  if (!Array.isArray(cases))
    throw new Error("Assistance cases are unavailable.");
  const observed = observedAt.getTime();
  if (!Number.isFinite(observed))
    throw new Error("Invalid observation timestamp.");
  const entries = cases
    .map((item) => {
      const submitted = validTime(item.submittedAt);
      const closed =
        item.caseState === "closed" ? validTime(item.closedAt) : null;
      const durationHours =
        submitted != null && closed != null && closed >= submitted
          ? Math.round(((closed - submitted) / 3_600_000) * 10) / 10
          : null;
      const ageHours =
        submitted != null && observed >= submitted
          ? Math.round(((observed - submitted) / 3_600_000) * 10) / 10
          : null;
      const events = (item.events ?? [])
        .filter((event) => validTime(event.occurredAt) !== null)
        .map((event) => ({
          id: event.id,
          kind: event.eventKind,
          occurredAt: event.occurredAt,
          summary: event.summary,
          actor: event.actorLabel ?? "Staff",
          sourceChannel: event.sourceChannel,
        }))
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      return {
        id: item.id,
        accommodationCode: item.accommodationCode,
        summary: item.summary,
        severity: item.severity,
        caseState: item.caseState,
        assignedToLabel: item.assignedToLabel ?? null,
        submittedAt: item.submittedAt,
        updatedAt: item.updatedAt,
        closedAt: item.closedAt,
        outcomeCode: item.outcomeCode ?? null,
        durationHours,
        ageHours,
        closureEventPresent: events.some((event) => event.kind === "closed"),
        events,
      };
    })
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const closed = entries.filter((item) => item.caseState === "closed");
  const measured = closed.filter((item) => item.durationHours != null);
  const unresolved = entries.filter((item) => item.caseState !== "closed");
  return {
    generatedAt: observedAt.toISOString(),
    count: entries.length,
    closedCount: closed.length,
    unresolvedCount: unresolved.length,
    urgentOpenCount: unresolved.filter((item) => item.severity === "urgent")
      .length,
    closedWithEvidenceCount: closed.filter((item) => item.closureEventPresent)
      .length,
    measuredClosures: measured.length,
    averageResolutionHours: measured.length
      ? Math.round(
          (measured.reduce((sum, item) => sum + item.durationHours, 0) /
            measured.length) *
            10,
        ) / 10
      : null,
    entries,
  };
}
