const SCOPE_KINDS = new Set([
  "campground",
  "accommodation_type",
  "section",
  "accommodation",
]);

const ACCOMMODATION_KINDS = new Set([
  "campsite",
  "rental_cottage",
  "permanent_unit",
]);

const SCOPE_WEIGHT = Object.freeze({
  campground: 10,
  accommodation_type: 20,
  section: 30,
  accommodation: 40,
});

function optionalInteger(value, label, minimum, maximum) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      label +
        " must be a whole number between " +
        minimum +
        " and " +
        maximum +
        ".",
    );
  }
  return number;
}

function optionalPositiveNumber(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1000000) {
    throw new Error(label + " must be greater than zero.");
  }
  return Math.round(number * 100) / 100;
}

function optionalId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeScopeKind(value) {
  const scopeKind = String(value ?? "").trim();
  if (!SCOPE_KINDS.has(scopeKind)) {
    throw new Error("Capacity rule scope is invalid.");
  }
  return scopeKind;
}

function normalizeAccommodationKind(value) {
  const kind = String(value ?? "").trim();
  if (!ACCOMMODATION_KINDS.has(kind)) {
    throw new Error("Accommodation type is invalid.");
  }
  return kind;
}

export function validateCapacityRuleInput(input = {}) {
  const scopeKind = normalizeScopeKind(input.scopeKind);
  let sectionId = optionalId(input.sectionId);
  let accommodationKind = optionalId(input.accommodationKind);
  let accommodationId = optionalId(input.accommodationId);

  if (scopeKind === "campground") {
    sectionId = null;
    accommodationKind = null;
    accommodationId = null;
  } else if (scopeKind === "section") {
    if (!sectionId) {
      throw new Error("Choose a campground section for the section rule.");
    }
    accommodationKind = null;
    accommodationId = null;
  } else if (scopeKind === "accommodation_type") {
    accommodationKind = normalizeAccommodationKind(accommodationKind);
    sectionId = null;
    accommodationId = null;
  } else {
    if (!accommodationId) {
      throw new Error("Choose an accommodation for the individual rule.");
    }
    sectionId = null;
    accommodationKind = null;
  }

  const minimumSiteAreaSquareMeters = optionalPositiveNumber(
    input.minimumSiteAreaSquareMeters,
    "Minimum site area",
  );
  const maximumSiteAreaSquareMeters = optionalPositiveNumber(
    input.maximumSiteAreaSquareMeters,
    "Maximum site area",
  );

  if (
    minimumSiteAreaSquareMeters !== null &&
    maximumSiteAreaSquareMeters !== null &&
    maximumSiteAreaSquareMeters < minimumSiteAreaSquareMeters
  ) {
    throw new Error(
      "Maximum site area must be at least the minimum site area.",
    );
  }

  const maxOccupants = optionalInteger(
    input.maxOccupants,
    "Maximum occupants",
    1,
    80,
  );
  const maxVisitors = optionalInteger(
    input.maxVisitors,
    "Maximum visitors",
    0,
    80,
  );
  const maxVehicles = optionalInteger(
    input.maxVehicles,
    "Maximum vehicles",
    0,
    20,
  );

  if (maxOccupants === null && maxVisitors === null && maxVehicles === null) {
    throw new Error("Set at least one occupant, visitor or vehicle limit.");
  }

  const notes = String(input.notes ?? "").trim();
  if (notes.length > 1000) {
    throw new Error("Capacity rule notes must be 1000 characters or fewer.");
  }

  return {
    scopeKind,
    sectionId,
    accommodationKind,
    accommodationId,
    minimumSiteAreaSquareMeters,
    maximumSiteAreaSquareMeters,
    maxOccupants,
    maxVisitors,
    maxVehicles,
    notes: notes || null,
  };
}

export function calculateSiteAreaSquareMeters({
  siteLengthMeters,
  siteWidthMeters,
} = {}) {
  const length =
    siteLengthMeters === null ||
    siteLengthMeters === undefined ||
    String(siteLengthMeters).trim() === ""
      ? null
      : Number(siteLengthMeters);
  const width =
    siteWidthMeters === null ||
    siteWidthMeters === undefined ||
    String(siteWidthMeters).trim() === ""
      ? null
      : Number(siteWidthMeters);

  if (
    length === null ||
    width === null ||
    !Number.isFinite(length) ||
    !Number.isFinite(width) ||
    length <= 0 ||
    width <= 0
  ) {
    return null;
  }
  return Math.round(length * width * 100) / 100;
}

function hasAreaBand(rule) {
  return (
    (rule.minimumSiteAreaSquareMeters !== null &&
      rule.minimumSiteAreaSquareMeters !== undefined) ||
    (rule.maximumSiteAreaSquareMeters !== null &&
      rule.maximumSiteAreaSquareMeters !== undefined)
  );
}

function matchesAreaBand(rule, siteAreaSquareMeters) {
  if (!hasAreaBand(rule)) {
    return true;
  }
  if (siteAreaSquareMeters === null || siteAreaSquareMeters === undefined) {
    return false;
  }
  const minimum =
    rule.minimumSiteAreaSquareMeters === null ||
    rule.minimumSiteAreaSquareMeters === undefined
      ? -Infinity
      : Number(rule.minimumSiteAreaSquareMeters);
  const maximum =
    rule.maximumSiteAreaSquareMeters === null ||
    rule.maximumSiteAreaSquareMeters === undefined
      ? Infinity
      : Number(rule.maximumSiteAreaSquareMeters);
  return siteAreaSquareMeters >= minimum && siteAreaSquareMeters <= maximum;
}

