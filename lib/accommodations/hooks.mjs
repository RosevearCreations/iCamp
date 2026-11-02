export const accommodationKinds = Object.freeze([
  "campsite",
  "rental_cottage",
  "permanent_unit",
]);

export function validateAccommodationKind(value) {
  const kind = String(value ?? "").trim();
  if (!accommodationKinds.includes(kind)) {
    throw new Error("Accommodation kind is invalid.");
  }
  return kind;
}

export function accommodationMapObjectKind(kind) {
  switch (validateAccommodationKind(kind)) {
    case "campsite":
      return "site";
    case "rental_cottage":
      return "cottage";
    case "permanent_unit":
      return "permanent_unit";
  }
}

export function createAvailabilityHook(accommodation) {
  return Object.freeze({
    accommodationId: accommodation.id,
    campgroundId: accommodation.campgroundId,
    kind: validateAccommodationKind(accommodation.kind),
    lifecycleState: accommodation.lifecycleState,
    revision: Number(accommodation.availabilityRevision),
    inventoryEligible: accommodation.lifecycleState === "active",
  });
}

export function createStatusHook(accommodation) {
  return Object.freeze({
    accommodationId: accommodation.id,
    campgroundId: accommodation.campgroundId,
    kind: validateAccommodationKind(accommodation.kind),
    lifecycleState: accommodation.lifecycleState,
    revision: Number(accommodation.statusRevision),
  });
}
