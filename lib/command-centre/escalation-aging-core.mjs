function ageHours(raisedAt, now) {
  const raised = raisedAt ? Date.parse(raisedAt) : Number.NaN;
  return Number.isFinite(raised) && raised <= now
    ? Math.round(((now - raised) / 3_600_000) * 10) / 10
    : null;
}

function agingBand(hours) {
  if (hours === null) return "unknown";
  if (hours >= 72) return "over72";
  if (hours >= 24) return "over24";
  return "under24";
}

export function summarizeEscalationAging(cases, observedAt = new Date()) {
  if (!Array.isArray(cases)) throw new Error("Escalation queue unavailable.");
  const now = observedAt.getTime();
  if (!Number.isFinite(now))
    throw new Error("Invalid aging observation timestamp.");
  let multipleActive = 0;
  const items = [];
  for (const item of cases) {
    const active = (item.escalations ?? [])
      .filter(
        (event) => event.state === "open" || event.state === "acknowledged",
      )
      .sort((a, b) => (b.raisedAt ?? "").localeCompare(a.raisedAt ?? ""));
    if (!active.length) continue;
    if (active.length > 1) multipleActive++;
    const escalation = active[0];
    const hours = ageHours(escalation.raisedAt, now);
    items.push({
      caseId: item.id,
      siteCode: item.accommodationCode,
      summary: item.summary,
      caseState: item.caseState,
      severity: item.severity,
      assignedToLabel: item.assignedToLabel ?? null,
      escalationId: escalation.id,
      level: escalation.escalationLevel,
      state: escalation.state,
      raisedAt: escalation.raisedAt,
      acknowledgedAt: escalation.acknowledgedAt,
      raisedByLabel: escalation.raisedByLabel ?? null,
      ageHours: hours,
      band: agingBand(hours),
      multipleActive: active.length > 1,
    });
  }
  const priority = { over72: 0, over24: 1, unknown: 2, under24: 3 };
  items.sort(
    (a, b) =>
      priority[a.band] - priority[b.band] ||
      Number(b.severity === "urgent") - Number(a.severity === "urgent") ||
      (b.ageHours ?? -1) - (a.ageHours ?? -1),
  );
  return {
    generatedAt: observedAt.toISOString(),
    activeCount: items.length,
    awaitingAcknowledgement: items.filter((item) => item.state === "open")
      .length,
    awaitingResolution: items.filter((item) => item.state === "acknowledged")
      .length,
    over24Hours: items.filter(
      (item) => item.band === "over24" || item.band === "over72",
    ).length,
    over72Hours: items.filter((item) => item.band === "over72").length,
    urgentActive: items.filter((item) => item.severity === "urgent").length,
    unknownAge: items.filter((item) => item.band === "unknown").length,
    multipleActive,
    items,
  };
}
