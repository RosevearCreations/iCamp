export interface MapPoint {
  x: number;
  y: number;
}

export interface MapAffineMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface MapViewState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface MapViewportTransform extends MapViewState {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  fitScale: number;
  scale: number;
  renderedWidth: number;
  renderedHeight: number;
  devicePixelRatio: number;
  cssMatrix: MapAffineMatrix;
  inverseCssMatrix: MapAffineMatrix;
  deviceMatrix: MapAffineMatrix;
}

export interface StoredMapPoint {
  schemaVersion: 1;
  image: MapPoint;
  normalized: MapPoint;
}

export function clampMapZoom(zoom: number): number;
export function imagePointToNormalized(
  point: MapPoint,
  sourceWidth: number,
  sourceHeight: number,
): MapPoint;
export function normalizedPointToImage(
  point: MapPoint,
  sourceWidth: number,
  sourceHeight: number,
): MapPoint;
export function createStoredMapPoint(
  point: MapPoint,
  sourceWidth: number,
  sourceHeight: number,
): StoredMapPoint;
export function validateStoredMapPoint(
  storedPoint: StoredMapPoint,
  sourceWidth: number,
  sourceHeight: number,
  tolerance?: number,
): StoredMapPoint;
export function applyAffineMatrix(
  matrix: MapAffineMatrix,
  point: MapPoint,
): MapPoint;
export function invertAffineMatrix(matrix: MapAffineMatrix): MapAffineMatrix;
export function createMapViewportTransform(input: {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  devicePixelRatio?: number;
}): MapViewportTransform;
export function imagePointToViewport(
  point: MapPoint,
  transform: MapViewportTransform,
): MapPoint;
export function viewportPointToImage(
  point: MapPoint,
  transform: MapViewportTransform,
  options?: { clampToImage?: boolean },
): MapPoint;
export function viewportPointToNormalized(
  point: MapPoint,
  transform: MapViewportTransform,
  options?: { clampToImage?: boolean },
): MapPoint | null;
export function viewportPointToDevice(
  point: MapPoint,
  transform: MapViewportTransform,
): MapPoint;
export function constrainMapPan(
  view: MapViewState,
  dimensions: {
    sourceWidth: number;
    sourceHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    minimumVisible?: number;
  },
): MapViewState;
export function zoomMapAtViewportPoint(
  view: MapViewState,
  anchor: MapPoint,
  dimensions: {
    sourceWidth: number;
    sourceHeight: number;
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio?: number;
  },
  requestedZoom: number,
): MapViewState;
export function affineMatrixToCss(matrix: MapAffineMatrix): string;
export function affineMatrixToSvg(matrix: MapAffineMatrix): string;

export const mapCoordinateLimits: Readonly<{
  minZoom: number;
  maxZoom: number;
  coordinateSchemaVersion: 1;
}>;
