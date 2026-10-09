import {
  createStoredMapPoint,
  validateStoredMapPoint,
} from "../map-coordinates/transform.mjs";

const POLYGON_SCHEMA_VERSION = 1;
const MIN_VERTICES = 3;
const MAX_VERTICES = 256;
const EPSILON = 1e-7;

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite.`);
  return number;
}

function imagePoint(point, sourceWidth, sourceHeight) {
  const x = finite(point?.x, "Vertex x");
  const y = finite(point?.y, "Vertex y");
  if (x < 0 || y < 0 || x > sourceWidth || y > sourceHeight) {
    throw new Error("Polygon vertex is outside the source image.");
  }
  return { x, y };
}

function orientation(a, b, c) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function onSegment(a, b, c) {
  return (
    b.x <= Math.max(a.x, c.x) + EPSILON &&
    b.x + EPSILON >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) + EPSILON &&
    b.y + EPSILON >= Math.min(a.y, c.y)
  );
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (Math.abs(o1) < EPSILON && onSegment(a, c, b)) return true;
  if (Math.abs(o2) < EPSILON && onSegment(a, d, b)) return true;
  if (Math.abs(o3) < EPSILON && onSegment(c, a, d)) return true;
  if (Math.abs(o4) < EPSILON && onSegment(c, b, d)) return true;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

export function polygonSignedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

export function validateMapPolygonVertices(points, sourceWidth, sourceHeight) {
  if (!Array.isArray(points)) {
    return {
      valid: false,
      errors: ["Polygon vertices are required."],
      area: 0,
    };
  }
  if (points.length < MIN_VERTICES) {
    return {
      valid: false,
      errors: ["A polygon needs at least 3 vertices."],
      area: 0,
    };
  }
  if (points.length > MAX_VERTICES) {
    return {
      valid: false,
      errors: [`A polygon supports at most ${MAX_VERTICES} vertices.`],
      area: 0,
    };
  }

  let normalized;
  try {
    normalized = points.map((point) =>
      imagePoint(point, sourceWidth, sourceHeight),
    );
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid vertex."],
      area: 0,
    };
  }

  const errors = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[(index + 1) % normalized.length];
    if (Math.hypot(current.x - next.x, current.y - next.y) < EPSILON) {
      errors.push("Adjacent vertices cannot occupy the same point.");
      break;
    }
  }

  const area = Math.abs(polygonSignedArea(normalized));
  if (area < 1) errors.push("Polygon area is too small.");

  for (let a = 0; a < normalized.length; a += 1) {
    const aNext = (a + 1) % normalized.length;
    for (let b = a + 1; b < normalized.length; b += 1) {
      const bNext = (b + 1) % normalized.length;
      if (a === b || aNext === b || bNext === a) continue;
      if (a === 0 && bNext === 0) continue;
      if (
        segmentsIntersect(
          normalized[a],
          normalized[aNext],
          normalized[b],
          normalized[bNext],
        )
      ) {
        errors.push("Polygon edges cannot cross.");
        a = normalized.length;
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors, area };
}

export function createStoredMapPolygon(points, sourceWidth, sourceHeight) {
  const validation = validateMapPolygonVertices(
    points,
    sourceWidth,
    sourceHeight,
  );
  if (!validation.valid) throw new Error(validation.errors[0]);
  return Object.freeze({
    schemaVersion: POLYGON_SCHEMA_VERSION,
    closed: true,
    vertices: Object.freeze(
      points.map((point) =>
        createStoredMapPoint(point, sourceWidth, sourceHeight),
      ),
    ),
  });
}

export function validateStoredMapPolygon(polygon, sourceWidth, sourceHeight) {
  if (
    !polygon ||
    Number(polygon.schemaVersion) !== POLYGON_SCHEMA_VERSION ||
    polygon.closed !== true
  ) {
    throw new Error("Unsupported or open polygon geometry.");
  }
  if (!Array.isArray(polygon.vertices))
    throw new Error("Polygon vertices are required.");
  const vertices = polygon.vertices.map(
    (vertex) => validateStoredMapPoint(vertex, sourceWidth, sourceHeight).image,
  );
  const validation = validateMapPolygonVertices(
    vertices,
    sourceWidth,
    sourceHeight,
  );
  if (!validation.valid) throw new Error(validation.errors[0]);
  return createStoredMapPolygon(vertices, sourceWidth, sourceHeight);
}

export function addPolygonVertex(points, afterIndex, point) {
  const next = [...points];
  next.splice(afterIndex + 1, 0, point);
  return next;
}

export function movePolygonVertex(points, index, point) {
  if (index < 0 || index >= points.length)
    throw new Error("Vertex index is invalid.");
  return points.map((candidate, candidateIndex) =>
    candidateIndex === index ? point : candidate,
  );
}

export function deletePolygonVertex(points, index) {
  if (points.length <= MIN_VERTICES)
    throw new Error("A closed polygon must keep at least 3 vertices.");
  if (index < 0 || index >= points.length)
    throw new Error("Vertex index is invalid.");
  return points.filter((_, candidateIndex) => candidateIndex !== index);
}

export const mapPolygonLimits = Object.freeze({
  schemaVersion: POLYGON_SCHEMA_VERSION,
  minVertices: MIN_VERTICES,
  maxVertices: MAX_VERTICES,
});
