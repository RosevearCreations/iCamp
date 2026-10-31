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
