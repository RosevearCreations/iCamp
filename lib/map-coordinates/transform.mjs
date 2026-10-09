const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const COORDINATE_SCHEMA_VERSION = 1;
const EPSILON = 1e-9;

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return number;
}

function positiveNumber(value, label) {
  const number = finiteNumber(value, label);
  if (number <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return number;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function stable(value) {
  if (Math.abs(value) < EPSILON) {
    return 0;
  }
  return Number(value.toFixed(12));
}

function assertPoint(point, label = "Point") {
  if (!point || typeof point !== "object") {
    throw new Error(`${label} is required.`);
  }
  return Object.freeze({
    x: finiteNumber(point.x, `${label} x`),
    y: finiteNumber(point.y, `${label} y`),
  });
}

function assertSourceDimensions(sourceWidth, sourceHeight) {
  return Object.freeze({
    sourceWidth: positiveNumber(sourceWidth, "Source width"),
    sourceHeight: positiveNumber(sourceHeight, "Source height"),
  });
}

function assertViewportDimensions(viewportWidth, viewportHeight) {
  return Object.freeze({
    viewportWidth: positiveNumber(viewportWidth, "Viewport width"),
    viewportHeight: positiveNumber(viewportHeight, "Viewport height"),
  });
}

export function clampMapZoom(zoom) {
  return clamp(finiteNumber(zoom, "Zoom"), MIN_ZOOM, MAX_ZOOM);
}

export function imagePointToNormalized(point, sourceWidth, sourceHeight) {
  const source = assertSourceDimensions(sourceWidth, sourceHeight);
  const image = assertPoint(point, "Image point");

  if (
    image.x < 0 ||
    image.y < 0 ||
    image.x > source.sourceWidth ||
    image.y > source.sourceHeight
  ) {
    throw new Error("Image point is outside the source image.");
  }

  return Object.freeze({
    x: stable(image.x / source.sourceWidth),
    y: stable(image.y / source.sourceHeight),
  });
}

export function normalizedPointToImage(point, sourceWidth, sourceHeight) {
  const source = assertSourceDimensions(sourceWidth, sourceHeight);
  const normalized = assertPoint(point, "Normalized point");

  if (
    normalized.x < 0 ||
    normalized.y < 0 ||
    normalized.x > 1 ||
    normalized.y > 1
  ) {
    throw new Error("Normalized point must stay inside 0–1.");
  }

  return Object.freeze({
    x: stable(normalized.x * source.sourceWidth),
    y: stable(normalized.y * source.sourceHeight),
  });
}

export function createStoredMapPoint(point, sourceWidth, sourceHeight) {
  const image = assertPoint(point, "Image point");
  const normalized = imagePointToNormalized(image, sourceWidth, sourceHeight);

  return Object.freeze({
    schemaVersion: COORDINATE_SCHEMA_VERSION,
    image: Object.freeze({ x: stable(image.x), y: stable(image.y) }),
    normalized,
  });
}

export function validateStoredMapPoint(
  storedPoint,
  sourceWidth,
  sourceHeight,
  tolerance = 1e-6,
) {
  if (
    !storedPoint ||
    Number(storedPoint.schemaVersion) !== COORDINATE_SCHEMA_VERSION
  ) {
    throw new Error("Unsupported map coordinate schema version.");
  }

  const image = assertPoint(storedPoint.image, "Stored image point");
  const normalized = assertPoint(
    storedPoint.normalized,
    "Stored normalized point",
  );
  const expected = imagePointToNormalized(image, sourceWidth, sourceHeight);
  const allowed = Math.max(0, finiteNumber(tolerance, "Tolerance"));

  if (
    Math.abs(expected.x - normalized.x) > allowed ||
    Math.abs(expected.y - normalized.y) > allowed
  ) {
    throw new Error("Stored image and normalized coordinates have drifted.");
  }

  return createStoredMapPoint(image, sourceWidth, sourceHeight);
}

export function applyAffineMatrix(matrix, point) {
  const source = assertPoint(point);
  const a = finiteNumber(matrix?.a, "Matrix a");
  const b = finiteNumber(matrix?.b, "Matrix b");
  const c = finiteNumber(matrix?.c, "Matrix c");
  const d = finiteNumber(matrix?.d, "Matrix d");
  const e = finiteNumber(matrix?.e, "Matrix e");
  const f = finiteNumber(matrix?.f, "Matrix f");

  return Object.freeze({
    x: stable(a * source.x + c * source.y + e),
    y: stable(b * source.x + d * source.y + f),
  });
}

export function invertAffineMatrix(matrix) {
  const a = finiteNumber(matrix?.a, "Matrix a");
  const b = finiteNumber(matrix?.b, "Matrix b");
  const c = finiteNumber(matrix?.c, "Matrix c");
  const d = finiteNumber(matrix?.d, "Matrix d");
  const e = finiteNumber(matrix?.e, "Matrix e");
  const f = finiteNumber(matrix?.f, "Matrix f");
  const determinant = a * d - b * c;

  if (Math.abs(determinant) < EPSILON) {
    throw new Error("Map transform cannot be inverted.");
  }

  return Object.freeze({
    a: stable(d / determinant),
    b: stable(-b / determinant),
    c: stable(-c / determinant),
    d: stable(a / determinant),
    e: stable((c * f - d * e) / determinant),
    f: stable((b * e - a * f) / determinant),
  });
}

export function createMapViewportTransform({
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  zoom = 1,
  panX = 0,
  panY = 0,
  devicePixelRatio = 1,
}) {
  const source = assertSourceDimensions(sourceWidth, sourceHeight);
  const viewport = assertViewportDimensions(viewportWidth, viewportHeight);
  const boundedZoom = clampMapZoom(zoom);
  const boundedDpr = clamp(
    positiveNumber(devicePixelRatio, "Device pixel ratio"),
    0.5,
    8,
  );
  const fitScale = Math.min(
    viewport.viewportWidth / source.sourceWidth,
    viewport.viewportHeight / source.sourceHeight,
  );
  const scale = fitScale * boundedZoom;
  const renderedWidth = source.sourceWidth * scale;
  const renderedHeight = source.sourceHeight * scale;
  const centerOffsetX = (viewport.viewportWidth - renderedWidth) / 2;
  const centerOffsetY = (viewport.viewportHeight - renderedHeight) / 2;
  const offsetX = centerOffsetX + finiteNumber(panX, "Pan x");
  const offsetY = centerOffsetY + finiteNumber(panY, "Pan y");
  const cssMatrix = Object.freeze({
    a: stable(scale),
    b: 0,
    c: 0,
    d: stable(scale),
    e: stable(offsetX),
    f: stable(offsetY),
  });
  const inverseCssMatrix = invertAffineMatrix(cssMatrix);
  const deviceMatrix = Object.freeze({
    a: stable(cssMatrix.a * boundedDpr),
    b: 0,
    c: 0,
    d: stable(cssMatrix.d * boundedDpr),
    e: stable(cssMatrix.e * boundedDpr),
    f: stable(cssMatrix.f * boundedDpr),
  });

  return Object.freeze({
    sourceWidth: source.sourceWidth,
    sourceHeight: source.sourceHeight,
    viewportWidth: viewport.viewportWidth,
    viewportHeight: viewport.viewportHeight,
    zoom: boundedZoom,
    panX: finiteNumber(panX, "Pan x"),
    panY: finiteNumber(panY, "Pan y"),
    fitScale: stable(fitScale),
    scale: stable(scale),
    renderedWidth: stable(renderedWidth),
    renderedHeight: stable(renderedHeight),
    devicePixelRatio: boundedDpr,
    cssMatrix,
    inverseCssMatrix,
    deviceMatrix,
  });
}

export function imagePointToViewport(point, transform) {
  return applyAffineMatrix(transform.cssMatrix, point);
}

export function viewportPointToImage(point, transform, options = {}) {
  const image = applyAffineMatrix(transform.inverseCssMatrix, point);
  if (options.clampToImage !== true) {
    return image;
  }

  return Object.freeze({
    x: stable(clamp(image.x, 0, transform.sourceWidth)),
    y: stable(clamp(image.y, 0, transform.sourceHeight)),
  });
}

export function viewportPointToNormalized(point, transform, options = {}) {
  const image = viewportPointToImage(point, transform, options);
  if (
    image.x < 0 ||
    image.y < 0 ||
    image.x > transform.sourceWidth ||
    image.y > transform.sourceHeight
  ) {
    return null;
  }
  return imagePointToNormalized(
    image,
    transform.sourceWidth,
    transform.sourceHeight,
  );
}

export function viewportPointToDevice(point, transform) {
  const viewport = assertPoint(point, "Viewport point");
  return Object.freeze({
    x: stable(viewport.x * transform.devicePixelRatio),
    y: stable(viewport.y * transform.devicePixelRatio),
  });
}

export function constrainMapPan(
  view,
  {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    minimumVisible = 48,
  },
) {
  const base = createMapViewportTransform({
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    zoom: view.zoom,
    panX: 0,
    panY: 0,
  });
  const visible = clamp(
    positiveNumber(minimumVisible, "Minimum visible area"),
    1,
    Math.min(viewportWidth, viewportHeight),
  );

  const minPanX = visible - base.cssMatrix.e - base.renderedWidth;
  const maxPanX = viewportWidth - visible - base.cssMatrix.e;
  const minPanY = visible - base.cssMatrix.f - base.renderedHeight;
  const maxPanY = viewportHeight - visible - base.cssMatrix.f;

  return Object.freeze({
    zoom: base.zoom,
    panX: stable(clamp(finiteNumber(view.panX, "Pan x"), minPanX, maxPanX)),
    panY: stable(clamp(finiteNumber(view.panY, "Pan y"), minPanY, maxPanY)),
  });
}

export function zoomMapAtViewportPoint(
  view,
  anchor,
  {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    devicePixelRatio = 1,
  },
  requestedZoom,
) {
  const current = createMapViewportTransform({
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    zoom: view.zoom,
    panX: view.panX,
    panY: view.panY,
    devicePixelRatio,
  });
  const viewportAnchor = assertPoint(anchor, "Zoom anchor");
  const imageAnchor = viewportPointToImage(viewportAnchor, current);
  const nextZoom = clampMapZoom(requestedZoom);
  const centered = createMapViewportTransform({
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
    zoom: nextZoom,
    panX: 0,
    panY: 0,
    devicePixelRatio,
  });
  const nextView = {
    zoom: nextZoom,
    panX:
      viewportAnchor.x -
      (imageAnchor.x * centered.scale + centered.cssMatrix.e),
    panY:
      viewportAnchor.y -
      (imageAnchor.y * centered.scale + centered.cssMatrix.f),
  };

  return constrainMapPan(nextView, {
    sourceWidth,
    sourceHeight,
    viewportWidth,
    viewportHeight,
  });
}

export function affineMatrixToCss(matrix) {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
}

export function affineMatrixToSvg(matrix) {
  return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
}

export const mapCoordinateLimits = Object.freeze({
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  coordinateSchemaVersion: COORDINATE_SCHEMA_VERSION,
});
