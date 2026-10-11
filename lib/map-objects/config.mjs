export const mapObjectKinds = Object.freeze([
  Object.freeze({
    key: "site",
    displayName: "Site",
    defaultIconKey: "tent",
    defaultLayerKey: "booking",
  }),
  Object.freeze({
    key: "cottage",
    displayName: "Cottage",
    defaultIconKey: "cottage",
    defaultLayerKey: "booking",
  }),
  Object.freeze({
    key: "pool",
    displayName: "Pool",
    defaultIconKey: "water",
    defaultLayerKey: "amenities",
  }),
  Object.freeze({
    key: "washroom",
    displayName: "Washroom",
    defaultIconKey: "washroom",
    defaultLayerKey: "amenities",
  }),
  Object.freeze({
    key: "gate",
    displayName: "Gate",
    defaultIconKey: "gate",
    defaultLayerKey: "security",
  }),
  Object.freeze({
    key: "dock",
    displayName: "Dock",
    defaultIconKey: "dock",
    defaultLayerKey: "amenities",
  }),
  Object.freeze({
    key: "road",
    displayName: "Road",
    defaultIconKey: "road",
    defaultLayerKey: "utilities",
  }),
  Object.freeze({
    key: "building",
    displayName: "Building",
    defaultIconKey: "building",
    defaultLayerKey: "management",
  }),
  Object.freeze({
    key: "asset",
    displayName: "Asset",
    defaultIconKey: "pin",
    defaultLayerKey: "management",
  }),
]);

export const mapObjectKindKeys = Object.freeze(
  mapObjectKinds.map((kind) => kind.key),
);

export function validateMapObjectKind(value) {
  const kind = String(value ?? "").trim();
  if (!mapObjectKindKeys.includes(kind)) {
    throw new Error("Map object kind is invalid.");
  }
  return kind;
}

export function validateMapObjectCode(value) {
  const code = String(value ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(code)) {
    throw new Error(
      "Map object code must be 1-64 letters, numbers, dots, underscores or hyphens.",
    );
  }
  return code;
}

export function validateMapObjectName(value) {
  const name = String(value ?? "").trim();
  if (!name || name.length > 160) {
    throw new Error("Map object name must be between 1 and 160 characters.");
  }
  return name;
}

export function mapObjectKindDefinition(value) {
  const kind = validateMapObjectKind(value);
  return mapObjectKinds.find((candidate) => candidate.key === kind);
}
