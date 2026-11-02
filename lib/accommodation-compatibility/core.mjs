const LODGING_KINDS = new Set(["tent", "rv", "cottage"]);

function integer(value, label, minimum, maximum, fallback = null) {
  if (value === null || value === undefined || String(value).trim() === "") {
    if (fallback !== null) return fallback;
    throw new Error(label + " is required.");
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

function optionalPositive(value, label) {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 1000) {
    throw new Error(label + " must be greater than zero.");
  }
  return Math.round(number * 100) / 100;
}

function yes(value) {
  return (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === "on" ||
    value === "yes"
  );
}

function needsFeature(features, name) {
  return Array.isArray(features) && features.includes(name);
}

export function normalizeCompatibilityRequest(input = {}) {
  const lodgingKind = String(input.lodgingKind ?? "").trim();
  if (!LODGING_KINDS.has(lodgingKind)) {
    throw new Error("Stay type must be tent, RV or cottage.");
  }

  return {
    lodgingKind,
    occupants: integer(input.occupants, "Occupants", 1, 80, 1),
    pets: integer(input.pets, "Pets", 0, 20, 0),
    rvLengthMeters: optionalPositive(input.rvLengthMeters, "RV length"),
    rvWidthMeters: optionalPositive(input.rvWidthMeters, "RV width"),
    rvHeightMeters: optionalPositive(input.rvHeightMeters, "RV height"),
    electricalAmperage: integer(
      input.electricalAmperage,
      "Electrical amperage",
      0,
      50,
      0,
    ),
    needsWaterAtSite: yes(input.needsWaterAtSite),
    needsWastewaterAtSite: yes(input.needsWastewaterAtSite),
    needsWifi: yes(input.needsWifi),
    needsStepFreeAccess: yes(input.needsStepFreeAccess),
    needsAccessibleWashroom: yes(input.needsAccessibleWashroom),
    requiredFeatures: Array.isArray(input.requiredFeatures)
      ? input.requiredFeatures.map((value) => String(value))
      : [],
  };
}

function rvDimensionIssue(requested, maximum, label) {
  if (requested === null) return null;
  if (maximum === null || maximum === undefined) {
    return (
      label + " cannot be verified because this site has no configured maximum."
    );
  }
  return requested > Number(maximum)
    ? label + " exceeds the site's maximum of " + Number(maximum) + " m."
    : null;
}

export function evaluateAccommodationCompatibility({
  accommodation,
  request: rawRequest,
  capacity = null,
}) {
  if (!accommodation?.id || !accommodation?.accommodationKind) {
    throw new Error("Accommodation context is required.");
  }
  const request = normalizeCompatibilityRequest(rawRequest);
  const issues = [];

  if (accommodation.accommodationKind === "campsite") {
    if (request.lodgingKind === "cottage") {
      issues.push("A campsite cannot satisfy a cottage stay.");
    }
    if (
      request.lodgingKind === "tent" &&
      !["tent", "mixed"].includes(accommodation.campsiteType)
    ) {
      issues.push("This campsite does not accept tent stays.");
    }
    if (
      request.lodgingKind === "rv" &&
      !["rv", "mixed"].includes(accommodation.campsiteType)
    ) {
      issues.push("This campsite does not accept RV stays.");
    }

    if (request.lodgingKind === "rv") {
      for (const issue of [
        rvDimensionIssue(
          request.rvLengthMeters,
          accommodation.maxRvLengthMeters,
          "RV length",
        ),
        rvDimensionIssue(
          request.rvWidthMeters,
          accommodation.maxRvWidthMeters,
          "RV width",
        ),
        rvDimensionIssue(
          request.rvHeightMeters,
          accommodation.maxRvHeightMeters,
          "RV height",
        ),
      ]) {
        if (issue) issues.push(issue);
      }
      if (
        request.electricalAmperage >
        Number(accommodation.electricalAmperage ?? 0)
      ) {
        issues.push(
          "Requested electrical service exceeds this site's available amperage.",
        );
      }
      if (request.needsWaterAtSite && accommodation.waterService !== "site") {
        issues.push(
          "This site does not provide a water connection at the site.",
        );
      }
      if (
        request.needsWastewaterAtSite &&
        !["sewer", "septic"].includes(accommodation.wastewaterService)
      ) {
        issues.push(
          "This site does not provide an on-site wastewater connection.",
        );
      }
    }

    if (
      request.needsWifi &&
      !["shared", "site"].includes(accommodation.wifiService)
    ) {
      issues.push("Wi-Fi is not available for this site.");
    }
    if (request.needsStepFreeAccess && !accommodation.accessibleSite) {
      issues.push(
        "This campsite is not marked as an accessibility-compatible site.",
      );
    }
    if (request.needsAccessibleWashroom) {
      issues.push(
        "Accessible washroom compatibility cannot be guaranteed from a campsite alone.",
      );
    }
  } else if (accommodation.accommodationKind === "rental_cottage") {
    if (request.lodgingKind !== "cottage") {
      issues.push("A rental cottage can only satisfy a cottage stay.");
    }
    if (request.occupants > Number(accommodation.physicalMaxOccupancy ?? 0)) {
      issues.push(
        "Occupants exceed this cottage's physical sleeping capacity.",
      );
    }
    if (request.needsStepFreeAccess && !accommodation.stepFreeAccess) {
      issues.push("This cottage does not provide step-free access.");
    }
    if (request.needsAccessibleWashroom && !accommodation.accessibleWashroom) {
      issues.push("This cottage does not provide an accessible washroom.");
    }
    if (
      needsFeature(request.requiredFeatures, "kitchen") &&
      !["kitchenette", "full"].includes(accommodation.kitchenType)
    ) {
      issues.push("The requested kitchen feature is not available.");
    }
    if (
      needsFeature(request.requiredFeatures, "private_washroom") &&
      accommodation.washroomType !== "private"
    ) {
      issues.push("The requested private washroom is not available.");
    }
    if (
      needsFeature(request.requiredFeatures, "private_shower") &&
      accommodation.showerType !== "private"
    ) {
      issues.push("The requested private shower is not available.");
    }
    if (
      needsFeature(request.requiredFeatures, "refrigerator") &&
      !accommodation.hasRefrigerator
    ) {
      issues.push("The requested refrigerator is not available.");
    }
  } else {
    issues.push(
      "Permanent units are not transient booking choices in Build 034.",
    );
  }

  if (request.pets > 0 && !accommodation.petsAllowed) {
    issues.push("Pets are not allowed at this accommodation.");
  } else if (request.pets > Number(accommodation.maxPets ?? 0)) {
    issues.push(
      "Pets exceed the accommodation maximum of " +
        Number(accommodation.maxPets ?? 0) +
        ".",
    );
  }

  if (capacity && capacity.eligible === false) {
    issues.push(...capacity.issues);
  }

  return {
    eligible: issues.length === 0,
    issues: [...new Set(issues)],
    request,
    accommodationId: accommodation.id,
    accommodationKind: accommodation.accommodationKind,
    capacity,
  };
}

export function assertCompatibleBookingChoice(input) {
  const result = evaluateAccommodationCompatibility(input);
  if (!result.eligible) {
    const error = new Error(
      "Accommodation is incompatible with this booking choice: " +
        result.issues.join(" "),
    );
    error.code = "ICAMP_ACCOMMODATION_INCOMPATIBLE";
    error.issues = result.issues;
    throw error;
  }
  return result;
}
