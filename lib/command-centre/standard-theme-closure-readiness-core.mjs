// Browser-local owner walkthrough completeness only: never formal acceptance.
const areas = [
  "command",
  "capacity",
  "seasonal",
  "segments",
  "forecast",
  "assistance",
  "resolution",
  "escalations",
  "it",
  "mobile",
  "accessibility",
];
const devices = ["desktop", "tablet", "phone"];
const interactions = ["keyboard", "zoom", "contrast", "motion"];

export function summarizeStandardThemeClosureReadiness(input) {
  if (
    !input ||
    !Array.isArray(input.areas) ||
    !Array.isArray(input.devices) ||
    !Array.isArray(input.accessibility)
  )
    throw new Error("Owner review inputs are unavailable.");

  const areaMap = new Map(input.areas.map((item) => [item.key, item]));
  const deviceMap = new Map(input.devices.map((item) => [item.key, item]));
  const accessibilityMap = new Map(
    input.accessibility.map((item) => [item.key, item]),
  );
  const blockers = [];
  for (const key of areas) {
    if (areaMap.get(key)?.reviewed !== true)
      blockers.push(`Screen ${key}: owner walkthrough not checked`);
  }
  for (const key of devices) {
    const item = deviceMap.get(key);
    if (item?.result !== "passed")
      blockers.push(`Device ${key}: no passing owner observation`);
    else if (item?.retest === "still_fails")
      blockers.push(`Device ${key}: manual correction retest still fails`);
    else if (item?.correction?.trim() && item?.retest !== "looks_fixed")
      blockers.push(`Device ${key}: noted correction needs an owner retest`);
  }
  for (const key of interactions) {
    const item = accessibilityMap.get(key);
    if (item?.result !== "passed")
      blockers.push(`Accessibility ${key}: no passing owner retest`);
    else if (item?.followUp === "planned")
      blockers.push(`Accessibility ${key}: follow-up is still planned`);
    else if (item?.priority === "urgent" && item?.followUp !== "owner_retested")
      blockers.push(`Accessibility ${key}: urgent owner recheck remains open`);
  }
  return {
    areasReviewed: areas.filter((key) => areaMap.get(key)?.reviewed === true)
      .length,
    totalAreas: areas.length,
    devicePasses: devices.filter(
      (key) => deviceMap.get(key)?.result === "passed",
    ).length,
    totalDevices: devices.length,
    accessibilityPasses: interactions.filter(
      (key) => accessibilityMap.get(key)?.result === "passed",
    ).length,
    totalAccessibility: interactions.length,
    blockers,
    canRequestIndependentReview: blockers.length === 0,
  };
}

// A prepared request is only a manually copied invitation for a different,
// independent owner/reviewer to assess evidence. It is not a stored review,
// consent receipt, accessibility certification or sign-off.
export function prepareIndependentOwnerAcceptanceRequest(input, now = null) {
  const readiness = summarizeStandardThemeClosureReadiness(input);
  if (
    now !== null &&
    (!(now instanceof Date) || !Number.isFinite(now.getTime()))
  )
    throw new Error("A valid request preparation time is required.");
  const safe = (value, limit = 300) =>
    String(value ?? "")
      .replace(/[\r\n\t|]+/g, " ")
      .trim()
      .slice(0, limit);
  const ready = readiness.canRequestIndependentReview;
  const text = [
    "iCamp Build 171 — INDEPENDENT OWNER ACCESSIBILITY REVIEW REQUEST (DRAFT; NOT APPROVAL)",
    `Prepared UTC: ${now ? now.toISOString() : "not yet copied"}`,
    `Request readiness: ${ready ? "ready for separate manual independent assessment" : "BLOCKED — complete walkthrough first"}`,
    `Screens: ${readiness.areasReviewed}/${readiness.totalAreas}; devices: ${readiness.devicePasses}/${readiness.totalDevices}; accessibility: ${readiness.accessibilityPasses}/${readiness.totalAccessibility}`,
    ...input.areas.map(
      (item) =>
        `Screen ${safe(item.key)}: ${item.reviewed ? "owner-checked" : "not checked"}`,
    ),
    ...input.devices.map(
      (item) =>
        `Device ${safe(item.key)}: ${safe(item.result)}; manual retest ${safe(item.retest)}; correction: ${safe(item.correction, 400) || "none recorded"}`,
    ),
    ...input.accessibility.map(
      (item) =>
        `Accessibility ${safe(item.key)}: ${safe(item.result)}; follow-up ${safe(item.followUp)}; priority ${safe(item.priority)}`,
    ),
    ...readiness.blockers.map((item) => `BLOCKER: ${safe(item)}`),
    `Owner notes: ${safe(input.notes, 1_000) || "none recorded"}`,
    "Requested next action: separately verify the real screens/devices and record the independent decision via an approved, authenticated review process.",
    "Browser-local self-report only. No independent acceptance, WCAG certification, legal consent, production authority or billing/Omnichannel activation is recorded; no message was sent.",
  ].join("\n");
  return { ready, blockers: readiness.blockers, text };
}
