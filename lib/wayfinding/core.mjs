import { validateStoredMapPoint } from "../map-coordinates/transform.mjs";

export const publicAmenityKinds = Object.freeze([
  "pool",
  "washroom",
  "dock",
  "building",
]);

function plainText(value, name, maximum, required = false) {
  const text = String(value ?? "").trim();
  if (/\p{Cc}/u.test(text) || text.length > maximum || (required && !text)) {
    throw new Error(
      `${name} must be ${required ? "1–" : "at most "}${maximum} readable characters.`,
    );
  }
  return text;
}

export function normalizeWayfindingReview(input) {
  const isPublished = input?.isPublished === true;
  return {
    isPublished,
    description: plainText(input?.description, "Description", 600, isPublished),
    accessibilityNote: plainText(
      input?.accessibilityNote,
      "Accessibility note",
      400,
    ),
    landmarkHint: plainText(input?.landmarkHint, "Landmark hint", 500),
  };
}

export function publicWayfindingPoint(row, sourceWidth, sourceHeight) {
  if (
    !publicAmenityKinds.includes(row?.kind) ||
    !row?.description?.trim() ||
    !row?.pointGeometry
  ) {
    return null;
  }
  try {
    const point = validateStoredMapPoint(
      row.pointGeometry,
      sourceWidth,
      sourceHeight,
    );
    return {
      id: row.id,
      kind: row.kind,
      code: row.code,
      name: row.name,
      description: row.description,
      accessibilityNote: row.accessibilityNote ?? "",
      landmarkHint: row.landmarkHint ?? "",
      x: point.image.x,
      y: point.image.y,
    };
  } catch {
    // Invalid/drifted points are never guessed from a stale image version.
    return null;
  }
}

export function filterPublicWayfinding(
  items,
  { query = "", kind = "all" } = {},
) {
  const needle = String(query).trim().toLocaleLowerCase();
  const safeKind =
    kind === "all" || publicAmenityKinds.includes(kind) ? kind : "all";
  return items.filter(
    (item) =>
      (safeKind === "all" || item.kind === safeKind) &&
      (!needle ||
        [
          item.name,
          item.code,
          item.description,
          item.accessibilityNote,
          item.landmarkHint,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(needle)),
  );
}
