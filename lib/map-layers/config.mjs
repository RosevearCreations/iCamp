export const mapLayerDefinitions = Object.freeze([
  Object.freeze({
    key: "booking",
    displayName: "Booking",
    iconKey: "calendar",
    sortOrder: 10,
    visibilityPermissionKey: "reservation.read",
  }),
  Object.freeze({
    key: "maintenance",
    displayName: "Maintenance",
    iconKey: "tools",
    sortOrder: 20,
    visibilityPermissionKey: "maintenance.read",
  }),
  Object.freeze({
    key: "security",
    displayName: "Security",
    iconKey: "shield",
    sortOrder: 30,
    visibilityPermissionKey: "access.events.read",
  }),
  Object.freeze({
    key: "utilities",
    displayName: "Utilities",
    iconKey: "bolt",
    sortOrder: 40,
    visibilityPermissionKey: "campground.map",
  }),
  Object.freeze({
    key: "amenities",
    displayName: "Amenities",
    iconKey: "star",
    sortOrder: 50,
    visibilityPermissionKey: "accommodation.read",
  }),
  Object.freeze({
    key: "management",
    displayName: "Management",
    iconKey: "layers",
    sortOrder: 60,
    visibilityPermissionKey: "campground.configuration",
  }),
]);

export const mapLayerIconKeys = Object.freeze([
  "calendar",
  "tools",
  "shield",
  "bolt",
  "star",
  "layers",
]);

export const mapPolygonIconKeys = Object.freeze([
  "pin",
  "tent",
  "cottage",
  "gate",
  "water",
  "washroom",
  "field",
  "building",
  "dock",
  "road",
  "warning",
  "info",
  "tree",
]);

export const mapLayerVisibilityPermissionKeys = Object.freeze([
  "campground.map",
  "campground.configuration",
  "reservation.read",
  "maintenance.read",
  "access.events.read",
  "accommodation.read",
  "inventory.read",
  "staff.read",
]);

function boundedText(value, label, maximum = 160) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  }
  return normalized;
}

export function validateLayerKey(value) {
  const key = String(value ?? "").trim();
  if (!mapLayerDefinitions.some((layer) => layer.key === key)) {
    throw new Error("Map layer key is invalid.");
  }
  return key;
}

export function validateLayerIconKey(value) {
  const key = String(value ?? "").trim();
  if (!mapLayerIconKeys.includes(key)) {
    throw new Error("Map layer icon is invalid.");
  }
  return key;
}

export function validatePolygonIconKey(value) {
  const key = String(value ?? "").trim();
  if (!key) return null;
  if (!mapPolygonIconKeys.includes(key)) {
    throw new Error("Map polygon icon is invalid.");
  }
  return key;
}

export function validateLayerVisibilityPermissionKey(value) {
  const key = String(value ?? "").trim();
  if (!mapLayerVisibilityPermissionKeys.includes(key)) {
    throw new Error("Map layer visibility permission is invalid.");
  }
  return key;
}

export function validateLayerDisplayName(value) {
  return boundedText(value, "Layer name", 80);
}

export function validateMapLabel(value) {
  return boundedText(value, "Map label", 160);
}