function matchesScope(rule, context) {
  if (rule.isActive === false) {
    return false;
  }
  if (rule.scopeKind === "campground") {
    return true;
  }
  if (rule.scopeKind === "accommodation_type") {
    return rule.accommodationKind === context.accommodationKind;
  }
  if (rule.scopeKind === "section") {
    return rule.sectionId === context.sectionId;
  }
  if (rule.scopeKind === "accommodation") {
    return rule.accommodationId === context.accommodationId;
  }
  return false;
}

function normalizedRequest(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      label +
        " must be a whole number between " +
        minimum +
        " and " +
        maximum +
        ".",
    );
  }
  return number;
}

function sourceFor(rule) {
  return {
    ruleId: rule.id ?? null,
    scopeKind: rule.scopeKind,
    sizeBand: hasAreaBand(rule),
  };
}

export function evaluateCapacityRules({
  rules = [],
  context,
  occupants,
  visitors,
  vehicles,
}) {
  if (!context?.accommodationId || !context?.accommodationKind) {
    throw new Error("Accommodation context is required.");
  }

  const requested = {
    occupants: normalizedRequest(occupants, "Occupants", 1, 80),
    visitors: normalizedRequest(visitors, "Visitors", 0, 80),
    vehicles: normalizedRequest(vehicles, "Vehicles", 0, 20),
  };

  const siteAreaSquareMeters =
    context.siteAreaSquareMeters === null ||
    context.siteAreaSquareMeters === undefined
      ? null
      : Number(context.siteAreaSquareMeters);

  const matchedRules = rules
    .filter(
      (rule) =>
        matchesScope(rule, context) &&
        matchesAreaBand(rule, siteAreaSquareMeters),
    )
    .sort((left, right) => {
      const scopeDelta =
        (SCOPE_WEIGHT[left.scopeKind] ?? 0) -
        (SCOPE_WEIGHT[right.scopeKind] ?? 0);
      if (scopeDelta !== 0) {
        return scopeDelta;
      }
      return Number(hasAreaBand(left)) - Number(hasAreaBand(right));
    });

  const effectiveLimits = {
    maxOccupants: null,
    maxVisitors: null,
    maxVehicles: null,
  };
  const sources = {
    maxOccupants: null,
    maxVisitors: null,
    maxVehicles: null,
  };

  for (const rule of matchedRules) {
    if (rule.maxOccupants !== null && rule.maxOccupants !== undefined) {
      effectiveLimits.maxOccupants = Number(rule.maxOccupants);
      sources.maxOccupants = sourceFor(rule);
    }
    if (rule.maxVisitors !== null && rule.maxVisitors !== undefined) {
      effectiveLimits.maxVisitors = Number(rule.maxVisitors);
      sources.maxVisitors = sourceFor(rule);
    }
    if (rule.maxVehicles !== null && rule.maxVehicles !== undefined) {
      effectiveLimits.maxVehicles = Number(rule.maxVehicles);
      sources.maxVehicles = sourceFor(rule);
    }
  }

  const physicalMaxOccupancy =
    context.physicalMaxOccupancy === null ||
    context.physicalMaxOccupancy === undefined
      ? null
      : Number(context.physicalMaxOccupancy);

  if (
    context.accommodationKind === "rental_cottage" &&
    Number.isInteger(physicalMaxOccupancy) &&
    physicalMaxOccupancy > 0 &&
    (effectiveLimits.maxOccupants === null ||
      physicalMaxOccupancy < effectiveLimits.maxOccupants)
  ) {
    effectiveLimits.maxOccupants = physicalMaxOccupancy;
    sources.maxOccupants = {
      ruleId: null,
      scopeKind: "physical_cottage_capacity",
      sizeBand: false,
    };
  }

  const issues = [];
  if (
    effectiveLimits.maxOccupants !== null &&
    requested.occupants > effectiveLimits.maxOccupants
  ) {
    issues.push(
      "Occupants exceed the effective maximum of " +
        effectiveLimits.maxOccupants +
        ".",
    );
  }
  if (
    effectiveLimits.maxVisitors !== null &&
    requested.visitors > effectiveLimits.maxVisitors
  ) {
    issues.push(
      "Visitors exceed the effective maximum of " +
        effectiveLimits.maxVisitors +
        ".",
    );
  }
  if (
    effectiveLimits.maxVehicles !== null &&
    requested.vehicles > effectiveLimits.maxVehicles
  ) {
    issues.push(
      "Vehicles exceed the effective maximum of " +
        effectiveLimits.maxVehicles +
        ".",
    );
  }

  return {
    eligible: issues.length === 0,
    configured:
      matchedRules.length > 0 ||
      effectiveLimits.maxOccupants !== null ||
      effectiveLimits.maxVisitors !== null ||
      effectiveLimits.maxVehicles !== null,
    issues,
    requested,
    effectiveLimits,
    sources,
    siteAreaSquareMeters,
    physicalMaxOccupancy,
    appliedRuleIds: matchedRules.map((rule) => rule.id).filter(Boolean),
  };
}
