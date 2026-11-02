import type {
  MapPoint,
  StoredMapPoint,
} from "../map-coordinates/transform.mjs";

export interface StoredMapPolygon {
  schemaVersion: 1;
  closed: true;
  vertices: readonly StoredMapPoint[];
}
export interface PolygonValidation {
  valid: boolean;
  errors: string[];
  area: number;
}
export interface PolygonBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}
export function polygonSignedArea(points: readonly MapPoint[]): number;
export function validateMapPolygonVertices(
  points: readonly MapPoint[],
  sourceWidth: number,
  sourceHeight: number,
): PolygonValidation;
export function createStoredMapPolygon(
  points: readonly MapPoint[],
  sourceWidth: number,
  sourceHeight: number,
): StoredMapPolygon;
export function validateStoredMapPolygon(
  polygon: StoredMapPolygon,
  sourceWidth: number,
  sourceHeight: number,
): StoredMapPolygon;
export function addPolygonVertex(
  points: readonly MapPoint[],
  afterIndex: number,
  point: MapPoint,
): MapPoint[];
export function movePolygonVertex(
  points: readonly MapPoint[],
  index: number,
  point: MapPoint,
): MapPoint[];
export function deletePolygonVertex(
  points: readonly MapPoint[],
  index: number,
): MapPoint[];
export function polygonBounds(points: readonly MapPoint[]): PolygonBounds;
export function translatePolygon(
  points: readonly MapPoint[],
  deltaX: number,
  deltaY: number,
  sourceWidth: number,
  sourceHeight: number,
): MapPoint[];
export function snapMapPoint(
  point: MapPoint,
  increment: number,
  sourceWidth: number,
  sourceHeight: number,
): MapPoint;
export const mapPolygonLimits: Readonly<{
  schemaVersion: 1;
  minVertices: 3;
  maxVertices: 256;
}>;
